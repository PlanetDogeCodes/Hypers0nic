"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  Lock,
  Loader2,
  Shield,
  Globe,
  Unlock,
  Star,
} from "lucide-react";
import { Omnibox } from "./omnibox";
import { useHypers0nic } from "@/store/hypers0nic";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function ProxyToolbar({
  status,
}: {
  status: "loading" | "loaded" | "error";
}) {
  const goBack = useHypers0nic((s) => s.goBack);
  const goForward = useHypers0nic((s) => s.goForward);
  const reload = useHypers0nic((s) => s.reload);
  const goHome = useHypers0nic((s) => s.goHome);
  const omniboxValue = useHypers0nic((s) => s.omniboxValue);
  const scramjet = useHypers0nic((s) => s.scramjet);
  const bookmarks = useHypers0nic((s) => s.bookmarks);
  const toggleBookmark = useHypers0nic((s) => s.toggleBookmark);
  const topBarAlwaysVisible = useHypers0nic((s) => s.settings.preferences.topBarAlwaysVisible);
  const [visible, setVisible] = useState(topBarAlwaysVisible);

  useEffect(() => {
    setVisible(topBarAlwaysVisible);
  }, [topBarAlwaysVisible]);

  // Reveal the toolbar when the mouse moves near the top of the screen.
  useEffect(() => {
    if (topBarAlwaysVisible) return;
    const handler = (e: MouseEvent) => {
      if (e.clientY <= 40) {
        setVisible(true);
      } else {
        const toolbar = document.getElementById("proxy-toolbar");
        if (toolbar) {
          const rect = toolbar.getBoundingClientRect();
          if (e.clientY > rect.bottom + 10) {
            setVisible(false);
          }
        }
      }
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, [topBarAlwaysVisible]);

  const isSecure = /^https:\/\//i.test(omniboxValue);
  let hostname = "";
  try {
    hostname = new URL(omniboxValue).hostname.replace(/^www\./, "");
  } catch {
    hostname = "";
  }

  const btn =
    "inline-flex size-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-card hover:text-foreground active:scale-90 disabled:pointer-events-none disabled:opacity-30";
  const isBookmarked = bookmarks.some((b) => b.url === omniboxValue);

  return (
    <>
      {/* Invisible hover zone — only needed when auto-hidden */}
      {!topBarAlwaysVisible && (
        <div className="fixed left-0 right-0 top-0 z-40 h-10" onMouseEnter={() => setVisible(true)} />
      )}

      <div
        id="proxy-toolbar"
        className={cn(
          "fixed left-0 right-0 top-0 z-50 border-b border-border/30 bg-background/95 backdrop-blur-md transition-transform duration-200",
          visible ? "translate-y-0" : "-translate-y-full"
        )}
      >
        {/* Loading progress bar — CSS transition instead of motion.div to
            avoid the removeChild error that occurs when AnimatePresence
            tries to unmount during rapid navigation. */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 h-0.5 origin-left bg-primary transition-all duration-300",
            status === "loading" ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
          )}
        />

        <div className="flex items-center gap-2 px-3 py-2">
          {/* Navigation zone */}
          <div className="flex items-center gap-0.5">
            <TooltipProvider delayDuration={400}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className={btn} onClick={goBack} aria-label="Back">
                    <ArrowLeft className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Back · Alt+←</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className={btn} onClick={goForward} aria-label="Forward">
                    <ArrowRight className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Forward · Alt+→</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={cn(btn, status === "loading" && "text-primary")}
                    onClick={reload}
                    aria-label="Reload"
                  >
                    {status === "loading" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RotateCw className="size-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Reload</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className={btn} onClick={goHome} aria-label="Home">
                    <Home className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">New search · Esc</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* URL zone */}
          <div className="flex flex-1 items-center gap-2">
            {hostname && (
              <div
                className={cn(
                  "hidden shrink-0 items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium sm:flex",
                  isSecure
                    ? "border-primary/30 text-primary"
                    : "border-amber-500/30 text-amber-500"
                )}
                title={isSecure ? "Secure HTTPS connection" : "Unencrypted HTTP"}
              >
                {isSecure ? <Lock className="size-3" /> : <Unlock className="size-3" />}
                <span className="max-w-[8rem] truncate">{hostname}</span>
              </div>
            )}

            <div className="flex-1 max-w-2xl">
              <Omnibox variant="toolbar" />
            </div>

            {/* Bookmark toggle */}
            {hostname && (
              <button
                onClick={() => toggleBookmark(omniboxValue, hostname)}
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded transition-colors active:scale-90",
                  isBookmarked
                    ? "text-primary hover:bg-primary/10"
                    : "text-muted-foreground hover:bg-card hover:text-foreground"
                )}
                aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
              >
                <Star className="size-4" fill={isBookmarked ? "currentColor" : "none"} />
              </button>
            )}

            {/* Connection status */}
            <div
              className={cn(
                "hidden shrink-0 items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium md:flex",
                scramjet.status === "ready"
                  ? "border-primary/30 text-primary"
                  : scramjet.status === "loading"
                    ? "border-primary/30 text-primary"
                    : scramjet.status === "error"
                      ? "border-destructive/30 text-destructive"
                      : "border-border/30 text-muted-foreground"
              )}
              title="Proxy connection status"
            >
              {scramjet.status === "ready" ? (
                <>
                  <Shield className="size-3.5" />
                  <span>Proxied</span>
                </>
              ) : scramjet.status === "loading" ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Connecting…</span>
                </>
              ) : scramjet.status === "error" ? (
                <>
                  <Globe className="size-3.5" />
                  <span>Error</span>
                </>
              ) : (
                <>
                  <Globe className="size-3.5" />
                  <span>Idle</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
