// LogBook — service worker
// Caches the app shell + static assets so the PWA installs properly,
// works offline, and refreshes in the background.

const CACHE_VERSION = "gym-tracker-v4";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Precache the app shell. Routes use trailing slashes (matches the
// static export's `trailingSlash: true` config).
const SHELL_URLS = [
  "/",
  "/log/",
  "/history/",
  "/progress/",
  "/exercises/",
  "/templates/",
  "/manifest.webmanifest",
  "/logbook-v1.svg",
  "/logbook-v1-180.png",
  "/logbook-v1-192.png",
  "/logbook-v1-512.png",
  "/logbook-v1-maskable-192.png",
  "/logbook-v1-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch((err) => {
        // Best-effort precache; service worker still works without it.
        console.warn("[sw] shell precache failed", err);
      })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Skip Supabase / third-party APIs — always go to network
  if (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("googleapis.com")
  ) {
    return;
  }

  // Navigation requests: try cache first, fall back to network, then cached shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

// "Done at the gym?" save reminder (shown by the Log page, see src/lib/draft.ts).
// Tapping it, or "Save now", opens the Log page where the unsaved workout is
// waiting. "Still training" just dismisses it.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "later") return;
  const target =
    (event.notification.data && event.notification.data.url) ||
    new URL("log/", self.registration.scope).toString();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            return client
              .focus()
              .then((c) => (c && "navigate" in c ? c.navigate(target) : c))
              .catch(() => self.clients.openWindow(target));
          }
        }
        return self.clients.openWindow(target);
      })
  );
});
