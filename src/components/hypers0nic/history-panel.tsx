"use client";

import { useState, useMemo } from "react";
import { useHypers0nic } from "@/store/hypers0nic";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { History, Search, Trash2, ExternalLink, Clock, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

function faviconFor(url: string): string {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
  } catch {
    return "";
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function HistoryPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const history = useHypers0nic((s) => s.history);
  const navigate = useHypers0nic((s) => s.navigate);
  const clearHistory = useHypers0nic((s) => s.clearHistory);
  const recentlyClosed = useHypers0nic((s) => s.recentlyClosed);
  const clearRecentlyClosed = useHypers0nic((s) => s.clearRecentlyClosed);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return history;
    const q = query.toLowerCase();
    return history.filter(
      (h) =>
        h.url.toLowerCase().includes(q) || h.title.toLowerCase().includes(q)
    );
  }, [history, query]);

  // Group by day for a cleaner list.
  const grouped = useMemo(() => {
    const groups: { label: string; items: typeof filtered }[] = [];
    let lastLabel = "";
    for (const item of filtered) {
      const label = dayLabel(item.visitedAt);
      if (label !== lastLabel) {
        groups.push({ label, items: [] });
        lastLabel = label;
      }
      groups[groups.length - 1].items.push(item);
    }
    return groups;
  }, [filtered]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/40 px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            <History className="size-4 text-primary" />
            Browsing history
          </SheetTitle>
          <SheetDescription className="sr-only">
            View and search your browsing history stored locally on this device.
          </SheetDescription>
        </SheetHeader>

        <div className="border-b border-border/40 px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search history…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              disabled={history.length === 0}
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              Clear all
            </Button>
          </div>
        </div>

        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
          {/* Recently Closed section */}
          {!query && recentlyClosed.length > 0 && (
            <div className="border-b border-border/20 py-2">
              <div className="flex items-center justify-between px-5 py-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <RotateCcw className="size-3 text-primary/60" />
                  Recently closed
                </span>
                <button
                  onClick={clearRecentlyClosed}
                  className="text-[11px] text-muted-foreground hover:text-destructive"
                >
                  Clear
                </button>
              </div>
              {recentlyClosed.slice(0, 5).map((item) => (
                <button
                  key={item.url + item.closedAt}
                  onClick={() => {
                    navigate(item.url);
                    onOpenChange(false);
                  }}
                  className="group flex w-full items-center gap-3 px-5 py-2 text-left transition-colors hover:bg-muted/50"
                >
                  <img
                    src={faviconFor(item.url)}
                    alt=""
                    className="size-4 shrink-0 rounded bg-muted/40"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-foreground/90 group-hover:text-foreground">
                      {item.title || hostnameOf(item.url)}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {hostnameOf(item.url)}
                    </p>
                  </div>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {timeAgo(item.closedAt)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/40">
                <Clock className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {query ? "No matching entries" : "No history yet"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {query
                    ? "Try a different search term."
                    : "Pages you visit will appear here."}
                </p>
              </div>
            </div>
          ) : (
            <div className="py-2">
              {grouped.map((group) => (
                <div key={group.label} className="mb-2">
                  <div className="px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </div>
                  {group.items.map((item) => (
                    <button
                      key={item.url + item.visitedAt}
                      onClick={() => {
                        navigate(item.url);
                        onOpenChange(false);
                      }}
                      className="group flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-muted/50"
                    >
                      <img
                        src={faviconFor(item.url)}
                        alt=""
                        className="size-5 shrink-0 rounded bg-muted/40"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.visibility =
                            "hidden";
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">
                          {item.title || hostnameOf(item.url)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {hostnameOf(item.url)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {timeAgo(item.visitedAt)}
                        </span>
                        <ExternalLink className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function dayLabel(ts: number): string {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
