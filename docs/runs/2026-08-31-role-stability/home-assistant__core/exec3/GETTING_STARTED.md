# Getting Started

## Choose your hardware

Two deployment targets are explicitly supported by the project's own
framing: a Raspberry Pi, or a local server you already run. Neither
requires renting cloud infrastructure. Practical guidance for choosing
between them:

- **Raspberry Pi** — appropriate for a household-scale install: a
  handful to a few dozen devices, automations that run locally, and a
  single dashboard user or a small number of family members. Favor this
  when the goal is "get a home automated" rather than "run a platform."
- **Local server** — appropriate when you already have a machine running
  at home or in a small office (a NAS, a home lab box, a spare desktop)
  and want to add home automation to what it does, or when device count
  and automation complexity are expected to grow past what a Pi-class
  machine comfortably handles.

In both cases, the defining property is the same: the machine is on the
local network, under the household's or organization's own control, and
does not need to be reachable from the public internet for local
automations to keep working.

## Before installing anything

Because the system exists to demonstrate a large number of device
integrations, and because "modular" means new integrations arrive
independently of the core, the first real task is not installation
mechanics — it is an inventory:

1. List the devices already in the home (lighting, sensors, locks,
   climate control, media, anything with a network or radio interface).
2. For each device, note the brand/protocol it speaks. This determines
   which integration will be needed later, and is the single biggest
   driver of whether setup will be quick or will need extra hardware
   (a radio adapter, a hub bridge, etc.).
3. Decide who in the household needs access to control or view the
   system, since that shapes how the dashboard and any automations
   should be organized once the system is running.

## Installation

Installation specifics (packages, images, and exact commands) are
intentionally out of scope for this note, because they change over time
and depend on which of the two deployment targets above was chosen and
which operating system is already on the machine. The project's own
website is the source of truth for current, tested installation
instructions and for a live demo of the interface before installing
anything. Use this document for the decisions that come before and after
installation, and use the project's own instructions for the mechanics
of installation itself.

## First hour after installation

1. Open the dashboard and confirm the base system is reachable on the
   local network — before adding any integration, this validates that
   the "local control" property is real for this install.
2. Add integrations one at a time, starting with the device family that
   has the most entries on the inventory from step 1 above. Because the
   architecture is modular, integrations can be added incrementally
   without risk to ones already configured.
3. If a device or step does not behave as expected, use the project's
   dedicated help resources before assuming the hardware is unsupported
   — the project explicitly maintains a help section for exactly this
   situation, distinct from general documentation.

## If something doesn't work

Treat "check the help section" as a real step, not a last resort. The
project separates general documentation from a help section aimed at
people running into trouble during use or during development of a new
integration — using the right one first saves time.
