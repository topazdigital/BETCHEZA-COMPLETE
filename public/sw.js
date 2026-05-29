/* Betcheza Service Worker v4 — Offline-first caching + Push Notifications */

const CACHE_VERSION = 'v4';
const STATIC_CACHE  = `bcz-static-${CACHE_VERSION}`;
const PAGES_CACHE   = `bcz-pages-${CACHE_VERSION}`;
const API_CACHE     = `bcz-api-${CACHE_VERSION}`;
const ALL_CACHES    = [STATIC_CACHE, PAGES_CACHE, API_CACHE];

/* Pages & shell assets pre-cached on install */
const PRECACHE_URLS = [
  '/offline',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg',
  '/apple-icon.png',
];

/* API paths that are safe to cache with stale-while-revalidate */
const CACHEABLE_API_PREFIXES = [
  '/api/matches',
  '/api/tips',
  '/api/tipsters',
  '/api/leaderboard',
  '/api/site-settings',
  '/api/bookmakers',
  '/api/featured',
  '/api/competitions',
  '/api/jackpots',
  '/api/auth/google-client-id',
];

/* ─── Install: pre-cache shell ─────────────────────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

/* ─── Activate: delete stale caches ────────────────────────────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

/* ─── Fetch: routing logic ──────────────────────────────────────────────────── */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET from same origin
  if (request.method !== 'GET') return;
  let url;
  try { url = new URL(request.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  // ── 1. API data → stale-while-revalidate ───────────────────────────────────
  if (path.startsWith('/api/')) {
    if (!CACHEABLE_API_PREFIXES.some((p) => path.startsWith(p))) return;
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // ── 2. Next.js static chunks → cache-first (immutable, content-hashed) ─────
  if (path.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── 3. Next.js page data (_next/data) → stale-while-revalidate ─────────────
  if (path.startsWith('/_next/data/')) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // ── 4. Static files (images, fonts, uploads, icons) → cache-first ───────────
  if (
    path.startsWith('/uploads/') ||
    path.startsWith('/icons/') ||
    /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|eot|mp4|webm)$/i.test(path)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── 5. HTML pages → network-first, offline fallback ──────────────────────────
  const acceptsHtml = (request.headers.get('Accept') || '').includes('text/html');
  if (acceptsHtml) {
    event.respondWith(networkFirstPage(request));
    return;
  }
});

/* ─── Strategy: cache-first ─────────────────────────────────────────────────── */
async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && response.status < 400) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

/* ─── Strategy: stale-while-revalidate ──────────────────────────────────────── */
async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  /* Always fetch in background to keep cache fresh */
  const networkPromise = fetch(request.clone())
    .then((response) => {
      if (response.ok && response.status < 400) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  /* Return stale immediately; let background fetch update the cache */
  if (cached) return cached;

  /* Nothing cached — must wait for network */
  const networkResponse = await networkPromise;
  if (networkResponse) return networkResponse;

  /* Fully offline & no cache — return empty JSON so UI doesn't crash */
  return new Response(
    JSON.stringify({ offline: true, error: 'You are offline', rows: [], data: [], matches: [], tips: [] }),
    { status: 200, headers: { 'Content-Type': 'application/json', 'X-Offline': '1' } }
  );
}

/* ─── Strategy: network-first with page cache fallback ──────────────────────── */
async function networkFirstPage(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    /* Last resort: offline page */
    const offline = await caches.match('/offline', { cacheName: STATIC_CACHE });
    if (offline) return offline;
    return new Response(
      '<!DOCTYPE html><html><head><title>Offline — Betcheza</title></head><body style="font-family:sans-serif;text-align:center;padding:4rem"><h1>You\'re offline</h1><p>Open Betcheza when you have internet to load the latest tips.</p><a href="/">Try again</a></body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PUSH NOTIFICATIONS (preserved from v1)
═══════════════════════════════════════════════════════════════════════════════ */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Betcheza', body: event.data ? event.data.text() : '' };
  }
  const title   = data.title || 'Betcheza';
  const options = {
    body:              data.body || data.message || '',
    icon:              data.icon  || '/icon-192.png',
    badge:             data.badge || '/icon-72.png',
    tag:               data.tag   || 'betcheza-notification',
    data:              { url: data.url || '/', ...data.data },
    actions:           data.actions || [],
    requireInteraction: !!data.requireInteraction,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.endsWith(url) && 'focus' in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
