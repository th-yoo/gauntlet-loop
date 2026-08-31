# Setup Sequence and Safety Defaults

## The intended installation flow, restated as ordered steps

1. **Install the CLI itself.** It is meant to bundle its own copies of a
   downloader tool and a feed-parsing library, so those two dependencies
   should not need a separate install step. A same-named package on a public
   package index is explicitly called out as *not* this project — installing
   the wrong same-named package is a distinct failure mode from any bug in
   the real one, and should be ruled out first if setup behaves strangely.
2. **Check the surrounding system.** A runtime, a code-hosting CLI, and an
   MCP connector manager are the three pieces of infrastructure that should
   exist first; the installer's job at this stage is only to report what is
   missing and how to get it, not to install any of it yet.
3. **Only after explicit authorization, install and wire up dependencies.**
   The default run of the installer is described as read-only: it checks the
   environment and does not install system packages or write configuration.
   A separate, explicitly-named flag is required to actually let it modify
   the system (install external tools, connect a search backend via MCP).
4. **Detect whether this is a personal machine or a server**, and give
   different configuration advice accordingly — server deployments are the
   ones that may need an outbound proxy; a personal machine should not.
5. **Only after the same explicit authorization, register the skill file**
   that teaches the agent what commands exist — again, the unauthorized path
   leaves the agent's own configuration files untouched.
6. **Ask before enabling anything that requires a login.** Even after the
   authorized install runs, the login-gated destinations should not be
   silently activated. A small number of destinations are meant to be on by
   default because they need no credential; everything that needs a signed-in
   session should be presented as a menu, activated only by name, one at a
   time.

## Reading the safety defaults as constraints, not suggestions

The intended default posture is worth stating precisely, because the
individual flags interact:

- **Default install is read-only.** No system packages, no configuration
  writes, unless an explicit system-modification flag is passed.
- **A preview mode exists** that is meant to describe every action it would
  take without performing any of them — this is the right way to answer "what
  will this actually touch on my machine" before authorizing anything.
- **A compatibility flag is documented as behaving identically to the
  default** — i.e., there is no "half-safe" mode; a run is either read-only
  or it is the fully-authorized system-modifying run.
- **Credentials are meant to live only on the local machine**, in a
  configuration file with restrictive permissions (owner read/write only),
  never uploaded anywhere.
- **Removal is meant to be complete and listed explicitly**: the local
  configuration directory (all tokens and cookies with it), any per-agent
  skill files that were written, and any MCP configuration entries that were
  registered. A preview mode is documented for this step too, and a
  configuration-preserving variant exists for a reinstall that shouldn't have
  to redo credential setup.

## A worked example of a scoping nuance in the credential rules

One destination's documentation makes a point of drawing a narrow boundary
around what a stored credential is *for*. For a cookie-based login on one
platform, the stated rule is: the saved credential is used only so that a
health-check command can confirm configuration is complete — running the
underlying command directly still requires the credential to be set
explicitly in that process's own environment. This is a meaningfully
different (and stricter) claim than "the credential is saved and used
automatically wherever needed," and it is the kind of distinction that is
easy to flatten by accident when summarizing "how login works" for a
platform. The correct generalization is: **check what a stored credential is
scoped to do, not just whether one is stored** — a credential that unlocks a
diagnostic check is not the same claim as a credential that unlocks the
underlying action.

## A second worked example: what a login helper is not allowed to do

For the cookie-gated content-discovery platform mentioned in the platform
matrix, the documentation is explicit about a boundary that a naive reading
of "just reuse the browser session" would miss: the tool does not perform a
login on the user's behalf, and it does not read that platform's cookies out
of the user's browser on its own initiative. The browser-session route only
works because the user's own separate browser-automation tool already has an
existing, user-established session open — the capability layer rides on top
of a session the user created, it does not create one itself. A
configuration subcommand that looks, by name, like it should inject a cookie
into that browser-automation tool is called out as specifically **not**
doing so; when no existing session is available, the fallback is a manual,
user-driven cookie export, not an automated login flow.

## Practical safety checklist before authorizing a system-modifying install

- [ ] Confirm which package is actually being installed — check the source
      the install command points at, not just the command name, since a
      same-named package elsewhere is a known confusable.
- [ ] Run the preview/dry-run form first and read every listed action.
- [ ] Decide per-destination whether a login-gated capability is worth
      enabling at all, rather than accepting a bulk "enable everything"
      prompt — each one is a separate credential surface.
- [ ] For any destination that will hold a login credential, use a secondary
      account rather than a primary one — automated calls against a
      logged-in session can be detected and penalized by the platform, and a
      secondary account bounds the damage of both that risk and of the
      credential itself leaking.
- [ ] After authorizing, re-run the health-check command and read its
      per-destination output rather than assuming success — it is designed
      to report which backend is currently active for each destination and
      what is broken for the ones that aren't working.
