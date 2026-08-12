# Hypers0nic

A Scramjet-based web proxy client with a terminal-inspired UI, built on Next.js 16.

## What it does

Hypers0nic routes web traffic through the [Scramjet](https://github.com/MercuryWorkshop/scramjet) interception proxy. You type a URL or search query, and the target site loads inside an isolated iframe — all requests are transparently proxied through a wisp WebSocket relay. No backend server required beyond the wisp relay (defaults to `wss://anura.pro`).

## Features

- **Scramjet interception proxy** via service worker — routes all traffic through a wisp relay
- **Ad & tracker blocker** — 80+ known ad/tracker domains blocked at the network level, plus CSS hiding of common ad elements. Conservative filter list that won't break sites
- **Cookie manager** — view, search, and clear cookies stored by proxied sites. Useful for managing session auth
- **Search results auto-proxy** — links on proxied pages are rewritten to open through the proxy, including `window.open` and `_blank` links
- **Tinf0il auth** — login or create a Tinf0il account to sync tab cloak, theme, and preferences across devices. Settings auto-save to the connected account
- **Tab cloaking** — disguise the tab as Google Classroom (default), Drive, Docs, Gmail, Canvas, or a custom title/favicon
- **Stealth mode** — one-click instant tab cloak (Ctrl+`)
- **Panic key** — double-press Esc (configurable) to close Hypers0nic and redirect to a safe URL
- **about:blank tabs** — optional setting to open all searches in about:blank tabs
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
- **Keyboard shortcuts** throughout — Ctrl+K, Ctrl+H, Ctrl+,, Ctrl+`, Esc, Alt+arrows

## Reliability

- **First-load-wins navigation** — Scramjet's `urlchange` event updates the omnibox display without re-triggering a navigation, eliminating the "loads-then-reloads" feedback loop
- **Controller-ready handshake** — the service worker defers opening the `$scramjet` IndexedDB until the controller signals it has finished writing the config, preventing a DB deadlock that could hang `controller.init()`
- **IDB open timeout** — `ensureFreshScramjetDB` races its `indexedDB.open()` against a 3-second timeout so a held DB connection never blocks boot
- **Transport connection reuse** — a single `BareMuxConnection` is shared across all init calls, preventing worker leaks and connection-pool exhaustion
- **Transport fallback chain** — `wss://anura.pro` → `wss://wisp.mercurywork.shop/` → local relay, each with a 15-second timeout
- **Force-reconnect on dead transport** — `forceReconnect()` resets the init promise so the next navigation re-establishes the wisp transport from scratch
- **Mid-stream retry** — non-HTML fetches (video chunks, API calls) that fail transiently are retried up to 2 times transparently
- **5xx auto-retry** — 502/503/504 responses from the target are retried once after a short delay, handling transient relay hiccups
- **CSP removal on injected HTML** — Content-Security-Policy headers are stripped from HTML responses so the ad-blocker and link-rewriter scripts aren't blocked by strict CSPs (YouTube, Twitch)

## Stability

- **7-retry fetch loop** in the service worker with escalating delays, plus IDB self-healing on stale config
- **Iframe sandbox tuning** — `allow-same-origin` + `allow-scripts` + `allow-forms` + `allow-popups` + `allow-presentation` + `allow-storage-access-by-user-activation` — required for YouTube/Twitch player APIs and login flows
- **Full `allow` feature policy** — fullscreen, autoplay, encrypted-media, clipboard, PiP, web-share, gamepad, gyroscope, accelerometer
- **Response header preservation** — all headers (CORS, Set-Cookie, Content-Type) are passed through unchanged for non-HTML responses, so SPAs with strict policies keep working
- **5MB HTML body cap** — `injectIntoHtml` skips pages larger than 5MB to avoid blocking the service worker on huge responses

## Speed

- **Runtime precaching** — the Scramjet JS bundle (~500KB), WASM (~500KB), BareMux worker, and Epoxy transport are cached via the Cache API on first load, so subsequent navigations don't re-download them
- **Asset preloading** — `<link rel="preload">` in the layout fetches the Scramjet bundle, WASM, and workers in parallel with the page load, shaving ~200-400ms off the first navigation
- **Auto-warming proxy** — Scramjet boots on page load (not on first search), so the first navigation is instant
- **Skeleton loader** — CSS-animated skeleton (no JS animation overhead) shows immediately during navigation

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

The service worker intercepts all `/service/*` requests, decodes the target URL, and routes it through Scramjet. HTML responses are post-processed to inject ad-blocking CSS and link-rewriting JavaScript before returning to the browser.

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

MIT
