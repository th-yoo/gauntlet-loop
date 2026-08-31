# Security Posture and an Operator Checklist

## What's promised about credential handling

- Cookies and tokens are stored **only on the operator's own machine**, in a
  single local config file, with file permissions restricted so only the
  file's owner can read or write it. Nothing is uploaded or shared out.
- Code is fully open source and can be audited at any time; every upstream
  dependency it routes to is also open source.
- Installation is **safe by default**: the default install path only checks
  the environment — it does not install system packages or write
  configuration. Only an explicit system-modification flag causes it to
  install dependencies or wire up the search connector.
- A preview-only ("dry run") mode exists that shows every action the
  installer would take without actually performing any of them.
- The architecture is pluggable: if any one component is not trusted, the
  corresponding platform module can be swapped out without touching
  anything else.

## What's promised about specific platforms

- **Twitter**: only accepts a cookie the user manually exported themselves
  via a cookie-editor browser extension — the capability layer does not
  scrape or auto-extract it. A saved cookie is used only for the diagnostic
  check; actually running the underlying Twitter tool still requires the
  auth values to be set explicitly in the environment of the process that
  runs it, each time.
- **Xiaohongshu**: the tool does not perform login on the user's behalf and
  does not read the browser's Xiaohongshu cookies by itself. The
  browser-automation route only ever rides on a session the user already
  has open and controls. The "configure cookies" command explicitly does
  *not* inject a cookie into the browser-automation tool or into the
  browser; cookie-based configuration is a separate path used only when no
  existing session is available, and it requires the user to export the
  cookie manually first.

## Explicit account-safety warning (stated directly, not implied)

Any platform reached via a cookie/login session (Twitter, Xiaohongshu,
Reddit, Facebook, Instagram) carries a real risk: platforms can detect
non-browser, script/API-shaped traffic on a login session and restrict or
ban the account. The stated mitigation is to **use a dedicated secondary
account, never the operator's primary account**, for two independent
reasons:

1. Ban risk — automated-looking traffic on the account may get it limited or
   suspended.
2. Blast-radius limitation — a leaked cookie is equivalent to full login
   access; a secondary account bounds the damage if that happens.

## Operator checklist, derived from the above

Before turning on anything login-based:

- [ ] Confirm the platform actually needs it — check the platform matrix; a
      surprising number of platforms (web pages, YouTube, RSS, GitHub public
      repos, general web search, V2EX, Xueqiu, Bilibili public content) need
      no login at all.
- [ ] If login is required, create or designate a **secondary account** for
      that platform before configuring anything — never authorize with a
      primary/personal account.
- [ ] Prefer the install/update flow's default (check-only, no system
      changes) and only escalate to the system-modifying variant once the
      check output has been read and understood.
- [ ] Use the preview/dry-run mode first if available, to see exactly what a
      system-modifying install would touch before it touches it.
- [ ] For any platform that offers a "browser session reuse" backend (Reddit,
      Facebook, Instagram, Xiaohongshu), confirm the session being reused is
      the secondary account's session, not a personal browser profile that
      happens to be logged into a primary account.
- [ ] After configuring anything, run the diagnostic command and confirm it
      reports the intended backend as working — not just "installed."
- [ ] Know the two-tier uninstall in advance: a full uninstall wipes stored
      tokens/cookies and skill files; a "keep config" uninstall removes only
      the skill files, which is useful when reinstalling without needing to
      redo any login steps.
- [ ] Treat the "current selections" for each platform's backend as a
      snapshot subject to change — the diagnostic command, run fresh, is
      the authority on what is actually in use at any given moment, not any
      static document.

## Explicit non-goals / boundaries this checklist does not cover

This checklist is derived solely from the stated design and documented
behavior. It does not, and cannot, verify that the implementation matches
the documentation — that would require inspecting and running the actual
code, which is outside the scope of what this document does. It also cannot
assess platform-side terms-of-service risk for any given jurisdiction or
account type; the ban-risk warning above is restated as given, not
independently evaluated.
