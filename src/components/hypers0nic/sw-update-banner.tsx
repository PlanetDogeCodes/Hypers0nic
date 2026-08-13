"use client";

import { useEffect, useRef, useState } from "react";
import { X, RefreshCw } from "lucide-react";

/**
 * Service-worker update notification banner (Task 4 — reliability).
 *
 * Listens for `updatefound` events on the SW registration and, when a new
 * SW finishes installing, shows a slim banner at the top of the viewport
 * offering to reload. The banner:
 *
 * - Is dismissible (X button) — never auto-reloads.
 * - Auto-dismisses after 30s if the user does nothing (so a stale banner
 *   doesn't sit forever on a tab the user walked away from).
 * - Sits at z-[60], above the app header (z-50) but below toasts (z-100).
 *   It's the same height as the header (h-12), so when visible it
 *   temporarily replaces the header rather than shifting layout.
 * - Uses the terminal aesthetic (black bg, white text, purple accent
 *   border) to match the ProxyTabBar and the rest of the in-proxy chrome.
 * - Polls `registration.update()` every 5 minutes. Browsers only fire
 *   `updatefound` on their own ~24h schedule, so without polling a
 *   deployment wouldn't surface the banner until the next day.
 * - On reload, posts `skipWaiting` to the waiting SW so the new version
 *   activates immediately (rather than on the *next* navigation).
 *
 * This component renders null when no update is pending, so it adds zero
 * DOM weight to the normal browsing experience.
 */

const AUTO_DISMISS_MS = 30_000;
const POLL_INTERVAL_MS = 5 * 60_000; // 5 minutes

export function SwUpdateBanner() {
  const [visible, setVisible] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;
    let updateTimer: ReturnType<typeof setInterval> | null = null;
    let registration: ServiceWorkerRegistration | null = null;

    const armAutoDismiss = () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => {
        if (!cancelled) setVisible(false);
      }, AUTO_DISMISS_MS);
    };

    const showBanner = () => {
      if (cancelled) return;
      setVisible(true);
      armAutoDismiss();
    };

    // Fires when the state of a SW (installing → installed → activating →
    // activated) changes. We only care about the installed transition of
    // a NEW worker while an existing controller is active — that's the
    // definition of "an update is ready".
    const onStateChange = (e: Event) => {
      const sw = e.target as ServiceWorker | null;
      if (!sw) return;
      if (
        sw.state === "installed" &&
        navigator.serviceWorker.controller
      ) {
        showBanner();
      }
    };

    const onUpdateFound = () => {
      const installing = registration?.installing;
      if (!installing) return;
      // The statechange listener is attached to the specific worker that
      // triggered updatefound. Re-attaching on every updatefound is safe
      // (addEventListener is idempotent for the same fn reference, and we
      // pass a fresh closure each time so we just rely on GC of the old
      // worker to drop the previous listener).
      installing.addEventListener("statechange", onStateChange);
    };

    const setup = async () => {
      try {
        registration = await navigator.serviceWorker.getRegistration();
      } catch {
        return;
      }
      if (cancelled || !registration) return;

      // If a new SW is already waiting (e.g. the user reloaded while a
      // new SW was mid-install), show the banner immediately rather than
      // waiting for the next updatefound.
      if (registration.waiting && navigator.serviceWorker.controller) {
        showBanner();
      }

      registration.addEventListener("updatefound", onUpdateFound);

      // Poll for updates — see component docstring.
      updateTimer = setInterval(() => {
        if (cancelled || !registration) return;
        registration.update().catch(() => {
          /* ignore — offline or transient */
        });
      }, POLL_INTERVAL_MS);
    };

    setup();

    return () => {
      cancelled = true;
      if (registration) {
        registration.removeEventListener("updatefound", onUpdateFound);
        const installing = registration.installing;
        if (installing) {
          installing.removeEventListener("statechange", onStateChange);
        }
      }
      if (updateTimer) clearInterval(updateTimer);
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, []);

  const handleReload = () => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    // Post skipWaiting to the waiting/installing SW so the new version
    // takes over immediately on reload. This is a no-op if the new SW
    // already called skipWaiting from inside its own execution context.
    try {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) reg.waiting.postMessage("skipWaiting");
        if (reg?.installing) reg.installing.postMessage("skipWaiting");
      });
    } catch {
      /* ignore — reload alone will still activate the new SW on next load */
    }
    window.location.reload();
  };

  const handleDismiss = () => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-0 right-0 top-0 z-[60] flex h-12 items-center justify-between gap-3 border-b border-purple-500/60 bg-black px-4 text-white shadow-lg"
    >
      <div className="flex min-w-0 items-center gap-2 text-xs sm:text-sm">
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-purple-400">
          [update]
        </span>
        <span className="truncate font-medium">
          A new version of Hypers0nic is available.
        </span>
        <button
          type="button"
          onClick={handleReload}
          className="ml-1 inline-flex shrink-0 items-center gap-1.5 rounded border border-purple-500/60 bg-purple-500/15 px-2 py-0.5 text-xs font-semibold text-purple-300 transition-colors hover:bg-purple-500/25 hover:text-purple-200"
        >
          <RefreshCw className="size-3" />
          Reload to update
        </button>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss update notification"
        className="shrink-0 text-white/60 transition-colors hover:text-white"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
