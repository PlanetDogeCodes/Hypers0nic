"use client";

import { Omnibox } from "./omnibox";
import { Logo } from "./logo";
import { ProxyHUD } from "./proxy-hud";
import { useHypers0nic } from "@/store/hypers0nic";
import { getSearchEngine, SEARCH_ENGINES } from "@/lib/search-engines";
import { BookOpen, Youtube, Github, Twitch, Newspaper, Music, History as HistoryIcon, ArrowUpRight, Star, X, Plus, ExternalLink, Pencil, Trash2, FolderOpen } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Bookmark } from "@/lib/types";
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
            <BookmarksStrip />
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

// ============================================================================
// BookmarksStrip (Task 5)
// ----------------------------------------------------------------------------
// The vertical list of bookmarked URLs on the home page. Each bookmark card
// supports three interaction modes:
//
//   1. Left-click → navigate to the URL in the current tab.
//   2. Right-click (onContextMenu) → opens a custom context menu with:
//        - Open
//        - Open in new tab
//        - Edit title
//        - Remove bookmark
//   3. Drag → reorder the bookmark among its siblings (HTML5 DnD, same
//      pattern as ProxyTabBar). A purple drop indicator is shown on the
//      hovered target.
//
// The context menu is rendered as a `position: fixed` overlay attached to
// document.body so it floats above all other content. It auto-closes on:
//   - Any mousedown outside the menu (including on another bookmark, which
//     re-opens the menu at the new position).
//   - Pressing Escape.
//   - Clicking any menu item.
//
// The component reads its own slice of the store (rather than receiving
// props) so it can re-render independently of HomeView when the bookmarks
// array changes.
// ============================================================================

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  bookmark: Bookmark | null;
}

const INITIAL_CONTEXT_MENU: ContextMenuState = {
  visible: false,
  x: 0,
  y: 0,
  bookmark: null,
};

// Maximum number of bookmarks shown in the strip. Reordering only affects
// the visible ones, but the underlying array is reordered (so a bookmark
// dragged out of the visible window stays gone from view).
const MAX_VISIBLE_BOOKMARKS = 6;

