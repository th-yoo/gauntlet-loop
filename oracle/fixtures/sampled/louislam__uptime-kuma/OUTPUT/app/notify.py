"""Pluggable notification providers.

README: "Notifications via Telegram, Discord, Gotify, Slack, Pushover,
Email (SMTP), and 90+ notification services". Re-implementing 90+ external
integrations is out of scope for a spec built from a feature-list bullet
alone (each needs its own API contract this artifact does not provide), so
this module defines the provider interface plus two providers that need no
third-party service and no outbound call by default:

  * LogNotifier   - always available, writes to notifications.log
  * WebhookNotifier - generic HTTP POST, which is how most of the listed
                      services (Discord, Slack, Gotify, ...) actually
                      receive events, so wiring a new one in is "point a
                      webhook URL at it", not "write a new provider".

Adding e.g. Telegram is then: build the bot-API URL and reuse WebhookNotifier,
or subclass Notifier for providers with a non-HTTP transport (SMTP email).
"""
import json
import smtplib
import time
import urllib.request
from email.mime.text import MIMEText


class Notifier:
    def notify(self, subject: str, message: str):
        raise NotImplementedError


class LogNotifier(Notifier):
    def __init__(self, path: str):
        self.path = path

    def notify(self, subject: str, message: str):
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {subject}: {message}\n")


class WebhookNotifier(Notifier):
    def __init__(self, url: str, timeout: float = 10):
        self.url = url
        self.timeout = timeout

    def notify(self, subject: str, message: str):
        payload = json.dumps({"subject": subject, "message": message}).encode("utf-8")
        req = urllib.request.Request(
            self.url, data=payload, headers={"Content-Type": "application/json"}, method="POST"
        )
        urllib.request.urlopen(req, timeout=self.timeout)


class EmailNotifier(Notifier):
    """Email (SMTP), one of the notification channels named in the README."""

    def __init__(self, host, port, username, password, to_addr, use_tls=True, timeout=10):
        self.host, self.port = host, port
        self.username, self.password = username, password
        self.to_addr = to_addr
        self.use_tls = use_tls
        self.timeout = timeout

    def notify(self, subject: str, message: str):
        msg = MIMEText(message)
        msg["Subject"] = subject
        msg["From"] = self.username
        msg["To"] = self.to_addr
        with smtplib.SMTP(self.host, self.port, timeout=self.timeout) as server:
            if self.use_tls:
                server.starttls()
            if self.username:
                server.login(self.username, self.password)
            server.sendmail(self.username, [self.to_addr], msg.as_string())


class NotificationManager:
    def __init__(self):
        self._providers = []

    def add(self, provider: Notifier):
        self._providers.append(provider)

    def notify_all(self, subject: str, message: str):
        errors = []
        for p in self._providers:
            try:
                p.notify(subject, message)
            except Exception as e:
                errors.append(f"{type(p).__name__}: {e}")
        return errors
