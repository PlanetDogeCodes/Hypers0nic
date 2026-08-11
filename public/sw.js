/*
 * Hypers0nic service worker.
 *
 * Hosts the Scramjet interception layer. Only requests whose URL starts with
 * the configured proxy prefix ("/service/") are routed through Scramjet.
 *
 * The SW retries scramjet.fetch() up to 3 times if it throws, to handle the
 * "Cannot read properties of undefined (reading 'prefix')" race condition
 * that occurs when the controller hasn't fully propagated its config to the
 * SW's in-memory state.
 */
importScripts("/scramjet/scramjet.all.js");

const { ScramjetServiceWorker } = self.$scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();
const PROXY_PREFIX = "/service/";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(PROXY_PREFIX)) return;

  event.respondWith(
    (async () => {
      const maxAttempts = 5;
      const delay = 400;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          await scramjet.loadConfig();
          if (scramjet.route(event)) {
            return await scramjet.fetch(event);
          }
          return await fetch(event.request);
        } catch (err) {
          // If this is the "prefix" error, the controller's config hasn't
          // propagated to the SW yet. Wait and retry.
          if (i < maxAttempts - 1) {
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          console.error("[hypers0nic/sw] scramjet error after retries:", err);
          return new Response(
            "Scramjet proxy error: " + (err?.message || err),
            { status: 502, headers: { "Content-Type": "text/plain" } }
          );
        }
      }
      // Shouldn't reach here, but just in case.
      return new Response("Scramjet proxy timed out.", {
        status: 504,
        headers: { "Content-Type": "text/plain" },
      });
    })()
  );
});
