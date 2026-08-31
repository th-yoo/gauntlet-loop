# Project Overview

This is an easy-to-use, self-hosted monitoring tool. It watches the
uptime and health of services and presents the results through a fancy,
reactive, and fast web dashboard.

## Why it exists

- The author was looking for a self-hosted alternative to a hosted
  "uptime robot" style service, but found existing self-hosted options
  (such as the closest comparable project) unstable and no longer
  maintained, so a new one was built from scratch.
- A deliberate design goal was a fancy UI, not just a functional one.
- The project was also used as a vehicle to learn Vue 3 and vite.js,
  to show off the capabilities of Bootstrap 5, and to try building a
  single-page application driven by WebSocket updates instead of a
  traditional REST API.
- Publishing an official Docker image was itself one of the goals.

## What it does

At its core, the tool periodically checks the availability of things you
care about and tells you (and optionally the world, via a status page)
whether they are up or down, how fast they responded, and what their
certificate situation looks like. Checks run on a short interval (every
20 seconds) so problems are caught quickly, and results can be pushed
out through a large number of notification channels.

## Who runs it

Anyone who wants full control over their own monitoring stack rather
than depending on a third-party hosted service: it is meant to be
self-hosted, either via a container or by running the server directly
on a machine you control.
