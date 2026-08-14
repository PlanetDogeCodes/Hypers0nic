"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getScramjet } from "@/lib/scramjet";
import { useHypers0nic } from "@/store/hypers0nic";
import { ProxyToolbar } from "./proxy-toolbar";
import { Loader2, AlertTriangle, Globe } from "lucide-react";

type FrameStatus = "loading" | "loaded" | "error";

export function ProxyFrame() {
  const omniboxValue = useHypers0nic((s) => s.omniboxValue);
  const navNonce = useHypers0nic((s) => s.navNonce);
  const scramjet = useHypers0nic((s) => s.scramjet);
  const proxyReady = useHypers0nic((s) => s.proxyReady);
  const recordVisit = useHypers0nic((s) => s.recordVisit);
  const topBarAlwaysVisible = useHypers0nic((s) => s.settings.preferences.topBarAlwaysVisible);
  const tabsCount = useHypers0nic((s) => s.tabs.length);
  const setOmnibox = useHypers0nic((s) => s.setOmnibox);
  const [mounted, setMounted] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameRef = useRef<{ go: (u: string) => void; back: () => void; forward: () => void; reload: () => void; addEventListener: (t: string, fn: (e: any) => void) => void; removeEventListener: (t: string, fn: (e: any) => void) => void } | null>(null);
  const [status, setStatus] = useState<FrameStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  // --- refs that decouple navigation from React state ---
  //
  // omniboxRef: always holds the latest omniboxValue. Used inside the load
  //   handler so we don't need omniboxValue in the load effect's dependency
  //   array (which would reset the "settled" guard on every urlchange).
  //
  // settledRef: true once a navigation's load event (or safety timeout) has
  //   fired. Prevents duplicate recordVisit calls and duplicate status flips.
  //   Reset to false at the start of every navigation (go/back/forward/reload).
  //
  // recordedRef: ensures recordVisit is called exactly once per navigation.
  //
  // safetyTimeoutRef: the 12-second fallback timer. Cleared when the load
  //   event fires. Some sites (streaming/long-poll) delay the load event.
  const omniboxRef = useRef(omniboxValue);
  const settledRef = useRef(true);
  const recordedRef = useRef(true);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keep omniboxRef in sync with the store. This runs as its own effect so the
  // nav effect (below) can depend on navNonce alone — urlchange-driven
  // omniboxValue updates update the ref but do NOT re-trigger frame.go().
  useEffect(() => {
    omniboxRef.current = omniboxValue;
  }, [omniboxValue]);

  // The iframe may only mount once BOTH the Scramjet controller has booted AND
  // the service worker is actively controlling the page.
  const ready = scramjet.status === "ready" && proxyReady;

  // Record the current navigation in history. Guarded by recordedRef so it
  // is called exactly once per navigation — either from the iframe load event
  // (user-initiated) or from the urlchange handler (link-click/redirect whose
  // load event was skipped by the settled guard).
  const recordCurrent = useCallback((url: string) => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    try {
      const frame = frameRef.current as any;
      const title = frame?.title || iframeRef.current?.contentDocument?.title || "";
      if (title && url) recordVisit(url, title);
    } catch {
      /* cross-origin reads throw — Scramjet handles title via events */
    }
  }, [recordVisit]);

  // Mark a navigation as in-flight: reset guards, flip UI to loading, arm
  // the safety timeout. Also clears any previous error state so the user
  // doesn't see a stale error message from a failed navigation.
  // Safety timeout is 20 seconds — some proxied sites legitimately take
  // 15+ seconds to load (especially through a wisp relay).
  const beginNavigation = useCallback(() => {
    settledRef.current = false;
    recordedRef.current = false;
    setStatus("loading");
    setError(null);
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    safetyTimeoutRef.current = setTimeout(() => {
      if (settledRef.current) return;
      settledRef.current = true;
      setStatus("loaded");
      recordCurrent(omniboxRef.current);
    }, 20000);
  }, [recordCurrent]);

  // Subscribe to the ScramjetFrame once it exists. All state updates happen in
  // event callbacks (not the effect body), which keeps renders cascade-free.
  useEffect(() => {
    if (!ready || !iframeRef.current) return;
    const sj = getScramjet();
    let frame: typeof frameRef.current = null;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const tryCreateFrame = (attempt: number) => {
      if (cancelled) return;
      try {
        frame = sj.createFrame(iframeRef.current);
        frameRef.current = frame;
        setupFrameListeners();
      } catch (err) {
        if (attempt < 3 && !cancelled) {
          retryTimer = setTimeout(() => tryCreateFrame(attempt + 1), 500 * (attempt + 1));
        } else if (!cancelled) {
          // All retries failed — fall back to setting the iframe src directly
          // to the encoded proxy URL. The SW will still intercept /service/*
          // requests, so the content will load (just without the ScramjetFrame
          // API for back/forward/urlchange events).
          try {
            const encoded = sj.encodeUrl(omniboxRef.current);
            if (iframeRef.current && encoded) {
              iframeRef.current.src = encoded;
            }
          } catch {
            const message = err instanceof Error ? err.message : String(err);
            queueMicrotask(() => {
              setError(message);
              setStatus("error");
            });
          }
        }
      }
    };

    const setupFrameListeners = () => {
      if (!frame || cancelled) return;

      // urlchange / navigate events fire when Scramjet itself moves the
      // iframe (link click, redirect, pushState, back/forward, or our own
      // frame.go call). We update the omnibox DISPLAY only — we deliberately
      // do NOT call frame.go() here, because the iframe has already moved.
      // The navigation effect below depends on navNonce (which only bumps on
      // user-initiated navigate()), so this setOmnibox call will NOT cause a
      // reload. This is the fix for "loads quickly, then unloads and reloads".
      //
      // Additionally, if the load event already fired (settledRef is true)
      // but we haven't recorded the visit yet (recordedRef is false), this is
      // a link-click/redirect whose load event was skipped by the settled
      // guard. Record it now using the canonical urlchange URL.
      const onUrlChange = function (e: any) {
        const url = typeof e.url === "string" ? e.url : (e.url && e.url.href) || "";
        if (url) {
          setOmnibox(url);
          if (settledRef.current) recordCurrent(url);
        }
      };
      const onNavigate = function (e: any) {
        const url = typeof e.url === "string" ? e.url : (e.url && e.url.href) || "";
        if (url) {
          setOmnibox(url);
          if (settledRef.current) recordCurrent(url);
        }
      };

      frame.addEventListener("urlchange", onUrlChange);
      frame.addEventListener("navigate", onNavigate);

      frame._onUrlChange = onUrlChange;
      frame._onNavigate = onNavigate;
    };

    tryCreateFrame(0);

    return function () {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (frame) {
        try {
          if (frame._onUrlChange) frame.removeEventListener("urlchange", frame._onUrlChange);
          if (frame._onNavigate) frame.removeEventListener("navigate", frame._onNavigate);
        } catch (e) {}
      }
    };
  }, [ready, setOmnibox, recordCurrent]);

  // Drive navigation when the USER initiates one (navNonce bumps). We
  // intentionally do NOT depend on omniboxValue here: Scramjet's urlchange
  // event updates omniboxValue (via setOmnibox) after every load, and if this
  // effect depended on omniboxValue it would re-fire frame.go() — causing the
  // "loads quickly, then unloads and reloads" bug. The URL to navigate to is
  // read from omniboxRef.current, which is kept in sync by the effect above.
  useEffect(() => {
    if (!ready || !frameRef.current) return;
    const url = omniboxRef.current;
    if (!url) return;

    beginNavigation();

    // Auto-retry with force-reconnect on navigation failure. If frame.go()
    // throws (dead transport, controller issue), we force-reconnect the
    // Scramjet manager, wait for re-init, and retry the navigation once.
    let retried = false;
    const tryNavigate = () => {
      try {
        frameRef.current.go(url);
      } catch (err) {
        if (!retried) {
          retried = true;
          const sj = getScramjet();
          sj.forceReconnect();
          // Re-init and retry after a short delay.
          sj.init(useHypers0nic.getState().settings.wispUrl)
            .then(() => {
              try {
                frameRef.current?.go(url);
              } catch (err2) {
                showError(err2);
              }
            })
            .catch(() => showError(err));
        } else {
          showError(err);
        }
      }
    };

    const showError = (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      settledRef.current = true;
      setError(message);
      setStatus("error");
    };

    tryNavigate();
  }, [navNonce, ready, beginNavigation]);

  // Listen for back/forward/reload commands dispatched by the store.
  // These reset the settled guard so the subsequent load event is not skipped.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { action: string };
      const frame = frameRef.current;
      if (!frame) return;
      try {
        if (detail.action === "back") {
          beginNavigation();
          frame.back();
        } else if (detail.action === "forward") {
          beginNavigation();
          frame.forward();
        } else if (detail.action === "reload") {
          beginNavigation();
          frame.reload();
        }
      } catch (err) {
        console.error("[hypers0nic] navigation action failed:", err);
      }
    };
    window.addEventListener("hypers0nic:navigate", handler);
    return () => window.removeEventListener("hypers0nic:navigate", handler);
  }, [beginNavigation]);

  // Single load listener, set up once when the iframe mounts. It does NOT
  // depend on omniboxValue, so urlchange-driven omnibox updates don't tear
  // down and re-create the listener. The URL for recordVisit is read from
  // omniboxRef.current.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onLoad = () => {
      if (settledRef.current) return;
      settledRef.current = true;
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      setStatus("loaded");
      recordCurrent(omniboxRef.current);
    };
    iframe.addEventListener("load", onLoad);
    return () => {
      iframe.removeEventListener("load", onLoad);
    };
  }, [recordVisit, recordCurrent]);

  // Clear the safety timeout on unmount.
  useEffect(() => {
    return () => {
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    };
  }, []);

  // Height: account for header (3rem when visible) and tab bar (2rem when
  // 2+ tabs). Use inline style because Tailwind can't JIT dynamic class names.
  const headerH = mounted && topBarAlwaysVisible ? 3 : 0;
  const tabH = mounted && tabsCount > 1 ? 2 : 0;
  const totalH = headerH + tabH;
  const frameHeight = totalH > 0 ? `calc(100vh - ${totalH}rem)` : "100vh";

  return (
    <div className="flex flex-col" style={{ height: frameHeight }}>
      <ProxyToolbar status={status} />
      <div className="relative flex-1 bg-background">
        {status === "loading" && (
          <div className="absolute inset-0 z-10 overflow-hidden bg-background">
            {/* Skeleton loader — plain divs (not motion.div) prevent the
                "Cannot read properties of null (reading 'removeChild')" error
                that occurs when a motion component is mid-exit animation and
                the parent unmounts (e.g. rapid navigation). The skeleton-block
                class has its own CSS animation, so no JS animation needed. */}
            <div className="mx-auto max-w-4xl space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="skeleton-block h-8 w-8 rounded-full" />
                <div className="skeleton-block h-6 flex-1 rounded-md" />
                <div className="skeleton-block h-8 w-20 rounded-md" />
              </div>
              <div className="space-y-2">
                <div className="skeleton-block h-8 w-2/3 rounded-lg" />
                <div className="skeleton-block h-4 w-full rounded-md" />
                <div className="skeleton-block h-4 w-5/6 rounded-md" />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 sm:grid-cols-3">
                <div className="skeleton-block h-32 rounded-xl" />
                <div className="skeleton-block h-32 rounded-xl" />
                <div className="skeleton-block hidden h-32 rounded-xl sm:block" />
              </div>
              <div className="space-y-2 pt-2">
                <div className="skeleton-block h-4 w-full rounded-md" />
                <div className="skeleton-block h-4 w-4/5 rounded-md" />
                <div className="skeleton-block h-4 w-3/4 rounded-md" />
              </div>
            </div>
            {/* Floating status pill */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-card/80 px-4 py-2 text-sm shadow-lg backdrop-blur-md">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span className="font-medium text-foreground">Routing through Scramjet…</span>
              </div>
            </div>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
            <div className="max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
              <AlertTriangle className="mx-auto mb-3 size-8 text-destructive" />
              <h3 className="mb-1 font-semibold text-foreground">
                Couldn&apos;t load this page
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                {error ||
                  "The proxy transport rejected the request. Check your wisp relay setting or try again."}
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => {
                    const sj = getScramjet();
                    sj.forceReconnect();
                    setStatus("loading");
                    setError(null);
                    sj.init(useHypers0nic.getState().settings.wispUrl)
                      .then(() => {
                        if (frameRef.current && omniboxRef.current) {
                          settledRef.current = false;
                          recordedRef.current = false;
                          beginNavigation();
                          try {
                            frameRef.current.go(omniboxRef.current);
                          } catch {}
                        }
                      })
                      .catch(() => setStatus("error"));
                  }}
                  className="rounded border border-primary bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  Retry
                </button>
                <button
                  onClick={() => useHypers0nic.getState().goHome()}
                  className="rounded border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Home
                </button>
              </div>
            </div>
          </div>
        )}
        {!ready ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Globe className="size-8 text-primary" />
              <p className="text-sm">Preparing the proxy…</p>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            title="Proxied content"
            className="size-full border-0 bg-white"
            // `allow-same-origin` is REQUIRED for YouTube, Twitch, and most
            // modern SPAs — their player APIs and login flows need to access
            // document.cookie, localStorage, and same-origin APIs. Without it,
            // YouTube's player throws "Blocked a frame with origin..." and
            // Twitch's video never initializes.
            //
            // `allow-popups` lets proxied sites open new windows/popups.
            // `allow-presentation` enables casting / PiP on video sites.
            // `allow-storage-access-by-user-activation` allows 3rd-party cookie
            // access prompts (used by some Google sign-in flows).
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-storage-access-by-user-activation"
            allow="fullscreen; autoplay; encrypted-media; clipboard-read; clipboard-write; picture-in-picture; web-share; gamepad; gyroscope; accelerometer"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>
    </div>
  );
}
