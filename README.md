# Hypers0nic

A blazing-fast Scramjet proxy client built for modern web browsing

Hypers0nic wraps the [Scramjet](https://github.com/MercuryWorkshop/scramjet)
interception proxy in a lightweight Next.js UI shell. You land on a clean
search page, type a URL or query, and the target site loads through a
service worker. 
Settings, tab cloak, theme and search engine defaults can
be imported from a [Tinf0il](https://github.com/Aluminum-Depot/Tinf0il)
account.

## Features

- **Search-engine home** with autocomplete, engine switcher, and custom
  shortcuts
- **Scramjet interception proxy** running via service worker
- **Tinf0il auth** — login or create a Tinf0il account directly to sync
  tab cloak and theme settings (no custom endpoint needed)
- **Tab cloaking** with presets (Google, Classroom, Drive, etc.)
- **Stealth mode** — one-click instant tab cloak (Ctrl+`)
- **about:blank tabs** — optional setting to open all searches in
  about:blank tabs for discretion
- **6 themes** including the default black/white/purple terminal aesthetic
- **Focus timer** with configurable durations (15/25/50 min), break timer,
  session counter, and streak tracking
- **Bookmarks** with star toggle in the proxy toolbar
- **History panel** with search and day grouping
- **Apps portal** with 7 built-in tools: Calculator, Notepad, QR Code
  Generator, Unit Converter, Color Picker, Password Generator, Stopwatch
- **Keyboard shortcuts** throughout
- **Settings export/import** for backup and restore

## Getting started

```sh
bun install
bun run dev          # Next.js on :3000
```

Start the wisp relay:

```sh
cd mini-services/wisp-server
bun install
bun run dev          # wisp relay on :3001
```

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router)
- [TypeScript 5](https://www.typescriptlang.org)
- [Tailwind CSS 4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- [Zustand](https://github.com/pmndrs/zustand)
- [@mercuryworkshop/scramjet](https://www.npmjs.com/package/@mercuryworkshop/scramjet)

