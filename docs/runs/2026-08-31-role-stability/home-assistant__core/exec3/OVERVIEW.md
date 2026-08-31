# Project Overview

## Mission

Open source home automation that puts local control and privacy first.

This project exists so that people can automate the devices in their home
without handing control of those devices — or the data those devices
generate — to a third party. Automation logic, device state, and history
live on hardware the owner controls. Nothing about turning on a light or
checking a sensor needs to leave the building.

## Who this is for

The project is built and used by a worldwide community of tinkerers and
DIY enthusiasts. It is intentionally friendly to people who like to open
things up, wire things together, and extend the system themselves, rather
than being a closed appliance that only the vendor can change.

## Where it runs

The system is designed to be light enough to run on modest hardware — a
Raspberry Pi is enough — or on a local server already present in the home
or a small office. There is no requirement to route control traffic
through a remote data center for the system to function day to day.

## Design principle: modular by default

The system is built using a modular approach so that support for other
devices or actions can be added without reworking the core. New hardware,
new services, and new kinds of automation are added as independent
integrations that plug into the same core rather than requiring the core
itself to be rewritten for each new device family. This is what lets the
project support a very wide and constantly growing range of devices while
keeping the core stable.

## Featured integrations

The project highlights a curated set of integrations to demonstrate the
breadth of what can be connected — showing that "home automation" here
means more than a single vendor's product line, and that the same core
can drive lighting, sensors, and other classes of device through a
common model of entities and states.

## Support and community

When something goes wrong, either while using the system day to day or
while building a new integration for it, the project points people to a
dedicated help section on its website rather than leaving them to guess.
This reflects the same community-first posture as the "tinkerers and DIY
enthusiasts" framing: the expectation is that users will sometimes need
to debug or extend the system themselves, so a support path is treated as
a first-class part of the offering.

## Governance

The project is run as a project of the Open Home Foundation, a
not-for-profit structure. That framing matters for the "privacy first"
half of the mission: the incentives of the organization behind the
software are aligned with keeping control local and the software open,
rather than with monetizing user data or locking users into a paid cloud
service to keep their own home working.
