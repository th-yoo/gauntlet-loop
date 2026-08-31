'use strict';

/**
 * Public status pages: a read-only, unauthenticated view over a subset
 * of monitors, addressable either by slug (/status/:slug) or by a
 * domain mapped to that slug -- mirroring the "map status pages to
 * specific domains" feature via a simple hostname -> slug table.
 */

function buildStatusPageData(page, store) {
  const monitors = page.monitorIds
    .map((id) => store.getMonitor(id))
    .filter(Boolean)
    .map((m) => {
      const beats = store.getHeartbeats(m.id);
      const last = beats[beats.length - 1];
      return {
        id: m.id,
        name: m.name,
        status: last ? last.status : 'pending',
        uptime24h: store.uptimePercent(m.id, 24 * 3 /* ~24h at 20s cadence, capped by history */),
        recentHeartbeats: beats.slice(-50).map((b) => ({ status: b.status, time: b.time, ms: b.ms }))
      };
    });

  const overall = monitors.every((m) => m.status === 'up')
    ? 'all-systems-go'
    : monitors.some((m) => m.status === 'down')
    ? 'partial-outage'
    : 'unknown';

  return {
    title: page.title,
    description: page.description || '',
    slug: page.slug,
    overall,
    monitors
  };
}

function resolveSlugForHost(store, hostHeader) {
  const host = (hostHeader || '').split(':')[0].toLowerCase();
  const page = store.listStatusPages().find((p) => (p.domains || []).includes(host));
  return page ? page.slug : null;
}

module.exports = { buildStatusPageData, resolveSlugForHost };
