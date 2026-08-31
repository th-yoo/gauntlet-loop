# Contributing

## Who contributes here

The project describes itself as powered by a worldwide community of
tinkerers and DIY enthusiasts. That is a statement about who is expected
to contribute, not just who is expected to use the software: people who
own one unusual device the core does not yet support are the natural
source of the next integration, because they are the ones with the
device, the motivation, and (often) the willingness to take it apart.

## Where a new contributor's work fits

Given the modular architecture, most contributions fall into one of two
buckets, and it is worth being explicit about which one a change belongs
in before starting:

- **Core changes** — touch concepts every integration relies on (state,
  events, the entity model, the user interface shell). These need the
  most scrutiny because a mistake here can affect every integration at
  once, not just one device family.
- **Integration changes** — add or fix support for a specific device,
  service, or protocol. These are the more common and more welcome entry
  point for a new contributor, precisely because the architecture is
  designed to let them be added without touching the core.

New contributors should default to the second bucket unless a limitation
in the core is actively blocking the integration work.

## Development support

Anyone who runs into trouble while developing a component is pointed to
the same help section used by end users encountering issues during
regular use. This is a deliberate choice: it treats "I'm stuck building
an integration" as a variant of "I'm stuck using the system," not as a
separate, lesser-supported activity. Contributors should use that
channel rather than working around a blocker silently, since the blocker
is often something the next contributor will hit too.

## What "featured" integrations imply for quality

The project highlights a set of integrations prominently (with
screenshots, in the site's featured section). Any integration a
contributor adds should be built to the standard implied by that
featured set: something a new user could enable and trust, not a
proof-of-concept that happens to work on the author's own hardware. The
modular architecture makes it easy to add an integration; it does not by
itself make that integration good, and reviewers should treat the two as
separate bars.

## Alignment with the mission

Because the stated mission is local control and privacy first,
contributions that introduce a hard dependency on a remote cloud service
for functionality that could otherwise run locally work against the
project's reason for existing, even if they are technically convenient.
Where a cloud dependency is unavoidable (e.g., a device vendor with no
local API), that should be visible to the end user rather than silently
assumed, so the user can make an informed choice about a device that
does not fully honor the local-first goal.
