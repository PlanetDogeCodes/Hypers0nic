"use client";

import { useEffect, useRef, useState } from "react";
import { getScramjet } from "@/lib/scramjet";
import { useHypers0nic } from "@/store/hypers0nic";
import { ProxyToolbar } from "./proxy-toolbar";
import { Loader2, AlertTriangle, Globe } from "lucide-react";
import { motion } from "framer-motion";

type FrameStatus = "loading" | "loaded" | "error";

export function ProxyFrame() {
  const omniboxValue = useHypers0nic((s) => s.omniboxValue);
  const scramjet = useHypers0nic((s) => s.scramjet);
  const proxyReady = useHypers0nic((s) => s.proxyReady);
  const recordVisit = useHypers0nic((s) => s.recordVisit);
  const topBarAlwaysVisible = useHypers0nic((s) => s.settings.preferences.topBarAlwaysVisible);
  const [mounted, setMounted] = useState(false);
  const setOmnibox = useHypers0nic((s) => s.setOmnibox);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  // ScramjetFrame instance. Kept in a ref because it is not React state.
  const frameRef = useRef<{ go: (u: string) => void; back: () => void; forward: () => void; reload: () => void; addEventListener: (t: string, fn: (e: any) => void) => void; removeEventListener: (t: string, fn: (e: any) => void) => void } | null>(null);
  const [status, setStatus] = useState<FrameStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // The iframe may only mount once BOTH the Scramjet controller has booted AND
  // the service worker is actively controlling the page. Mounting earlier lets
  // the first /service/* navigation slip past the SW and load the app shell.
  const ready = scramjet.status === "ready" && proxyReady;

  // Subscribe to the ScramjetFrame once it exists. All state updates happen in
  // event callbacks (not the effect body), which keeps renders cascade-free.
  // If createFrame fails, we retry up to 3 times with a delay before showing
  // an error — this handles the race where the controller is technically
  // "ready" but the internal state isn't fully set up.
  useEffect(() => {
    if (!ready || !iframeRef.current) return;
    const sj = getScramjet();
    let frame: typeof frameRef.current = null;
    let cancelled = false;

    const tryCreateFrame = (attempt: number) => {
      if (cancelled) return;
      try {
        frame = sj.createFrame(iframeRef.current);
        frameRef.current = frame;
        setupFrameListeners();
      } catch (err) {
        if (attempt < 3 && !cancelled) {
          setTimeout(() => tryCreateFrame(attempt + 1), 500 * (attempt + 1));
        } else if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          queueMicrotask(() => {
            setError(message);
            setStatus("error");
          });
        }
      }
    };

    const setupFrameListeners = () => {
      if (!frame || cancelled) return;

    const onUrlChange = (e: any) => {
      const url = typeof e.url === "string" ? e.url : e.url?.href ?? "";
      if (url) {
        setOmnibox(url);
      }
    };
    const onNavigate = (e: any) => {
      // Don't flip to "loading" on every internal navigate event — Scramjet
      // fires these for sub-resource and redirect loads, which would pin the
      // overlay open. The iframe "load" event is the authoritative "done"
      // signal; we only show loading when the user explicitly navigates.
      const url = typeof e.url === "string" ? e.url : e.url?.href ?? "";
      if (url) setOmnibox(url);
    };

      frame.addEventListener("urlchange", onUrlChange);
      frame.addEventListener("navigate", onNavigate);
    };

    tryCreateFrame(0);

    return () => {
      cancelled = true;
      frame?.removeEventListener("urlchange", (e: any) => {});
      frame?.removeEventListener("navigate", (e: any) => {});
    };
  }, [ready, setOmnibox]);

  // Drive navigation when the omnibox target changes. We flip to "loading"
  // here (deferred so it doesn't run synchronously inside the effect) and rely
  // on the iframe "load" event to flip back to "loaded".
  useEffect(() => {
    if (!ready || !frameRef.current || !omniboxValue) return;
    queueMicrotask(() => setStatus("loading"));
    try {
      frameRef.current.go(omniboxValue);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      queueMicrotask(() => {
        setError(message);
        setStatus("error");
      });
    }
  }, [omniboxValue, ready]);

  // Listen for back/forward/reload commands dispatched by the store.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { action: string };
      const frame = frameRef.current;
      if (!frame) return;
      try {
        if (detail.action === "back") frame.back();
        else if (detail.action === "forward") frame.forward();
        else if (detail.action === "reload") frame.reload();
      } catch (err) {
        console.error("[hypers0nic] navigation action failed:", err);
      }
    };
    window.addEventListener("hypers0nic:navigate", handler);
    return () => window.removeEventListener("hypers0nic:navigate", handler);
  }, []);

  // Detect load completion via the iframe's load event. Scramjet rewrites the
  // page in-place so a load event fires once the proxied document is ready.
  // A safety timeout clears the overlay if the load event is delayed (some
  // sites hold the connection open for streaming/long-poll resources).
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      setStatus("loaded");
      try {
        const frame = frameRef.current as any;
        const title = frame?.title || iframe.contentDocument?.title || "";
        if (title && omniboxValue) recordVisit(omniboxValue, title);
      } catch {
        /* cross-origin reads throw — Scramjet handles title via events */
      }
    };
    const onLoad = () => finish();
    iframe.addEventListener("load", onLoad);
    const safety = setTimeout(finish, 12000);
    return () => {
      iframe.removeEventListener("load", onLoad);
      clearTimeout(safety);
    };
  }, [omniboxValue, recordVisit]);

  return (
    <div className={mounted && topBarAlwaysVisible ? "flex h-[calc(100vh-3rem)] flex-col" : "flex h-screen flex-col"}>
      <ProxyToolbar status={status} />
      <div className="relative flex-1 bg-background">
        {status === "loading" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 overflow-hidden bg-background"
          >
            {/* Skeleton loader — staggered entrance mimics a real page layout */}
            <div className="mx-auto max-w-4xl space-y-4 p-6">
              {/* Top bar skeleton */}
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0 }}
                className="flex items-center gap-3"
              >
                <div className="skeleton-block h-8 w-8 rounded-full" />
                <div className="skeleton-block h-6 flex-1 rounded-md" />
                <div className="skeleton-block h-8 w-20 rounded-md" />
              </motion.div>
              {/* Hero block */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.08 }}
                className="space-y-2"
              >
                <div className="skeleton-block h-8 w-2/3 rounded-lg" />
                <div className="skeleton-block h-4 w-full rounded-md" />
                <div className="skeleton-block h-4 w-5/6 rounded-md" />
              </motion.div>
              {/* Card grid */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.16 }}
                className="grid grid-cols-2 gap-4 pt-2 sm:grid-cols-3"
              >
                <div className="skeleton-block h-32 rounded-xl" />
                <div className="skeleton-block h-32 rounded-xl" />
                <div className="skeleton-block hidden h-32 rounded-xl sm:block" />
              </motion.div>
              {/* Text lines */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.24 }}
                className="space-y-2 pt-2"
              >
                <div className="skeleton-block h-4 w-full rounded-md" />
                <div className="skeleton-block h-4 w-4/5 rounded-md" />
                <div className="skeleton-block h-4 w-3/4 rounded-md" />
              </motion.div>
            </div>
            {/* Floating status pill */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.32 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2"
            >
              <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-card/80 px-4 py-2 text-sm shadow-lg backdrop-blur-md">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span className="font-medium text-foreground">Routing through Scramjet…</span>
              </div>
            </motion.div>
          </motion.div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
            <div className="max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
              <AlertTriangle className="mx-auto mb-3 size-8 text-destructive" />
              <h3 className="mb-1 font-semibold text-foreground">
                Couldn&apos;t load this page
              </h3>
              <p className="text-sm text-muted-foreground">
                {error ||
                  "The proxy transport rejected the request. Check your wisp relay setting or try again."}
              </p>
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
            allow="fullscreen; autoplay; encrypted-media; clipboard-read; clipboard-write; picture-in-picture"
          />
        )}
      </div>
    </div>
  );
}
