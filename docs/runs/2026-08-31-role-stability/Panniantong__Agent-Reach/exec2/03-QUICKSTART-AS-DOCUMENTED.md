# Quick Start, As Documented (Not Executed Here)

This document restates the setup flow exactly as described, for an operator
to carry out themselves. No installation, network fetch, or system change is
performed as part of producing this document — see the "boundaries" note at
the end.

## Prerequisite for one specific chat-agent host

If the host agent runs inside a gateway that restricts it to a messaging-only
tool profile, it will not be able to execute shell commands at all, which
this capability layer depends on (`pip install`, a small MCP launcher, the
Twitter CLI, etc.). For that specific host, the tool profile needs to be
switched to a coding-capable profile and the gateway restarted before
anything else in this flow will work. Other hosts (general-purpose coding
agents) are not subject to this restriction.

## Step 1 — Hand the agent one line

The entire install step is a single natural-language instruction pointing
the agent at an install document; the agent is expected to read that
document and carry out the rest on its own. Two variants exist:

- A plain install request — installs the CLI and *checks* the environment
  only. By default it does not install system packages or write any
  configuration files.
- A "safety-check-and-install" request — explicitly asks for the same
  environment-check-only behavior, stated up front, for operators who want
  that made explicit rather than implicit.

Update follows the same shape: a single natural-language instruction
pointing at an update document, handled entirely by the agent.

## Step 2 — What the agent does after reading the install document

In order:

1. Installs the command-line tool from the source project (bundling its own
   video-downloader and feed-parser dependencies — explicitly *not* the
   same-named package on the public Python package index, which is a
   different, unrelated project).
2. Checks for the system building blocks it depends on (a JS runtime, the
   GitHub CLI, an MCP launcher) and reports what is missing and how to add
   it, without installing them itself unless authorized.
3. Only installs dependencies and wires up the free web-search MCP
   connector if the operator explicitly passed a "modify my system" flag.
4. Detects whether it is running on a personal machine or a server and
   tailors its configuration advice accordingly (a paid outbound proxy is a
   server-only consideration).
5. Only writes the agent-facing skill/instruction file into the host
   agent's skills directory if the same explicit system-modification flag
   was passed; the default check path does not touch any files.
6. Offers a menu of the platforms that need a login (Xiaohongshu, Twitter,
   Reddit, Facebook, Instagram) and only activates the ones the operator
   names — nothing login-based is turned on by default.

## Step 3 — Check status

A single diagnostic command is meant to be run after installation; it
reports, per platform, whether it is reachable, what is failing if not, and
which backend is currently being used to serve it.

## Step 4 — Everyday use, no configuration required

Once installed, the zero-config platforms are meant to be used by simply
asking in natural language — the agent is expected to already know which
underlying tool to invoke for each kind of request (reading a link, viewing
a GitHub repo, extracting YouTube subtitles, searching Bilibili, searching
the web at large, subscribing to an RSS feed) because it has read the
skill/instruction file installed in Step 2. Platforms that need a login are
unlocked on request, by name.

## Step 5 — Turning it off later

A single uninstall command is documented, along with two variants: a
preview-only run that changes nothing, and a run that removes only the
skill files while keeping saved credentials (useful for a clean reinstall).
Uninstalling is described as removing all locally stored tokens/cookies, the
per-agent skill files, and the search-connector registration — and,
separately, removing the command-line tool itself is documented as a
distinct final step.

## Boundaries of this document

This restates the documented flow for an operator to execute under their own
authority and judgment. Nothing above was run: no shell command was issued,
no package was installed, no network request was made, and no system
configuration was changed while producing it. Any step that installs
software, writes configuration, or stores credentials should only be carried
out by an operator who has read and accepted what that step does, using a
secondary/non-primary account wherever a platform login is involved (see the
companion security document).
