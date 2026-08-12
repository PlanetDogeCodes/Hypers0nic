"use client";

import { Omnibox } from "./omnibox";
import { Logo } from "./logo";
import { ProxyHUD } from "./proxy-hud";
import { useHypers0nic } from "@/store/hypers0nic";
import { getSearchEngine, SEARCH_ENGINES } from "@/lib/search-engines";
import { BookOpen, Youtube, Github, Twitch, Newspaper, Music, History as HistoryIcon, ArrowUpRight, Star, X, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const SHORTCUTS = [
  { name: "Wikipedia", url: "https://wikipedia.org", icon: BookOpen },
  { name: "YouTube", url: "https://youtube.com", icon: Youtube },
  { name: "Reddit", url: "https://reddit.com", icon: Newspaper },
  { name: "GitHub", url: "https://github.com", icon: Github },
  { name: "Twitch", url: "https://twitch.tv", icon: Twitch },
  { name: "Spotify", url: "https://open.spotify.com", icon: Music },
];

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

export function HomeView({ onOpenHistory }: { onOpenHistory?: () => void }) {
  const navigate = useHypers0nic((s) => s.navigate);
  const settings = useHypers0nic((s) => s.settings);
  const setSearchEngine = useHypers0nic((s) => s.setSearchEngine);
  const history = useHypers0nic((s) => s.history);
  const bookmarks = useHypers0nic((s) => s.bookmarks);
  const removeBookmark = useHypers0nic((s) => s.removeBookmark);
  const customShortcuts = useHypers0nic((s) => s.customShortcuts);
  const addCustomShortcut = useHypers0nic((s) => s.addCustomShortcut);
  const removeCustomShortcut = useHypers0nic((s) => s.removeCustomShortcut);
  const engine = getSearchEngine(settings.searchEngine);
  const recentHistory = history.slice(0, 5);
  const [showAddShortcut, setShowAddShortcut] = useState(false);

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-xl flex-col items-center">
        {/* Logo + search (centered hero) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex w-full flex-col items-center"
        >
          <div className="mb-5 flex flex-col items-center gap-3">
            <Logo size={48} />
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              <span className="text-foreground">Hyper</span>
              <span className="text-primary">s0nic</span>
            </h1>
          </div>

          <div className="w-full">
            <Omnibox variant="home" autoFocus />
          </div>

          <ProxyHUD />

          {/* Search engine selector */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1">
            {SEARCH_ENGINES.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setSearchEngine(e.id)}
                className={cn(
                  "rounded border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  e.id === engine.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/30 text-muted-foreground hover:border-border/60 hover:text-foreground"
                )}
              >
                {e.name}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Shortcuts + bookmarks + recent history */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-8 w-full space-y-4"
        >
          {settings.preferences.showShortcuts && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Shortcuts
                </span>
                <div className="h-px flex-1 bg-border/20" />
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {SHORTCUTS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => navigate(s.url)}
                      className="group flex flex-col items-center gap-1.5 rounded border border-border/20 bg-card/50 p-2.5 transition-colors hover:border-primary/50 hover:bg-card"
                    >
                      <Icon className="size-5 text-foreground/70 transition-colors group-hover:text-primary" />
                      <span className="text-[10px] text-muted-foreground transition-colors group-hover:text-foreground">
                        {s.name}
                      </span>
                    </button>
                  );
                })}
                {customShortcuts.map((s) => (
                  <div
                    key={s.id}
                    className="group relative flex flex-col items-center gap-1.5 rounded border border-border/20 bg-card/50 p-2.5 transition-colors hover:border-primary/50 hover:bg-card"
                  >
                    <button
                      onClick={() => navigate(s.url)}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <span className="flex size-5 items-center justify-center text-sm font-bold text-foreground/70 transition-colors group-hover:text-primary">
                        {(s.label || s.name).slice(0, 1).toUpperCase()}
                      </span>
                      <span className="text-[10px] text-muted-foreground transition-colors group-hover:text-foreground">
                        {s.name}
                      </span>
                    </button>
                    <button
                      onClick={() => removeCustomShortcut(s.id)}
                      className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      aria-label={`Remove ${s.name} shortcut`}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setShowAddShortcut(true)}
                  className="group flex flex-col items-center gap-1.5 rounded border border-dashed border-border/20 p-2.5 transition-colors hover:border-primary/40 hover:bg-card/30"
                >
                  <Plus className="size-5 text-muted-foreground transition-colors group-hover:text-primary" />
                  <span className="text-[10px] text-muted-foreground">Add</span>
                </button>
              </div>
            </div>
          )}

          {/* Bookmarks strip */}
          {bookmarks.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Star className="size-3 text-primary" fill="currentColor" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Bookmarks
                </span>
                <div className="h-px flex-1 bg-border/20" />
              </div>
              <div className="flex flex-col gap-1">
                {bookmarks.slice(0, 6).map((b) => (
                  <div
                    key={b.url}
                    className="group flex items-center gap-2.5 rounded border border-border/15 bg-card/30 px-3 py-2 transition-colors hover:border-border/30 hover:bg-card/50"
                  >
                    <button
                      onClick={() => navigate(b.url)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <img
                        src={faviconFor(b.url)}
                        alt=""
                        className="size-4 shrink-0 rounded"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-foreground/90 group-hover:text-foreground">
                          {b.title || hostnameOf(b.url)}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {hostnameOf(b.url)}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => removeBookmark(b.url)}
                      className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      aria-label="Remove bookmark"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent history strip */}
          {recentHistory.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <HistoryIcon className="size-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Recently visited
                </span>
                <div className="h-px flex-1 bg-border/20" />
                <button
                  onClick={onOpenHistory}
                  className="text-[10px] font-medium text-primary/80 transition-colors hover:text-primary"
                >
                  View all
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {recentHistory.map((h) => (
                  <button
                    key={h.url + h.visitedAt}
                    onClick={() => navigate(h.url)}
                    className="group flex items-center gap-2.5 rounded border border-border/15 bg-card/30 px-3 py-2 transition-colors hover:border-border/30 hover:bg-card/50"
                  >
                    <img
                      src={faviconFor(h.url)}
                      alt=""
                      className="size-4 shrink-0 rounded"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-xs text-foreground/90 group-hover:text-foreground">
                        {h.title || hostnameOf(h.url)}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {hostnameOf(h.url)}
                      </p>
                    </div>
                    <ArrowUpRight className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Add custom shortcut dialog */}
      <AddShortcutDialog
        open={showAddShortcut}
        onOpenChange={setShowAddShortcut}
        onAdd={(name, url) => {
          addCustomShortcut({ name, url, label: name.slice(0, 1).toUpperCase() });
          setShowAddShortcut(false);
        }}
      />
    </div>
  );
}

function AddShortcutDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string, url: string) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("https://");

  const submit = () => {
    const trimmedName = name.trim();
    let trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl || trimmedUrl === "https://") return;
    if (!/^https?:\/\//.test(trimmedUrl)) trimmedUrl = `https://${trimmedUrl}`;
    onAdd(trimmedName, trimmedUrl);
    setName("");
    setUrl("https://");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Add custom shortcut</DialogTitle>
          <DialogDescription className="text-xs">
            Pin a site to your shortcuts grid for one-click access.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="shortcut-name" className="text-xs">Name</Label>
            <Input
              id="shortcut-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Site"
              className="text-sm"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shortcut-url" className="text-xs">URL</Label>
            <Input
              id="shortcut-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="text-sm"
              spellCheck={false}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={!name.trim() || url.trim() === "https://"}>
            Add shortcut
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
