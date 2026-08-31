# Project Overview

This is a persistent-memory compression system built for an AI coding assistant's
command-line tool, with additional support for several other agent CLIs and
gateway environments.

## Why it exists

Coding-agent sessions normally forget everything once they end or reconnect. This
project closes that gap: it automatically captures the tool-usage observations an
agent produces while it works, compresses them into semantic summaries, and makes
those summaries available to whatever session comes next. The stated goal is
continuity of knowledge about a project even after a session ends or the agent
reconnects.

## What it does

- Watches an agent's tool activity during a session and records observations of
  what happened.
- Compresses those observations into summaries rather than storing raw
  transcripts, so context can be re-injected without ballooning token cost.
- Automatically injects the relevant compressed context back into new sessions,
  with no manual step required from the person running the agent.
- Exposes the stored history to natural-language search, so specific past work
  can be found and pulled back in on demand rather than only auto-injected.
- Lets sensitive content be excluded from storage entirely by wrapping it in a
  dedicated privacy tag.

## How it is put together

- A small set of lifecycle hooks (five hook points, six scripts in total) fire at
  session start, when a prompt is submitted, after each tool use, and when a
  session stops or ends, and are what actually capture and inject context.
- A separate, cached dependency-check step runs before those hooks to keep
  installs fast; it is not itself a lifecycle hook.
- A local worker process exposes an HTTP API, a web viewer for watching the
  memory stream in real time, and the search endpoints other components call.
- A local relational database holds sessions, observations, and summaries.
- A natural-language search skill layers progressive disclosure on top of that
  database so an agent can query project history economically.
- A vector database sits alongside the relational one to provide hybrid
  semantic-plus-keyword search.

## Who runs it

Anyone who wants their coding agent to remember prior sessions on a given
project without having to re-explain context every time: the intended workflow
is install once, then let it operate automatically in the background.

## Requirements

- A current runtime for the language the tool is written in (a recent major
  version or newer).
- A coding-agent CLI recent enough to support plugin hooks.
- A fast JavaScript runtime that also acts as the worker's process manager; it
  installs itself automatically if missing.
- A Python package manager used to support the vector-search component; it also
  installs itself automatically if missing.
- A bundled SQL database engine for persistent storage — no separate install
  needed.

## Configuration

A local settings file is created automatically on first run with sensible
defaults. It governs which AI model is used for summarization, which port the
worker listens on, where data is stored, log verbosity, and how much context
gets injected into new sessions. A separate mode setting controls both the
overall workflow behavior (for example a lighter "chill" mode versus the
default coding-focused mode) and the language used when it writes its
observations — a small set of languages ship built in, and the pattern used to
name them (a workflow name plus a two-letter language code) is meant to extend
to further languages without additional setup for the ones already included.

## Distribution and support model

Stable releases come from a single primary branch and are the only ones
published as an installable package; two other branches exist for early
reliability fixes and community integrations and are meant to be run directly
from source rather than installed. Contributions follow a standard fork,
branch, test, document, pull-request flow. Licensing is Apache License 2.0
throughout, on the stated reasoning that durable agentic memory ought to be
easy to embed in developer tools, local agents, MCP servers, enterprise
systems, robotics stacks, and production agent harnesses.
