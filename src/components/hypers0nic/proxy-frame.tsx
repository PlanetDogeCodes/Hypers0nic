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
  const tabCount = useHypers0nic((s) => s.tabs.length);
  const updateTabUrl = useHypers0nic((s) => s.updateTabUrl);
  const setTabTitle = useHypers0nic((s) => s.setTabTitle);
  const setOmnibox = useHypers0nic((s) => s.setOmnibox);
  const [mounted, setMounted] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameRef = useRef<{ go: (u: string) => void; back: () => void; forward: () => void; reload: () => void; addEventListener: (t: string, fn: (e: any) => void) => void; removeEventListener: (t: string, fn: (e: any) => void) => void } | null>(null);
  const [status, setStatus] = useState<FrameStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const omniboxRef = useRef(omniboxValue);
  const settledRef = useRef(true);
  const recordedRef = useRef(true);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    omniboxRef.current = omniboxValue;
  }, [omniboxValue]);

  const ready = scramjet.status === "ready" && proxyReady;

  const recordCurrent = useCallback((url: string) => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    try {
      const frame = frameRef.current as any;
      const title = frame?.title || iframeRef.current?.contentDocument?.title || "";
      if (title && url) recordVisit(url, title);

      const tabId = useHypers0nic.getState().activeTabId;
      if (tabId) {
        if (title) setTabTitle(tabId, title);
        updateTabUrl(tabId, url);
      }
    } catch {

    }
  }, [recordVisit, setTabTitle, updateTabUrl]);

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

  useEffect(() => {
    if (!ready || !frameRef.current) return;
    const url = omniboxRef.current;
    if (!url) return;

    beginNavigation();

    let retried = false;
    const tryNavigate = async () => {
      const sj = getScramjet();
      try {
        if (sj.getState().status !== "ready") {
          await sj.init(useHypers0nic.getState().settings.wispUrl);
        }
      } catch (e) {
        console.warn("[hypers0nic] pre-nav init error:", e);
      }
      try {
        frameRef.current.go(url);
      } catch (err) {
        if (!retried) {
          retried = true;
          sj.forceReconnectAndWait(useHypers0nic.getState().settings.wispUrl)
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

  useEffect(() => {
    return () => {
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    };
  }, []);

  const hasTabBar = tabCount >= 1;
  const containerHeight = mounted && topBarAlwaysVisible
    ? hasTabBar
      ? "h-[calc(100vh-5rem)]"
      : "h-[calc(100vh-3rem)]"
    : "h-screen";

  return (
    <div className={"flex flex-col " + containerHeight}>
      <ProxyToolbar status={status} />
      <div className="relative flex-1 bg-background">
        {status === "loading" && (
          <div className="absolute inset-0 z-10 overflow-hidden bg-background">
            <div className="mx-auto max-w-4xl space-y-4 p-6">
              <div className="flex items-center gap-3">
                {(() => {
                  try {
                    const targetUrl = omniboxRef.current;
                    if (targetUrl) {
                      const hostname = new URL(targetUrl).hostname;
                      const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
                      return (
                        <img
                          src={faviconUrl}
                          alt=""
                          className="size-8 rounded-md bg-muted/30"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      );
                    }
                  } catch {}
                  return <div className="skeleton-block h-8 w-8 rounded-full" />;
                })()}
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
              <div className="flex flex-col justify-center gap-2">
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => {
                      const sj = getScramjet();
                      setStatus("loading");
                      setError(null);
                      sj.forceReconnectAndWait(useHypers0nic.getState().settings.wispUrl)
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
                <button
                  onClick={() => {
                    const sj = getScramjet();
                    setStatus("loading");
                    setError(null);

                    useHypers0nic.getState().setWispUrl("");
                    sj.forceReconnectAndWait("").then(() => {
                      if (frameRef.current && omniboxRef.current) {
                        settledRef.current = false;
                        recordedRef.current = false;
                        beginNavigation();
                        try {
                          frameRef.current.go(omniboxRef.current);
                        } catch {}
                      }
                    }).catch(() => setStatus("error"));
                  }}
                  className="rounded border border-border/60 px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Try a different relay
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

            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-storage-access-by-user-activation"
            allow="fullscreen; autoplay; encrypted-media; clipboard-read; clipboard-write; picture-in-picture; web-share; gamepad; gyroscope; accelerometer"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>
    </div>
  );
}
