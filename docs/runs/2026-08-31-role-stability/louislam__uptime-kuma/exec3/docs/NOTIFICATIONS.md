# Notification channels

Create a channel with `POST /api/notifications`, body `{ "type": "...", ...fields }`.
The returned `id` goes into a monitor's `notificationIds` array so that
monitor's up/down transitions are delivered to it.

| type       | required fields                                   | notes |
|------------|----------------------------------------------------|-------|
| `webhook`  | `url`                                              | Generic JSON POST: `{ monitor, status, message, time }`. Use this for any service not listed below that accepts a webhook. |
| `discord`  | `webhookUrl`                                       | Posts a Discord embed, colored green/red by status. |
| `slack`    | `webhookUrl`                                       | Posts a plain-text Slack message. |
| `telegram` | `botToken`, `chatId`                               | Uses the public Bot API `sendMessage` call. |
| `gotify`   | `serverUrl`, `appToken`                            | Posts to `<serverUrl>/message?token=<appToken>`. |
| `pushover` | `appToken`, `userKey`                              | Posts form-encoded to Pushover's public API. |
| `email`    | `host`, `port`, `from`, `to`, optional `username`/`password`/`useStartTls` | Speaks raw SMTP; no dependency on any mail library. |

All of these require the target service to be reachable from wherever
PulseWatch is running -- an SMTP relay, a Discord webhook URL, etc. None
of them are needed unless a monitor actually names that channel in its
`notificationIds`.

## Example: attach a Discord channel to a monitor

```bash
curl -X POST http://localhost:3001/api/notifications \
  -H 'Content-Type: application/json' \
  --cookie "pulsewatch_session=<session cookie>" \
  -d '{"type": "discord", "webhookUrl": "https://discord.com/api/webhooks/…"}'
# -> { "id": "…", "type": "discord", "webhookUrl": "…" }

curl -X PUT http://localhost:3001/api/monitors/<monitor-id> \
  -H 'Content-Type: application/json' \
  --cookie "pulsewatch_session=<session cookie>" \
  -d '{"notificationIds": ["<the id from above>"]}'
```
