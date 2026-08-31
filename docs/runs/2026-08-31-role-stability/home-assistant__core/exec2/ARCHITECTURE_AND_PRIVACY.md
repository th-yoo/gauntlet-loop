# Architecture and How It Supports Privacy

## The modular approach

The system is described as being built using a modular approach so that
support for other devices or actions can be implemented easily. A dedicated
section on architecture and a dedicated section on creating new components
are both called out as existing, which signals that "modular" is a real
engineering property here, not just marketing language — there is enough
structure in the system that third parties can write to it without touching
the core.

## Why modularity is the mechanism, not just a feature

The stated mission is local control and privacy first. A monolithic system
would force every device and every integration through the same code path,
which makes it hard to reason about what data leaves the building and when.
A modular system, by contrast, means each device or service integration is
its own unit:

- An integration for a device that never needs to leave the local network
  can be written to do exactly that, without being coupled to integrations
  that do talk to outside services.
- New devices can be supported "easily," per the project's own description,
  which lowers the cost of keeping newly released hardware on the
  local-control model instead of falling back to whatever cloud app the
  hardware vendor ships.
- Because components are added rather than baked in, the set of things the
  system can talk to grows without growing the trust surface of the core.

## Featured integrations

The project highlights a set of featured integrations directly, which is
presented as evidence of what the modular architecture already supports
today, on top of a system running on a Raspberry Pi or a local server.

## Open Home Foundation

The project identifies itself as a project from the Open Home Foundation.
Read alongside the mission statement, this indicates the local-control,
privacy-first orientation is a foundation-level commitment applied to this
specific codebase, not an incidental choice made only in this project's own
messaging.
