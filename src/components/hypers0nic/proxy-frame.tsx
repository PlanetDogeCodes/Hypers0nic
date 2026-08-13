"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getScramjet } from "@/lib/scramjet";
import { useHypers0nic } from "@/store/hypers0nic";
import { ProxyToolbar } from "./proxy-toolbar";
import { Loader2, AlertTriangle, Globe } from "lucide-react";

type FrameStatus = "loading" | "loaded" | "error";

/**
 * ProxyFrame renders a single proxy tab's iframe + (when active) the proxy
 * toolbar. Each open tab gets its own ProxyFrame instance, keyed by tabId in
 * the parent AppShell. Inactive ProxyFrames stay mounted (their iframes keep
 * their loaded state across tab switches) but are visually hidden via a
 * wrapper div with `display: none`.
 *
 * All navigation state is read from the tab's own slice of the store:
 *   - tab.url        drives the URL ref used by the load handler
 *   - tab.navNonce   drives the navigation effect (frame.go)
 *
 * Global store values (omniboxValue, global navNonce) are intentionally NOT
 * used here — they would cause every mounted ProxyFrame to navigate in lock
 * step, defeating the multi-tab model.
 */
export function ProxyFrame({ tabId }: { tabId: string }) {
  // Read this tab's slice of the store. `find` returns undefined if the tab
  // was just closed (the ProxyFrame unmounts immediately via key change, but
  // this guards the brief transition).
  const tab = useHypers0nic((s) => s.tabs.find((t) => t.id === tabId));
  const activeTabId = useHypers0nic((s) => s.activeTabId);
  const isActive = activeTabId === tabId;

  const scramjet = useHypers0nic((s) => s.scramjet);
  const proxyReady = useHypers0nic((s) => s.proxyReady);
  const recordVisit = useHypers0nic((s) => s.recordVisit);
  const topBarAlwaysVisible = useHypers0nic((s) => s.settings.preferences.topBarAlwaysVisible);
const tabsCount = useHypers0nic((s) => s.tabs.length);
  const setTabTitle = useHypers0nic((s) => s.setTabTitle);
  const updateTabUrl = useHypers0nic((s) => s.updateTabUrl);
  const setTabLoading = useHypers0nic((s) => s.setTabLoading);
  const [mounted, setMounted] = useState(false);

  // Derive URL + per-tab navNonce from the tab object. Fall back to empty/0
  // when the tab is missing (shouldn't happen in practice — ProxyFrame is
  // keyed by tab.id and unmounts when the tab is removed).
  const tabUrl = tab?.url ?? "";
  const tabNavNonce = tab?.navNonce ?? 0;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameRef = useRef<{ go: (u: string) => void; back: () => void; forward: () => void; reload: () => void; addEventListener: (t: string, fn: (e: any) => void) => void; removeEventListener: (t: string, fn: (e: any) => void) => void } | null>(null);
  const [status, setStatus] = useState<FrameStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  // True while the navigation effect is in its exponential-backoff retry
  // loop. Drives the "Retrying…" copy in the loading overlay so the user
  // can see the proxy is recovering rather than hung. Cleared on the
  // iframe load event, the safety timeout, the error UI, or unmount.
  const [retrying, setRetrying] = useState(false);

  // --- refs that decouple navigation from React state ---
  //
  // urlRef: always holds the latest tab URL. Used inside the load handler so
  //   we don't need tabUrl in the load effect's dependency array (which would
  //   reset the "settled" guard on every urlchange).
  //
  // settledRef: true once a navigation's load event (or safety timeout) has
  //   fired. Prevents duplicate recordVisit calls and duplicate status flips.
  //   Reset to false at the start of every navigation (go/back/forward/reload).
  //
  // recordedRef: ensures recordVisit is called exactly once per navigation.
  //
  // safetyTimeoutRef: the 20-second fallback timer. Cleared when the load
  //   event fires. Some sites (streaming/long-poll) delay the load event.
  //
  // backoffRetryRef: tracks the current exponential-backoff retry attempt
  //   within the navigation effect. Reset to 0 at the start of every
  //   navigation. Prevents overlapping retries: each retry increments it,
  //   and once it exceeds BACKOFF_DELAYS.length the error UI is shown.
  const urlRef = useRef(tabUrl);
  const settledRef = useRef(true);
  const recordedRef = useRef(true);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRetryRef = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keep urlRef in sync with the store. This runs as its own effect so the
  // nav effect (below) can depend on tabNavNonce alone — urlchange-driven
  // tab URL updates update the ref but do NOT re-trigger frame.go().
  useEffect(() => {
    urlRef.current = tabUrl;
  }, [tabUrl]);

  // The iframe may only mount once BOTH the Scramjet controller has booted AND
  // the service worker is actively controlling the page.
  const ready = scramjet.status === "ready" && proxyReady;

  // Record the current navigation in history AND sync the tab's title. Guarded
  // by recordedRef so it is called exactly once per navigation — either from
  // the iframe load event (user-initiated) or from the urlchange handler
  // (link-click/redirect whose load event was skipped by the settled guard).
  const recordCurrent = useCallback(
    (url: string) => {
      if (recordedRef.current) return;
      recordedRef.current = true;
      try {
        const frame = frameRef.current as any;
        const title = frame?.title || iframeRef.current?.contentDocument?.title || "";
        if (title && url) {
          recordVisit(url, title);
          setTabTitle(tabId, title);
        }
      } catch {
        /* cross-origin reads throw — Scramjet handles title via events */
      }
    },
    [recordVisit, setTabTitle, tabId]
  );

  // Mark a navigation as in-flight: reset guards, flip UI to loading, arm
  // the safety timeout, and mark this tab as loading in the store (so the
  // ProxyTabBar can show a spinner). Also clears any previous error state so
  // the user doesn't see a stale error message from a failed navigation.
  // Safety timeout is 20 seconds — some proxied sites legitimately take
  // 15+ seconds to load (especially through a wisp relay).
  //
  // This also resets the backoff retry counter and clears the "Retrying…"
  // flag — every fresh navigation starts from a clean retry slate.
  const beginNavigation = useCallback(() => {
    settledRef.current = false;
    recordedRef.current = false;
    backoffRetryRef.current = 0;
    setRetrying(false);
    setStatus("loading");
    setError(null);
    setTabLoading(tabId, true);
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    safetyTimeoutRef.current = setTimeout(() => {
      if (settledRef.current) return;
      settledRef.current = true;
      setStatus("loaded");
      setRetrying(false);
      setTabLoading(tabId, false);
      recordCurrent(urlRef.current);
    }, 20000);
  }, [recordCurrent, setTabLoading, tabId]);

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
            const encoded = sj.encodeUrl(urlRef.current);
            if (iframeRef.current && encoded) {
              iframeRef.current.src = encoded;
            }
          } catch {
            const message = err instanceof Error ? err.message : String(err);
            queueMicrotask(() => {
              setError(message);
              setStatus("error");
              setTabLoading(tabId, false);
            });
          }
        }
      }
    };

    const setupFrameListeners = () => {
      if (!frame || cancelled) return;

      // urlchange / navigate events fire when Scramjet itself moves the
      // iframe (link click, redirect, pushState, back/forward, or our own
      // frame.go call). We update the tab's URL (and the omnibox if this is
      // the active tab) via updateTabUrl — we deliberately do NOT call
      // frame.go() here, because the iframe has already moved. The navigation
      // effect below depends on tabNavNonce (which only bumps on
      // user-initiated navigate()), so this updateTabUrl call will NOT cause
      // a reload. This is the fix for "loads quickly, then unloads and
      // reloads".
      //
      // Additionally, if the load event already fired (settledRef is true)
      // but we haven't recorded the visit yet (recordedRef is false), this is
      // a link-click/redirect whose load event was skipped by the settled
      // guard. Record it now using the canonical urlchange URL.
      const onUrlChange = function (e: any) {
        const url = typeof e.url === "string" ? e.url : (e.url && e.url.href) || "";
        if (url) {
          updateTabUrl(tabId, url);
          if (settledRef.current) recordCurrent(url);
        }
      };
      const onNavigate = function (e: any) {
        const url = typeof e.url === "string" ? e.url : (e.url && e.url.href) || "";
        if (url) {
          updateTabUrl(tabId, url);
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
  }, [ready, updateTabUrl, recordCurrent, tabId, setTabLoading]);

  // Drive navigation when the USER initiates one (tabNavNonce bumps). We
  // intentionally do NOT depend on tabUrl here: Scramjet's urlchange event
  // updates the tab's URL via updateTabUrl after every load, and if this
  // effect depended on tabUrl it would re-fire frame.go() — causing the
  // "loads quickly, then unloads and reloads" bug. The URL to navigate to is
  // read from urlRef.current, which is kept in sync by the effect above.
  //
  // Retry strategy (Task 4 — reliability):
  //   1. Initial attempt: frameRef.current.go(url).
  //   2. On throw: force-reconnect + re-init + retry once (existing logic).
  //   3. If the force-reconnect retry ALSO throws: exponential backoff with
  //      delays [1s, 2s, 4s, 8s] — max 4 retries. The "Retrying…" overlay
  //      copy is shown during this phase.
  //   4. If all backoff retries fail, show the error UI (Retry/Home buttons).
  //
  // Overlap prevention: a `cancelled` flag (local to this effect closure) is
  // set in the cleanup function. Every retry step checks it before
  // proceeding, so a rapid tabNavNonce bump (e.g. user hits Enter twice)
  // won't leave zombie retries running in the background. The
  // `backoffRetryRef` ref additionally tracks the retry attempt index
  // across the setTimeout chain.
  useEffect(() => {
    if (!ready || !frameRef.current) return;
    const url = urlRef.current;
    if (!url) return;

    beginNavigation();

    let cancelled = false;
    let backoffTimer: ReturnType<typeof setTimeout> | null = null;
    // Exponential backoff schedule (Task 4). 4 retries at 1s/2s/4s/8s.
    // The first retry is the existing force-reconnect attempt (not in
    // this array); these are the *fallback* retries that kick in only if
    // force-reconnect also fails.
    const BACKOFF_DELAYS = [1000, 2000, 4000, 8000];
    // Tracks whether the force-reconnect retry has been consumed. Local
    // to this effect so it resets on every new navigation.
    let forceReconnectDone = false;

    const showError = (err: unknown) => {
      if (cancelled) return;
      const message = err instanceof Error ? err.message : String(err);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      settledRef.current = true;
      setRetrying(false);
      setTabLoading(tabId, false);
      setError(message);
      setStatus("error");
    };

    // Kick off the exponential-backoff retry chain. Called when the
    // initial attempt AND the force-reconnect retry have both thrown.
    // Schedules the next attempt after BACKOFF_DELAYS[attempt] ms; if all
    // delays are exhausted, shows the error UI.
    const startBackoff = (err: unknown) => {
      if (cancelled) return;
      const attempt = backoffRetryRef.current;
      if (attempt >= BACKOFF_DELAYS.length) {
        // All retries exhausted — surface the error to the user.
        showError(err);
        return;
      }
      // Flip the loading overlay to "Retrying…" so the user knows the
      // proxy is recovering rather than hung. Cleared on success (load
      // event / safety timeout), on error, or on the next navigation.
      setRetrying(true);
      const delay = BACKOFF_DELAYS[attempt];
      backoffRetryRef.current = attempt + 1;
      backoffTimer = setTimeout(() => {
        if (cancelled) return;
        try {
          frameRef.current?.go(url);
          // If go() didn't throw, we're in flight. The "Retrying…" badge
          // stays up until the load event fires (or the safety timeout
          // resolves the navigation). Don't clear retrying here — the
          // load handler / safety timeout owns that.
        } catch (err2) {
          // This backoff retry failed — schedule the next one.
          startBackoff(err2);
        }
      }, delay);
    };

    const tryNavigate = () => {
      if (cancelled) return;
      try {
        frameRef.current.go(url);
      } catch (err) {
        // First retry strategy: force-reconnect + re-init + retry once.
        // This is the existing recovery path — kept as the FIRST retry
        // per Task 4 spec.
        if (!forceReconnectDone) {
          forceReconnectDone = true;
          const sj = getScramjet();
          sj.forceReconnect();
          sj.init(useHypers0nic.getState().settings.wispUrl)
            .then(() => {
              if (cancelled) return;
              try {
                frameRef.current?.go(url);
              } catch (err2) {
                // Force-reconnect retry failed — kick off backoff.
                startBackoff(err2);
              }
            })
            .catch((err2) => {
              if (cancelled) return;
              startBackoff(err2);
            });
        } else {
          // Force-reconnect already consumed — go straight to backoff.
          startBackoff(err);
        }
      }
    };

    tryNavigate();

    return () => {
      // Cancel any in-flight retry chain. The next navigation's effect
      // run will reset backoffRetryRef via beginNavigation().
      cancelled = true;
      if (backoffTimer) clearTimeout(backoffTimer);
    };
  }, [tabNavNonce, ready, beginNavigation, tabId, setTabLoading]);

  // Listen for back/forward/reload commands dispatched by the store. The
  // event includes the active tab's id — only the active ProxyFrame acts on
  // it. Other tabs' ProxyFrames ignore the event (their iframes aren't
  // visible, so navigating them would be wasted work).
  // These reset the settled guard so the subsequent load event is not skipped.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { action: string; tabId?: string | null };
      // Scope to this tab — only the active tab's ProxyFrame should act.
      if (detail.tabId && detail.tabId !== tabId) return;
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
  }, [beginNavigation, tabId]);

  // Single load listener, set up once when the iframe mounts. It does NOT
  // depend on tabUrl, so urlchange-driven URL updates don't tear down and
  // re-create the listener. The URL for recordVisit is read from urlRef.current.
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
      // Clear the "Retrying…" badge — the navigation succeeded.
      setRetrying(false);
      setStatus("loaded");
      setTabLoading(tabId, false);
      recordCurrent(urlRef.current);
    };
    iframe.addEventListener("load", onLoad);
    return () => {
      iframe.removeEventListener("load", onLoad);
    };
  }, [recordVisit, recordCurrent, setTabLoading, tabId]);

  // Clear the safety timeout on unmount and clear this tab's loading flag.
  useEffect(() => {
    return () => {
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      setTabLoading(tabId, false);
    };
  }, [tabId, setTabLoading]);
