// Safe service worker for installability.
// Do not intercept network requests: returning an empty response from a
// failed cache/network promise breaks Safari with FetchEvent.respondWith(null).
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
