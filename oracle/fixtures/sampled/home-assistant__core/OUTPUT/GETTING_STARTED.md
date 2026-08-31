# Getting started, per the artifact

This file lays out the path the README itself points to for someone pursuing
"open source home automation that puts local control and privacy first." It
does not add steps the artifact doesn't mention, and it does not fetch any
of the linked pages — those are external to this artifact and were left
unfetched per the task's constraints.

1. **See it before installing it.** The README points to a hosted demo
   (https://demo.home-assistant.io) as the way to see the system running
   without installing anything.

2. **Pick hardware that keeps control local.** The README's own framing
   ("Perfect to run on a Raspberry Pi or a local server") implies the
   privacy/local-control goal is achieved by choosing to self-host on
   hardware you own, rather than a cloud-hosted variant. The artifact does
   not name any cloud-hosted alternative — self-hosting is presented as the
   default.

3. **Follow the linked installation instructions**
   (https://home-assistant.io/getting-started/). The artifact does not
   inline the install steps; it delegates to this page.

4. **Learn automation via the linked tutorials**
   (https://home-assistant.io/getting-started/automation/), and consult the
   general documentation (https://home-assistant.io/docs/) as needed.

5. **Add device/integration support as needed.** The README claims the
   system is modular "so support for other devices or actions can be
   implemented easily," and points to two developer docs for this:
   architecture (https://developers.home-assistant.io/docs/architecture_index/)
   and creating components
   (https://developers.home-assistant.io/docs/creating_component_index/).
   The "Featured integrations" section (illustrated by a screenshot in the
   artifact) signals that a set of integrations already exists before any
   custom development is needed.

6. **Get help if stuck.** The artifact names one channel explicitly: the
   "Home Assistant help section" (https://home-assistant.io/help/), for
   either usage issues or issues encountered while developing a component.
   It also surfaces a live chat (Discord) badge linking to
   https://www.home-assistant.io/join-chat/.

## What this artifact cannot tell you

The README is a project landing page, not a manual. It does not state:
supported protocols/devices, system requirements, license name, version
history, or configuration details. Any of those would require fetching the
linked pages or other files in the project, which is outside this task's
scope (single artifact, no network).
