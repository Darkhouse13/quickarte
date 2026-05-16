// Quickarte service worker. Intentionally small and readable.
// Responsibilities: app-shell cache, network-first fetch with stale fallback,
// web push display, notification click routing.

const VERSION = "v1";
const SHELL_CACHE = `quickarte-shell-${VERSION}`;
const RUNTIME_CACHE = `quickarte-runtime-${VERSION}`;

const SHELL_ASSETS = [
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/badge-72.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Network-first GET for same-origin navigations and static assets.
// Mutating requests and Server Action POSTs bypass the worker entirely.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API routes — they're dynamic and per-user.
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        // Only cache successful, cacheable responses. Opaque/partial responses
        // would poison the cache and break offline fallback.
        if (fresh && fresh.status === 200 && fresh.type === "basic") {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        // Last-resort fallback for navigations: any cached HTML page.
        if (req.mode === "navigate") {
          const cache = await caches.open(RUNTIME_CACHE);
          const keys = await cache.keys();
          for (const k of keys) {
            const r = await cache.match(k);
            if (r && r.headers.get("content-type")?.includes("text/html")) {
              return r;
            }
          }
        }
        return new Response("", { status: 504, statusText: "Offline" });
      }
    })(),
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Quickarte", body: event.data.text() };
  }
  const title = payload.title || "Quickarte";
  const options = {
    body: payload.body || "",
    badge: payload.badge || "/icons/badge-72.png",
    icon: payload.icon || "/icons/icon-192.png",
    tag: payload.tag,
    data: payload.data || {},
    requireInteraction: Boolean(payload.requireInteraction),
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/fr/orders";
  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = list.find((c) => c.url.includes("/orders"));
      if (existing) {
        await existing.focus();
        return;
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