function BookmarksStrip() {
  const bookmarks = useHypers0nic((s) => s.bookmarks);
  const navigate = useHypers0nic((s) => s.navigate);
  const openTab = useHypers0nic((s) => s.openTab);
  const removeBookmark = useHypers0nic((s) => s.removeBookmark);
  const updateBookmarkTitle = useHypers0nic((s) => s.updateBookmarkTitle);
  const reorderBookmarks = useHypers0nic((s) => s.reorderBookmarks);

  // Drag state — mirrors ProxyTabBar's pattern. dragIndex === -1 means
  // "no drag in progress". dragOverIndex is the index the dragged item is
  // currently hovering over; we render a purple drop indicator on it.
  const [dragIndex, setDragIndex] = useState<number>(-1);
  const [dragOverIndex, setDragOverIndex] = useState<number>(-1);

  // Context menu state. Visible only when `visible` is true and `bookmark`
  // is non-null. We keep the bookmark reference (not just the URL) so the
  // menu can show the current title without an extra store lookup.
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(INITIAL_CONTEXT_MENU);

  // Reset drag state if the bookmarks array shrinks mid-drag (e.g. a
  // bookmark is removed via the context menu while another is being
  // dragged). Same defensive guard as ProxyTabBar.
  useEffect(() => {
    if (dragIndex >= bookmarks.length) setDragIndex(-1);
    if (dragOverIndex >= bookmarks.length) setDragOverIndex(-1);
  }, [bookmarks.length, dragIndex, dragOverIndex]);

  // Close the context menu on Escape. We attach a window-level listener so
  // the menu closes even if it doesn't have focus (context menus don't
  // steal focus from the underlying element).
  useEffect(() => {
    if (!contextMenu.visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu(INITIAL_CONTEXT_MENU);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [contextMenu.visible]);

  // Close the context menu on any mousedown outside the menu itself. Using
  // mousedown (not click) so the menu closes before a click on another
  // bookmark re-opens it — the right-click's onContextMenu will fire next
  // and reposition the menu correctly. We also close on contextmenu events
  // outside the menu so right-clicking elsewhere dismisses it cleanly.
  useEffect(() => {
    if (!contextMenu.visible) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[data-bookmark-context-menu]")) return;
      setContextMenu(INITIAL_CONTEXT_MENU);
    };
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[data-bookmark-context-menu]")) return;
      // Don't preventDefault here — we want the browser to fire the
      // element's own onContextMenu (which may re-open the menu).
      setContextMenu(INITIAL_CONTEXT_MENU);
    };
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("contextmenu", onContextMenu, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
    };
  }, [contextMenu.visible]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, bookmark: Bookmark) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        bookmark,
      });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(INITIAL_CONTEXT_MENU);
  }, []);

  // --- Drag handlers (HTML5 DnD) ---
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDragIndex(index);
    try {
      // Firefox requires setData to start the drag.
      e.dataTransfer.setData("text/plain", String(index));
      e.dataTransfer.effectAllowed = "move";
    } catch {}
    // Close the context menu if it happens to be open (rare, but the user
    // could right-click then immediately drag).
    if (contextMenu.visible) closeContextMenu();
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    const from = dragIndex;
    setDragIndex(-1);
    setDragOverIndex(-1);
    if (from === -1 || from === index) return;
    reorderBookmarks(from, index);
  };

  const handleDragEnd = () => {
    setDragIndex(-1);
    setDragOverIndex(-1);
  };

  const visibleBookmarks = bookmarks.slice(0, MAX_VISIBLE_BOOKMARKS);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Star className="size-3 text-primary" fill="currentColor" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Bookmarks
        </span>
        <div className="h-px flex-1 bg-border/20" />
      </div>
      <div className="flex flex-col gap-1">
        {visibleBookmarks.map((b, index) => {
          const isDragged = dragIndex === index;
          const isDropTarget =
            dragOverIndex === index && dragIndex !== -1 && dragIndex !== index;
          return (
            <div
              key={b.url}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onContextMenu={(e) => handleContextMenu(e, b)}
              className={cn(
                "group relative flex items-center gap-2.5 rounded border border-border/15 bg-card/30 px-3 py-2 transition-colors hover:border-border/30 hover:bg-card/50",
                // Visual feedback during drag: the dragged card fades; the
                // drop-target card gets a purple ring.
                isDragged && "opacity-40",
                isDropTarget && "border-primary/50 ring-1 ring-inset ring-primary/40"
              )}
            >
              {/* Drop indicator: a 2px purple bar along the top edge of the
                  hovered target. Matches the visual language of ProxyTabBar
                  (which uses a left-edge bar on its horizontal layout). */}
              {isDropTarget && (
                <span
                  aria-hidden
                  className="absolute left-0 right-0 top-0 h-0.5 bg-primary"
                  style={{ borderTopLeftRadius: "0.25rem", borderTopRightRadius: "0.25rem" }}
                />
              )}

              <button
                onClick={() => navigate(b.url)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                // Disable the left-click button while dragging so a drop
                // doesn't accidentally trigger navigation.
                disabled={dragIndex !== -1}
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
                disabled={dragIndex !== -1}
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Context menu overlay — rendered through a portal directly to
          document.body so it floats above all other content and isn't
          affected by ancestor transforms (e.g. framer-motion's animated
          motion.div, which would otherwise offset the menu's position
          during its enter animation). */}
      {contextMenu.visible && contextMenu.bookmark
        ? createPortal(
            <BookmarkContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              bookmark={contextMenu.bookmark}
              onClose={closeContextMenu}
              onOpen={(url) => {
                closeContextMenu();
                void navigate(url);
              }}
              onOpenInNewTab={(url) => {
                closeContextMenu();
                void openTab(url);
              }}
              onEditTitle={(url, currentTitle) => {
                closeContextMenu();
                // Defer the prompt to the next tick so the context menu has a
                // chance to close first (otherwise the prompt's overlay can
                // visually conflict with the menu's unmount animation on
                // some browsers).
                setTimeout(() => {
                  const next = window.prompt("Bookmark title", currentTitle);
                  if (next === null) return; // user clicked Cancel
                  updateBookmarkTitle(url, next);
                }, 0);
              }}
              onRemove={(url) => {
                closeContextMenu();
                removeBookmark(url);
              }}
            />,
            document.body
          )
        : null}
    </div>
  );
}

/**
 * BookmarkContextMenu — the actual menu rendered at the mouse position.
 *
 * Pure presentational component: the parent owns all the action callbacks.
 * Positioned with `position: fixed` at (x, y). If the menu would overflow
 * the viewport, we shift it back inside (so a right-click near the right or
 * bottom edge doesn't push it off-screen).
 *
 * Styled with the terminal aesthetic: pure black background, white text,
 * purple accents, monospace font. Each item has a Lucide icon for scannability.
 */
function BookmarkContextMenu({
  x,
  y,
  bookmark,
  onClose,
  onOpen,
  onOpenInNewTab,
  onEditTitle,
  onRemove,
}: {
  x: number;
  y: number;
  bookmark: Bookmark;
  onClose: () => void;
  onOpen: (url: string) => void;
  onOpenInNewTab: (url: string) => void;
  onEditTitle: (url: string, currentTitle: string) => void;
  onRemove: (url: string) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  // Track the final position after viewport-edge clamping. We compute it
  // synchronously after mount (in a useLayoutEffect — runs before the
  // browser paints) so the menu never visibly jumps from (x, y) to the
  // clamped position.
  const [pos, setPos] = useState<{ x: number; y: number }>({ x, y });

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8; // px of breathing room from the viewport edge
    let nextX = x;
    let nextY = y;
    if (x + rect.width + margin > window.innerWidth) {
      nextX = Math.max(margin, window.innerWidth - rect.width - margin);
    }
    if (y + rect.height + margin > window.innerHeight) {
      nextY = Math.max(margin, window.innerHeight - rect.height - margin);
    }
    setPos({ x: nextX, y: nextY });
  }, [x, y]);

  const url = bookmark.url;
  const title = bookmark.title || hostnameOf(url);

  // Menu item definition. `kind` controls rendering: "item" is a normal
  // clickable row; "separator" is a thin divider line.
  type Item =
    | { kind: "item"; label: string; icon: typeof ExternalLink; action: () => void; danger?: boolean }
    | { kind: "separator" };

  const items: Item[] = [
    { kind: "item", label: "Open", icon: ExternalLink, action: () => onOpen(url) },
    { kind: "item", label: "Open in new tab", icon: FolderOpen, action: () => onOpenInNewTab(url) },
    { kind: "separator" },
    { kind: "item", label: "Edit title", icon: Pencil, action: () => onEditTitle(url, title) },
    { kind: "separator" },
    { kind: "item", label: "Remove bookmark", icon: Trash2, action: () => onRemove(url), danger: true },
  ];

  return (
    <div
      ref={menuRef}
      data-bookmark-context-menu
      role="menu"
      aria-label={`Bookmark menu for ${title}`}
      className="fixed z-[100] min-w-[200px] overflow-hidden rounded border border-purple-500/40 bg-black font-mono text-white shadow-2xl shadow-purple-500/20"
      style={{
        left: pos.x,
        top: pos.y,
        // Subtle purple glow to match the terminal aesthetic of the rest
        // of the app (ProxyTabBar, apps-panel, etc.).
        boxShadow:
          "0 10px 30px -10px rgba(168, 85, 247, 0.45), 0 0 0 1px rgba(168, 85, 247, 0.25)",
      }}
      // Stop the document-level mousedown/contextmenu listeners from
      // closing the menu when the user interacts with it.
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* Header — shows the bookmark's hostname so the user can confirm
          they're acting on the right bookmark before clicking an item. */}
      <div className="border-b border-purple-500/20 px-3 py-2">
        <p className="truncate text-[10px] uppercase tracking-widest text-purple-400/80">
          Bookmark
        </p>
        <p className="truncate text-xs text-white/90">{hostnameOf(url)}</p>
      </div>
      <div className="py-1">
        {items.map((item, i) =>
          item.kind === "separator" ? (
            <div
              key={`sep-${i}`}
              role="separator"
              className="my-1 h-px bg-purple-500/15"
            />
          ) : (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                item.action();
                // onClose is called by the parent's action wrappers, but
                // we also call it here as a safety net for any future
                // action that forgets to.
                onClose();
              }}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors",
                item.danger
                  ? "text-red-400 hover:bg-red-500/15 hover:text-red-300"
                  : "text-white/80 hover:bg-purple-500/20 hover:text-white"
              )}
            >
              <item.icon className="size-3.5 shrink-0 opacity-80" />
              <span className="flex-1 truncate">{item.label}</span>
            </button>
          )
        )}
      </div>
    </div>
  );
}
