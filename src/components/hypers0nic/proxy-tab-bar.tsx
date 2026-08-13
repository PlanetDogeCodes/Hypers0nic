"use client";

import { useEffect, useRef, useState } from "react";
import { X, Plus, Loader2 } from "lucide-react";
import { useHypers0nic } from "@/store/hypers0nic";
import { cn } from "@/lib/utils";

/**
 * ProxyTabBar — a horizontal, scrollable strip of open proxy tabs.
 *
 * Rendered at the top of the proxy view (below the header / proxy toolbar).
 * Each tab shows a favicon (Google favicon service), a truncated title, and
 * a close button. Tabs can be reordered via HTML5 drag-and-drop. A "+"
 * button at the end goes home (where the user can open a new tab).
 *
 * The bar is hidden when there's only one tab — the single-tab case is
 * already covered by the proxy toolbar's omnibox, so showing a tab bar would
 * just waste vertical space.
 *
 * Visual style: terminal aesthetic — pure black background, white text,
 * purple accents, monospace font. This is intentional: it matches the
 * Hypers0nic brand and makes the tab bar visually distinct from the proxied
 * content below.
 */
function faviconFor(url: string): string {
  try {
    const u = new URL(url);
    if (!u.hostname) return "";
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=32`;
  } catch {
    return "";
  }
}

function hostnameLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

export function ProxyTabBar() {
  const tabs = useHypers0nic((s) => s.tabs);
  const activeTabId = useHypers0nic((s) => s.activeTabId);
  const loadingTabs = useHypers0nic((s) => s.loadingTabs);
  const switchTab = useHypers0nic((s) => s.switchTab);
  const closeTab = useHypers0nic((s) => s.closeTab);
  const reorderTabs = useHypers0nic((s) => s.reorderTabs);
  const goHome = useHypers0nic((s) => s.goHome);

  // Drag state: index of the tab currently being dragged. -1 when not
  // dragging. Used to apply a "ghost" style to the dragged tab.
  const [dragIndex, setDragIndex] = useState<number>(-1);
  // dragOverIndex: index of the tab the dragged tab is currently hovering
  // over. Used to show a drop indicator.
  const [dragOverIndex, setDragOverIndex] = useState<number>(-1);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset drag state if the tabs array changes mid-drag (e.g. a tab is
  // closed while another is being dragged).
  useEffect(() => {
    if (dragIndex >= tabs.length) setDragIndex(-1);
    if (dragOverIndex >= tabs.length) setDragOverIndex(-1);
  }, [tabs.length, dragIndex, dragOverIndex]);

  // Hide the tab bar entirely when there's only one tab (or zero). The
  // single-tab case is already covered by the proxy toolbar's omnibox, so
  // showing a tab bar would just waste vertical space.
  if (tabs.length <= 1) return null;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDragIndex(index);
    try {
      // Firefox requires setData to start the drag.
      e.dataTransfer.setData("text/plain", String(index));
      e.dataTransfer.effectAllowed = "move";
    } catch {}
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
    reorderTabs(from, index);
  };

  const handleDragEnd = () => {
    setDragIndex(-1);
    setDragOverIndex(-1);
  };

  return (
    <div
      className="sticky top-12 z-30 flex items-stretch border-b border-purple-500/20 bg-black font-mono text-white"
      style={{ boxShadow: "inset 0 -1px 0 0 rgba(168, 85, 247, 0.15)" }}
    >
      {/* Scrollable tab strip — horizontal scroll when tabs overflow. */}
      <div
        ref={scrollRef}
        className="flex flex-1 items-stretch overflow-x-auto overflow-y-hidden"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(168,85,247,0.4) transparent",
        }}
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const isLoading = !!loadingTabs[tab.id];
          const fav = faviconFor(tab.url);
          const title = tab.title || hostnameLabel(tab.url) || tab.url;
          const isDragged = dragIndex === index;
          const isDropTarget = dragOverIndex === index && dragIndex !== -1 && dragIndex !== index;

          return (
            <div
              key={tab.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => switchTab(tab.id)}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  switchTab(tab.id);
                } else if (e.key === "Delete" || (e.key === "w" && (e.ctrlKey || e.metaKey))) {
                  e.preventDefault();
                  closeTab(tab.id);
                }
              }}
              title={title}
              className={cn(
                "group relative flex max-w-[200px] min-w-[120px] cursor-pointer items-center gap-2 border-r border-purple-500/10 px-3 py-2 text-xs transition-colors select-none",
                // Active tab: bright white text + subtle purple underline.
                // Inactive: muted white, brightens on hover.
                isActive
                  ? "bg-purple-500/10 text-white"
                  : "bg-black/60 text-white/60 hover:bg-white/5 hover:text-white/90",
                isDragged && "opacity-40",
                isDropTarget && "ring-1 ring-inset ring-purple-500/60"
              )}
            >
              {/* Active tab indicator: a 2px purple bar along the top edge. */}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-0 right-0 top-0 h-0.5 bg-purple-500"
                />
              )}
              {/* Drop indicator: a 2px purple bar along the left edge. */}
              {isDropTarget && (
                <span
                  aria-hidden
                  className="absolute left-0 top-0 bottom-0 w-0.5 bg-purple-500"
                />
              )}

              {/* Favicon OR loading spinner. While the tab is loading we
                  show a spinner instead of the favicon so the user can
                  see at a glance which tabs are still fetching. */}
              {isLoading ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-purple-400" />
              ) : fav ? (
                <img
                  src={fav}
                  alt=""
                  className="size-3.5 shrink-0 rounded-sm"
                  // Google's favicon service returns a default globe icon
                  // for unknown domains, so we don't need a fallback.
                  referrerPolicy="no-referrer"
                  draggable={false}
                />
              ) : (
                <span className="size-3.5 shrink-0 rounded-sm bg-white/20" aria-hidden />
              )}

              {/* Tab title — truncated with ellipsis. */}
              <span className="flex-1 truncate">{title}</span>

              {/* Close button — stops propagation so clicking it doesn't
                  also switch to the tab. Only the active tab (or tabs the
                  user is hovering) show the button to reduce clutter. */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                aria-label={`Close ${title}`}
                className={cn(
                  "inline-flex size-4 shrink-0 items-center justify-center rounded text-white/50 transition-colors hover:bg-purple-500/30 hover:text-white",
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* "+" button — goes home where the user can type a new URL (which
          creates a new tab via navigate()). Styled to match the terminal
          aesthetic. */}
      <button
        type="button"
        onClick={goHome}
        aria-label="New tab"
        title="New tab (home)"
        className={cn(
          "flex shrink-0 items-center gap-1.5 border-l border-purple-500/20 px-3 py-2 text-xs text-white/60 transition-colors hover:bg-purple-500/10 hover:text-white"
        )}
      >
        <Plus className="size-3.5" />
        <span className="hidden sm:inline">new</span>
      </button>
    </div>
  );
}
