# Hypers0nic

A blazing-fast Scramjet proxy built for easily browsing the modern web.

## What it does

Hypers0nic routes web traffic through the [Scramjet](https://github.com/MercuryWorkshop/scramjet) interception proxy. You type a URL or search query, and the target site loads inside an isolated iframe — all requests are transparently proxied through a wisp WebSocket relay. No backend server required beyond the wisp relay (defaults to `wss://anura.pro`).

## Features

- **Scramjet interception proxy** via service worker — routes all traffic through a wisp relay
- **Ad & tracker blocker** — 80+ known ad/tracker domains blocked at the network level, plus CSS hiding of common ad elements
- **Cookie manager** — view, search, and clear cookies stored by proxied sites
- **Search results auto-proxy** — links on proxied pages are rewritten to open through the proxy, including `window.open` and `_blank` links
- **Tinf0il auth** — login or create a Tinf0il account to sync tab cloak, theme, and preferences across devices. Settings auto-save to the connected account
- **Tab cloaking** — disguise the tab as Google Classroom (default), Drive, Docs, Gmail, Canvas, or a custom title/favicon
- **Stealth mode** — one-click instant tab cloak (Ctrl+\`)
- **Panic key** — double-press Esc (configurable) to close Hypers0nic and redirect to a safe URL
- **about:blank tabs** — optional setting to open searches in about:blank popup tabs. Uses an iframe-based approach with `#go=` hash deep-linking so the address bar always shows "about:blank" while the full app loads inside
- **6 themes** — pure black/white/purple terminal aesthetic by default, with 5 alternatives
- **Focus timer** — 15/25/50 minute sessions with break timer, session counter, and streak tracking
- **Command palette** (Ctrl+K) — fuzzy search across history, bookmarks, settings, and shortcuts
- **Bookmarks** with star toggle in the proxy toolbar
- **History panel** with search and day grouping
- **7 built-in apps** — Calculator, Notepad, QR Code Generator, Unit Converter, Color Picker, Password Generator, Stopwatch
- **Custom shortcuts** — add/remove pinned sites on the home page
- **Settings export/import** — backup and restore all data as JSON
- **Auto-warming proxy** — Scramjet boots on page load for instant first search
- **Top bar** — always visible by default, or auto-hide on mouse leave (configurable)
- **Keyboard shortcuts** throughout — Ctrl+K, Ctrl+H, Ctrl+,, Ctrl+\`, Esc, Alt+arrows

## Reliability

- **Service worker race condition fixed** — the SW registration is now awaited and verified before `proxyReady` is set. Previously, the SW flag was set to true before registration completed, causing `/service/*` requests to 404. This was the #1 cause of the 60% load failure rate
- **SW fetch handler hardened** — when the Scramjet config is not loaded after all retries, the SW returns a clear 502 error instead of falling through to `fetch(event.request)` which produced confusing 404s from the Next.js server
- **Null-safe SW fetch handler** — explicit null check for `scramjet` before calling `scramjet.route()`, preventing TypeErrors when `controllerReady` was never received
- **Controller-ready handshake** — the service worker defers opening the `$scramjet` IndexedDB until the controller signals it has finished writing the config, preventing a DB deadlock
- **20-second `controller.init()` timeout** — races against a hard timeout so the app never hangs indefinitely on init
- **IDB open timeout** — `ensureFreshScramjetDB` races its `indexedDB.open()` against a 3-second timeout
- **Transport connection reuse** — a single `BareMuxConnection` is shared across all init calls
- **Transport fallback chain** — `wss://anura.pro` → `wss://wisp.mercurywork.shop/` → local relay, each with a 15-second timeout
- **Force-reconnect on dead transport** — `forceReconnect()` resets the init promise so the next navigation re-establishes the wisp transport
- **Auto-retry on navigation failure** — if `frame.go()` throws, the ProxyFrame force-reconnects the Scramjet manager, re-initializes, and retries the navigation once
- **Direct iframe src fallback** — if `createFrame` fails after 3 retries, the iframe `src` is set directly to the encoded proxy URL as a fallback
- **Mid-stream retry** — non-HTML fetches that fail transiently are retried up to 2 times
- **5xx auto-retry** — 502/503/504 responses from the target are retried once
- **CSP removal on injected HTML** — Content-Security-Policy headers stripped from HTML responses
- **X-Frame-Options stripping** — frame-blocking headers stripped from all proxied responses
- **Error boundary** — app-level React error boundary catches render crashes
- **Error retry UI** — the error screen has Retry and Home buttons for manual recovery

## Stability

- **7-retry fetch loop** in the service worker with escalating delays, plus IDB self-healing on stale config
- **Iframe sandbox tuning** — `allow-same-origin` + `allow-scripts` + `allow-forms` + `allow-popups` + `allow-presentation` + `allow-storage-access-by-user-activation`
- **Full `allow` feature policy** — fullscreen, autoplay, encrypted-media, clipboard, PiP, web-share, gamepad, gyroscope, accelerometer
- **20-second safety timeout** — increased from 12s to handle slow proxied sites
- **Response header preservation** — all headers passed through unchanged for non-HTML responses
- **5MB HTML body cap** — `injectIntoHtml` skips pages larger than 5MB
- **Storage validation** — all localStorage load functions validate parsed data types and filter corrupt entries
- **No motion.div in navigation-critical paths** — loading overlay and progress bar use CSS transitions

## Speed

- **Runtime precaching** — Scramjet JS bundle, WASM, BareMux worker, and Epoxy transport cached via Cache API on first load
- **Asset preloading** — `<link rel="preload">` in the layout fetches the Scramjet bundle, WASM, and workers in parallel
- **Bundle-first init order** — the Scramjet bundle is loaded before transport setup, so if transport fails the bundle is already cached for the retry
- **Auto-warming proxy** — Scramjet boots on page load (not on first search)
- **Skeleton loader** — CSS-animated skeleton shows immediately during navigation

## about:blank popup architecture

When the "Open in about:blank" preference is enabled, searches open in a new tab whose address bar shows `about:blank`. The implementation uses a three-layer approach:

1. **Popup creation** — `window.open("about:blank")` opens a new tab (synchronous, within the user gesture)
2. **Iframe injection** — the popup's document is written with a full-screen `<iframe>` that loads the app with a `#go=<target-url>` hash
3. **Hash deep-linking** — on load, the app detects the `#go=` hash, sets an `inAboutBlankPopup` flag, and auto-navigates to the target URL

**Fallbacks:** popup blocked → `window.open(appUrl)` → `window.location.href = appUrl`

## Getting started

```sh
bun install
bun run dev
```

The app runs on port 3000. The default wisp relay (`wss://anura.pro`) requires no setup.

To run your own wisp relay:

```sh
cd mini-services/wisp-server
bun install
bun run dev   # runs on port 3001
```

Then update the wisp URL in Settings → Advanced.

## Deploy to Vercel

1. Push to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Vercel auto-detects Next.js — no config needed
4. Deploy

No environment variables required. HTTPS is provided by Vercel (required for the service worker).

## Architecture

```
Browser → /service/<encoded-url> → Service Worker → ScramjetServiceWorker
  → BareClient (bare-mux) → EpoxyTransport → wisp WebSocket → target site
```

The service worker intercepts all `/service/*` requests, decodes the target URL, and routes it through Scramjet. HTML responses are post-processed to inject ad-blocking CSS and link-rewriting JavaScript. Frame-blocking headers are stripped so proxied content loads inside the iframe.

## Tech stack

- Next.js 16 (App Router, Turbopack)
- TypeScript 5
- Tailwind CSS 4 + shadcn/ui
- Zustand
- @mercuryworkshop/scramjet v1.1.0
- @mercuryworkshop/epoxy-transport v2.1.28
- @mercuryworkshop/bare-mux v2.1.9
- @mercuryworkshop/wisp-js v0.4.1

## License

Apache License 2.0. See [LICENSE](LICENSE) for the full text.

## AI Use Disclaimer
Yes, this README and the Hypers0nic UI were generated with assistance from GLM-5.2 - Everything else is entirely human