// Height: subtract header (3rem) and tab bar (~2rem when 2+ tabs) from
// the viewport height. We use inline styles because Tailwind's JIT can't
// detect dynamically constructed class names (h-[calc(100vh-Xrem)]).
const headerHeight = mounted && topBarAlwaysVisible ? 3 : 0; // rem
const tabBarHeight = mounted && topBarAlwaysVisible && tabsCount > 1 ? 2 : 0; // rem
const totalOffsetRem = headerHeight + tabBarHeight;
const frameHeight = totalOffsetRem > 0 ? `calc(100vh - ${totalOffsetRem}rem)` : "100vh";

return (
  <div className="flex flex-col" style={{ height: frameHeight }}>
      {/* Only render the toolbar for the active tab. This avoids duplicate
          #proxy-toolbar IDs (which would break the hover-reveal logic in
          ProxyToolbar that uses getElementById) and saves the work of
          mounting Omnibox instances for hidden tabs. */}
      {isActive && <ProxyToolbar status={status} />}
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
            {/* Floating status pill. Swaps copy to "Retrying…" when the
                exponential-backoff loop is running (Task 4) so the user
                can tell the proxy is recovering rather than hung. */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-card/80 px-4 py-2 text-sm shadow-lg backdrop-blur-md">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span className="font-medium text-foreground">
                  {retrying ? "Retrying…" : "Routing through Scramjet…"}
                </span>
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
                    setTabLoading(tabId, true);
                    sj.init(useHypers0nic.getState().settings.wispUrl)
                      .then(() => {
                        if (frameRef.current && urlRef.current) {
                          settledRef.current = false;
                          recordedRef.current = false;
                          beginNavigation();
                          try {
                            frameRef.current.go(urlRef.current);
                          } catch {}
                        }
                      })
                      .catch(() => {
                        setStatus("error");
                        setTabLoading(tabId, false);
                      });
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
            data-tab-id={tabId}
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
