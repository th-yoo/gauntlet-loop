# Architecture Notes

## Core idea: a stable core, an open edge

The stated design is a modular approach: the core of the system stays the
same while support for new devices or actions is added at the edges. In
practice this means the hard, shared problems — talking to the frontend,
storing state, running automations, exposing a common API — are solved
once in the core, and each new brand of device or new service only has to
solve one problem: how to speak to the core.

This has two consequences worth writing down for anyone building on top
of the project:

1. **Adding a device family is additive, not invasive.** A new
   integration should not require changing how existing integrations
   work. If a change to support one device touches unrelated code, that
   is a sign the boundary between "core" and "integration" has been
   crossed in the wrong direction.

2. **The core owns the concepts that must be shared across every
   device.** Anything that every integration needs — a notion of state,
   a notion of an event, a way to be discovered by the user interface —
   belongs in the core specifically because it must not be reinvented
   per integration. Anything that is specific to one device or one
   vendor belongs in that device's integration instead.

## Local-first as an architectural constraint, not a feature flag

"Local control first" is treated here as a property of the architecture,
not an optional mode. The practical test for whether a design decision
respects this is: does turning off the household's internet connection
break the ability to control devices and run automations that only
involve local devices? A local-first design answers no. Any component
that requires an outbound call to function for a purely local action is
working against the stated goal and should be treated as a gap, not a
convenience.

## Running on modest hardware

Because the reference deployment target includes something as small as a
Raspberry Pi as well as a generic local server, resource usage is an
architectural concern, not just a performance nicety. A design that only
works well on a beefy always-on server would exclude the smallest end of
the stated deployment range. Integrations and core changes should be
evaluated against the low end of that range, not only the high end.

## Featured integrations as an architecture signal

The fact that the project curates and highlights a set of "featured"
integrations (shown alongside screenshots of the running system) is
itself a signal about the architecture: integrations are meant to be
visible, swappable units that a user can look at, understand, and choose
to enable, rather than compiled-in behavior hidden inside the core. The
UI showing integrations and the UI showing device states are treated as
two related but separate views into the same underlying set of entities.
