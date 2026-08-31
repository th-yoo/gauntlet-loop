# Feature Checklist

Use this as a checklist of capabilities the tool provides, so you can
confirm a deployment is exercising the parts you actually need.

## Monitoring types

- [ ] HTTP(s)
- [ ] TCP
- [ ] HTTP(s) Keyword (checks that a page contains a specific string)
- [ ] HTTP(s) JSON Query (checks a value inside a JSON response)
- [ ] WebSocket
- [ ] Ping
- [ ] DNS Record
- [ ] Push (the monitored thing calls in, rather than being polled)
- [ ] Steam Game Server
- [ ] Docker Containers

## Dashboard / UX

- [ ] Fancy, reactive, fast UI
- [ ] Ping chart per monitor
- [ ] Certificate info surfaced per monitor
- [ ] Multiple status pages
- [ ] Mapping a status page to its own domain
- [ ] Multi-language interface

## Notifications

- [ ] Telegram
- [ ] Discord
- [ ] Gotify
- [ ] Slack
- [ ] Pushover
- [ ] Email (SMTP)
- [ ] 90+ other notification services beyond the above

## Operational

- [ ] 20-second check interval
- [ ] Proxy support for outbound checks
- [ ] Two-factor authentication (2FA) for logging into the dashboard

## Deliberately out of scope for this checklist

The check interval, the specific list of 90+ notification integrations,
and per-language completeness are described only at a summary level in
the source material, so they are tracked here as single line items
rather than expanded — expanding them would be inventing detail that
was not actually provided.
