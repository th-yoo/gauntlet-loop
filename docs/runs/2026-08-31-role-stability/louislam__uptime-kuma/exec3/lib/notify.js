'use strict';

/**
 * Notifications: dispatch an up/down transition to whichever channels a
 * monitor is subscribed to.
 *
 * A real "90+ services" catalog is out of scope for a dependency-free
 * build. What is implemented is the shape almost all of them share --
 * an HTTP(S) POST/GET of a JSON or form payload to a URL -- plus a raw
 * SMTP client for email, since that one is not HTTP at all. Each
 * formatter below targets one well-known public webhook/API shape
 * (Discord, Slack, Telegram, Gotify, Pushover) so wiring a real account
 * in is a matter of pasting a URL/token, not writing code.
 */

const https = require('https');
const http = require('http');
const net = require('net');
const tls = require('tls');
const { URL } = require('url');

function httpPost(urlStr, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlStr);
    } catch (e) {
      reject(e);
      return;
    }
    const lib = url.protocol === 'https:' ? https : http;
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const req = lib.request(
      url,
      {
        method: 'POST',
        headers: Object.assign(
          {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          },
          extraHeaders || {}
        )
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function statusWord(heartbeat) {
  return heartbeat.status === 'up' ? 'is back UP' : 'is DOWN';
}

async function notifyWebhook(channel, monitor, heartbeat) {
  return httpPost(channel.url, {
    monitor: monitor.name,
    status: heartbeat.status,
    message: heartbeat.msg,
    time: heartbeat.time
  });
}

async function notifyDiscord(channel, monitor, heartbeat) {
  return httpPost(channel.webhookUrl, {
    content: null,
    embeds: [
      {
        title: `${monitor.name} ${statusWord(heartbeat)}`,
        description: heartbeat.msg,
        color: heartbeat.status === 'up' ? 0x2ecc71 : 0xe74c3c,
        timestamp: heartbeat.time
      }
    ]
  });
}

async function notifySlack(channel, monitor, heartbeat) {
  return httpPost(channel.webhookUrl, {
    text: `*${monitor.name}* ${statusWord(heartbeat)} -- ${heartbeat.msg}`
  });
}

async function notifyTelegram(channel, monitor, heartbeat) {
  const text = encodeURIComponent(`${monitor.name} ${statusWord(heartbeat)}\n${heartbeat.msg}`);
  const url = `https://api.telegram.org/bot${channel.botToken}/sendMessage?chat_id=${channel.chatId}&text=${text}`;
  return httpPost(url, '');
}

async function notifyGotify(channel, monitor, heartbeat) {
  const url = `${channel.serverUrl.replace(/\/$/, '')}/message?token=${channel.appToken}`;
  return httpPost(url, {
    title: `${monitor.name} ${statusWord(heartbeat)}`,
    message: heartbeat.msg,
    priority: heartbeat.status === 'up' ? 2 : 8
  });
}

async function notifyPushover(channel, monitor, heartbeat) {
  const params = new URLSearchParams({
    token: channel.appToken,
    user: channel.userKey,
    title: `${monitor.name} ${statusWord(heartbeat)}`,
    message: heartbeat.msg
  });
  return httpPost('https://api.pushover.net/1/messages.json', params.toString(), {
    'Content-Type': 'application/x-www-form-urlencoded'
  });
}

/**
 * A deliberately small hand-rolled SMTP client: connect, EHLO, optional
 * STARTTLS + AUTH LOGIN, MAIL FROM / RCPT TO / DATA. It speaks enough of
 * RFC 5321 to deliver a plain-text alert through a typical relay; it is
 * not a general-purpose mail library.
 */
function notifyEmail(channel, monitor, heartbeat) {
  return new Promise((resolve, reject) => {
    const port = channel.port || 587;
    const socket = net.createConnection({ host: channel.host, port });
    const lines = [];
    let step = 0;
    let secureSocket = null;

    function activeSocket() {
      return secureSocket || socket;
    }

    function send(cmd) {
      activeSocket().write(cmd + '\r\n');
    }

    function b64(s) {
      return Buffer.from(s, 'utf8').toString('base64');
    }

    function onData(data) {
      const text = data.toString('utf8');
      lines.push(text);
      const code = text.slice(0, 3);
      switch (step) {
        case 0: // greeting
          send(`EHLO pulsewatch.local`);
          step = 1;
          break;
        case 1: // ehlo reply
          if (channel.useStartTls) {
            send('STARTTLS');
            step = 2;
          } else if (channel.username) {
            send('AUTH LOGIN');
            step = 4;
          } else {
            step = 6;
            sendEnvelope();
          }
          break;
        case 2: // STARTTLS reply
          secureSocket = tls.connect({ socket, host: channel.host, servername: channel.host }, () => {
            secureSocket.on('data', onData);
            send('EHLO pulsewatch.local');
            step = 3;
          });
          break;
        case 3: // EHLO after STARTTLS
          if (channel.username) {
            send('AUTH LOGIN');
            step = 4;
          } else {
            sendEnvelope();
          }
          break;
        case 4: // 334 Username:
          send(b64(channel.username));
          step = 5;
          break;
        case 5: // 334 Password:
          send(b64(channel.password));
          step = 6;
          break;
        case 6: // auth result / ready for envelope
          sendEnvelope();
          break;
        case 7: // MAIL FROM
          send(`RCPT TO:<${channel.to}>`);
          step = 8;
          break;
        case 8: // RCPT TO
          send('DATA');
          step = 9;
          break;
        case 9: // 354 start mail input
          {
            const subject = `${monitor.name} ${statusWord(heartbeat)}`;
            const body = [
              `From: ${channel.from}`,
              `To: ${channel.to}`,
              `Subject: ${subject}`,
              '',
              heartbeat.msg,
              '.'
            ].join('\r\n');
            send(body);
            step = 10;
          }
          break;
        case 10: // 250 Ok: queued
          send('QUIT');
          activeSocket().end();
          resolve(true);
          break;
        default:
          break;
      }
      if (code[0] === '5') {
        activeSocket().end();
        reject(new Error(`SMTP error: ${text.trim()}`));
      }
    }

    function sendEnvelope() {
      send(`MAIL FROM:<${channel.from}>`);
      step = 7;
    }

    socket.on('data', onData);
    socket.on('error', reject);
    socket.setTimeout(15000, () => {
      socket.destroy();
      reject(new Error('SMTP connection timed out'));
    });
  });
}

const DISPATCHERS = {
  webhook: notifyWebhook,
  discord: notifyDiscord,
  slack: notifySlack,
  telegram: notifyTelegram,
  gotify: notifyGotify,
  pushover: notifyPushover,
  email: notifyEmail
};

async function dispatch(channel, monitor, heartbeat) {
  const fn = DISPATCHERS[channel.type];
  if (!fn) throw new Error(`Unsupported notification channel type "${channel.type}"`);
  return fn(channel, monitor, heartbeat);
}

module.exports = { dispatch, DISPATCHERS: Object.keys(DISPATCHERS) };
