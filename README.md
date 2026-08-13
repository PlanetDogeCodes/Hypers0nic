# Hypers0nic

A blazing-fast Scramjet proxy client built for easily browsing the modern web.

## What it does

Hypers0nic routes web traffic through the [Scramjet](https://github.com/MercuryWorkshop/scramjet) interception proxy. You type a URL or search query, and the target site loads inside an isolated iframe — all requests are transparently proxied through a wisp WebSocket relay. No backend server required beyond the wisp relay (defaults to `wss://anura.pro`).

## Features

- **Scramjet interception proxy** via service worker — routes all traffic through a wisp relay
- **Permalink routing** — the address bar shows `/site/<domain>` for the site you're visiting (e.g., `https://hypers0nic.vercel.app/site/duckduckgo.com`). Shareable and bookmarkable, while maintaining tab name and icon cloaking
- **Ad & tracker blocker** — 80+ known ad/tracker domains blocked at the network level
- **Cookie manager** — view, search, and clear cookies stored by proxied sites
- **Search results auto-proxy** — links on proxied pages are rewritten to open through the proxy
- **Tinf0il auth** — login or create a Tinf0il account to sync settings across devices
- **Tab cloaking** — disguise the tab as Google Classroom (default), Drive, Docs, Gmail, Canvas, or custom
- **Stealth mode** — one-click instant tab cloak (Ctrl+\`)
- **Panic key** — double-press Esc (configurable) to close and redirect to a safe URL
- **about:blank tabs** — optional setting to open searches in about:blank popup tabs
- **6 themes** — pure black/white/purple terminal aesthetic by default
- **Focus timer** — 15/25/50 minute sessions with break timer and streak tracking
- **Command palette** (Ctrl+K) — fuzzy search across history, bookmarks, settings, and shortcuts
- **Bookmarks** with star toggle in the proxy toolbar
- **History panel** with search and day grouping
- **7 built-in apps** — Calculator, Notepad, QR Code Generator, Unit Converter, Color Picker, Password Generator, Stopwatch
- **Custom shortcuts** — add/remove pinned sites on the home page
- **Settings export/import** — backup and restore all data as JSON
- **Auto-warming proxy** — Scramjet boots on page load for instant first search
- **Keyboard shortcuts** — Ctrl+K, Ctrl+H, Ctrl+,, Ctrl+\`, Esc, Alt+arrows

## Reliability

- **Tinf0il-inspired SW registration** — full state machine handling active/installing/waiting states with `SKIP_WAITING`, `updateViaCache: "none"` for always-fresh SW
- **Config validation** — `safeLoadConfig` validates `scramjet.config.prefix` matches expected `/service/` prefix, heals DB on mismatch (prevents "Cannot read properties of undefined (reading 'prefix')" error)
- **SW registration race fixed** — `ensureServiceWorker()` is idempotent, verifies `navigator.serviceWorker.controller` before returning true
- **20-second `controller.init()` timeout** — races against a hard timeout so the app never hangs
- **IDB open timeout** — 3-second timeout on `indexedDB.open()` in `ensureFreshScramjetDB`
- **SW `healScramjetDB` timeout** — 5-second timeout prevents indefinite hangs
- **SW `safeLoadConfig` timeout** — 5-second timeout on `scramjet.loadConfig()`
- **Transport connection reuse** — single `BareMuxConnection` shared across all init calls
- **Transport fallback chain** — `wss://anura.pro` → `wss://wisp.mercurywork.shop/` → local relay
- **Force-reconnect on dead transport** — resets init promise for fresh connection
- **Auto-retry on navigation failure** — force-reconnect + re-init + retry once
- **Direct iframe src fallback** — if `createFrame` fails, iframe src set to encoded URL
- **Mid-stream retry** — non-HTML fetches retried up to 2 times
- **5xx auto-retry** — 502/503/504 responses retried once
- **CSP removal on injected HTML** — Content-Security-Policy headers stripped
- **X-Frame-Options stripping** — frame-blocking headers stripped from all responses
- **Error boundary** — app-level React error boundary catches render crashes
- **Error retry UI** — Retry and Home buttons on error screen

## Permalink routing

When you navigate to a site, the browser URL changes to a permalink:

| Target | Permalink |
|---|---|
| `duckduckgo.com` | `/site/duckduckgo.com/` |
| `en.wikipedia.org/wiki/Proxy` | `/site/en.wikipedia.org/wiki/Proxy` |
| `duckduckgo.com/?q=test` | `/site/duckduckgo.com/?q=test` |

- Uses `history.pushState` so the page doesn't reload
- Tab cloak (title + favicon) is maintained separately and NOT affected
- Direct navigation to a permalink auto-loads the target site
- Browser back/forward buttons work correctly
- Catch-all Next.js route at `/site/[[...slug]]` renders the app shell

## about:blank popup architecture

When "Open in about:blank" is enabled, searches open in a new tab whose address bar shows `about:blank`:

1. `window.open("about:blank")` opens a new tab (synchronous, within user gesture)
2. Popup document written with full-screen `<iframe>` loading the app with `#go=<target-url>` hash
3. App detects hash, sets `inAboutBlankPopup` flag, auto-navigates

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
Browser → /site/<domain> (permalink) → App Shell
  → /service/<encoded-url> → Service Worker → ScramjetServiceWorker
  → BareClient (bare-mux) → EpoxyTransport → wisp WebSocket → target site
```

The service worker intercepts all `/service/*` requests, decodes the target URL, and routes it through Scramjet. HTML responses are post-processed to inject ad-blocking CSS and link-rewriting JavaScript. Frame-blocking headers are stripped.

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
