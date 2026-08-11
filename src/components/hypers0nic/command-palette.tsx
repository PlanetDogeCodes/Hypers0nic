"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useHypers0nic } from "@/store/hypers0nic";
import {
  Search,
  Globe,
  Clock,
  Settings,
  Palette,
  EyeOff,
  ShieldCheck,
  History,
  ArrowRight,
  CornerDownLeft,
  ExternalLink,
  Zap,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SEARCH_ENGINES, getSearchEngine, isLikelyUrl, normalizeInput } from "@/lib/search-engines";
import { motion, AnimatePresence } from "framer-motion";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  iconColor?: string;
  category: string;
  action: () => void;
  favicon?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
}

function faviconFor(url: string): string {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;
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

// Simple fuzzy match: returns true if all chars of query appear in order in text.
function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

// Score: higher = better match. 0 = no match.
function fuzzyScore(query: string, text: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.startsWith(q)) return 100 + q.length;
  if (t.includes(q)) return 50 + q.length;
  // Fuzzy: count consecutive matches for a rough quality score.
  let qi = 0;
  let score = 0;
  let streak = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      streak++;
      score += streak;
    } else {
      streak = 0;
    }
  }
  return qi === q.length ? score : 0;
}

export function CommandPalette({
  open,
  onOpenChange,
  onOpenSettings,
  onOpenHistory,
}: CommandPaletteProps) {
  const navigate = useHypers0nic((s) => s.navigate);
  const history = useHypers0nic((s) => s.history);
  const bookmarks = useHypers0nic((s) => s.bookmarks);
  const settings = useHypers0nic((s) => s.settings);
  const setSearchEngine = useHypers0nic((s) => s.setSearchEngine);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const engine = getSearchEngine(settings.searchEngine);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build the full command list. This is memoised per render but the inputs are
  // small so it's cheap.
  const allItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];
    const close = () => onOpenChange(false);

    // Navigation actions
    items.push({
      id: "nav-home",
      label: "Go to home page",
      description: "Return to the search start page",
      icon: Globe,
      category: "Navigation",
      action: () => {
        close();
        useHypers0nic.getState().goHome();
      },
    });

    // Settings tabs
    const settingsTabs = [
      { id: "appearance", label: "Appearance", icon: Palette },
      { id: "cloak", label: "Tab Cloaking", icon: EyeOff },
      { id: "tinfoil", label: "Tinf0il Sync", icon: ShieldCheck },
    ];
    for (const tab of settingsTabs) {
      items.push({
        id: `settings-${tab.id}`,
        label: `Open Settings → ${tab.label}`,
        icon: tab.icon,
        category: "Settings",
        action: () => {
          close();
          onOpenSettings();
        },
      });
    }

    items.push({
      id: "settings-history",
      label: "Open History panel",
      description: `${history.length} ${history.length === 1 ? "entry" : "entries"}`,
      icon: History,
      category: "Settings",
      action: () => {
        close();
        onOpenHistory();
      },
    });

    // Search engine switcher
    for (const e of SEARCH_ENGINES) {
      items.push({
        id: `engine-${e.id}`,
        label: `Search with ${e.name}`,
        description: e.id === settings.searchEngine ? "Current default" : "Set as default",
        icon: Search,
        iconColor: e.accent,
        category: "Search Engines",
        action: () => {
          close();
          setSearchEngine(e.id);
        },
      });
    }

    // Bookmarks
    for (const b of bookmarks) {
      items.push({
        id: `bookmark-${b.url}`,
        label: b.title || hostnameOf(b.url),
        description: hostnameOf(b.url),
        icon: Star,
        iconColor: "#fbbf24",
        favicon: faviconFor(b.url),
        category: "Bookmarks",
        action: () => {
          close();
          navigate(b.url);
        },
      });
    }

    // History entries (most recent first)
    for (const h of history.slice(0, 10)) {
      items.push({
        id: `history-${h.url}-${h.visitedAt}`,
        label: h.title || hostnameOf(h.url),
        description: hostnameOf(h.url),
        icon: Clock,
        favicon: faviconFor(h.url),
        category: "History",
        action: () => {
          close();
          navigate(h.url);
        },
      });
    }

    // Shortcuts
    const shortcuts = [
      { name: "Wikipedia", url: "https://wikipedia.org" },
      { name: "YouTube", url: "https://youtube.com" },
      { name: "Reddit", url: "https://reddit.com" },
      { name: "GitHub", url: "https://github.com" },
    ];
    for (const s of shortcuts) {
      items.push({
        id: `shortcut-${s.url}`,
        label: s.name,
        description: hostnameOf(s.url),
        icon: ExternalLink,
        favicon: faviconFor(s.url),
        category: "Shortcuts",
        action: () => {
          close();
          navigate(s.url);
        },
      });
    }

    return items;
  }, [history, bookmarks, settings.searchEngine, navigate, onOpenChange, onOpenSettings, onOpenHistory, setSearchEngine]);

  // Filter + sort by fuzzy score
  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const scored = allItems
      .map((item) => ({
        item,
        score: Math.max(
          fuzzyScore(query, item.label),
          item.description ? fuzzyScore(query, item.description) : 0,
          fuzzyScore(query, item.category)
        ),
      }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.map((s) => s.item);
  }, [query, allItems]);

  // If the query looks like a URL or search, add a "navigate to" option at top
  const navigateOption = useMemo<CommandItem | null>(() => {
    const trimmed = query.trim();
    if (!trimmed) return null;
    const target = normalizeInput(trimmed, engine);
    const isUrl = isLikelyUrl(trimmed);
    return {
      id: "navigate-query",
      label: isUrl ? `Open ${trimmed}` : `Search "${trimmed}" on ${engine.name}`,
      description: isUrl ? target : undefined,
      icon: isUrl ? Globe : Search,
      category: "Navigate",
      action: () => {
        onOpenChange(false);
        navigate(target);
      },
    };
  }, [query, engine, navigate, onOpenChange]);

  const displayItems = navigateOption ? [navigateOption, ...filtered] : filtered;

  // Clamp active index
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, displayItems.length - 1));
  }, [displayItems.length]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, displayItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      displayItems[activeIndex]?.action();
    }
  };

  // Group items by category for display
  const grouped = useMemo(() => {
    const groups: { category: string; items: CommandItem[] }[] = [];
    let lastCat = "";
    for (const item of displayItems) {
      if (item.category !== lastCat) {
        groups.push({ category: item.category, items: [] });
        lastCat = item.category;
      }
      groups[groups.length - 1].items.push(item);
    }
    return groups;
  }, [displayItems]);

  let runningIndex = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[15vh] gap-0 overflow-hidden p-0 sm:max-w-xl" onKeyDown={onKeyDown}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search sites, history, settings…"
            className="h-8 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden shrink-0 rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground sm:inline">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {displayItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Zap className="size-6 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No results found</p>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.category} className="mb-1">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.category}
                </div>
                {group.items.map((item) => {
                  const idx = runningIndex++;
                  const Icon = item.icon;
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      onMouseMove={() => setActiveIndex(idx)}
                      onClick={item.action}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                        isActive ? "bg-primary/10" : "hover:bg-muted/40"
                      )}
                    >
                      {item.favicon ? (
                        <img
                          src={item.favicon}
                          alt=""
                          className="size-4 shrink-0 rounded bg-muted/40"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                          }}
                        />
                      ) : (
                        <Icon
                          className="size-4 shrink-0 text-muted-foreground"
                          style={item.iconColor ? { color: item.iconColor } : undefined}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-sm", isActive ? "text-foreground" : "text-foreground/90")}>
                          {item.label}
                        </p>
                        {item.description && (
                          <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                        )}
                      </div>
                      {isActive && (
                        <CornerDownLeft className="size-3.5 shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between border-t border-border/40 px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border/60 bg-muted/40 px-1 font-sans text-[10px]">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border/60 bg-muted/40 px-1 font-sans text-[10px]">↵</kbd>
              select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <ArrowRight className="size-3" />
            Hypers0nic
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
