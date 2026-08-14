"use client";

import { useHypers0nic } from "@/store/hypers0nic";
import { cn } from "@/lib/utils";
import { X, Plus, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";

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

export function TabBar() {
  const tabs = useHypers0nic((s) => s.tabs);
  const activeTabId = useHypers0nic((s) => s.activeTabId);
  const loadingTabs = useHypers0nic((s) => s.loadingTabs);
  const switchTab = useHypers0nic((s) => s.switchTab);
  const closeTab = useHypers0nic((s) => s.closeTab);
  const reorderTabs = useHypers0nic((s) => s.reorderTabs);
  const goHome = useHypers0nic((s) => s.goHome);
  const view = useHypers0nic((s) => s.view);

  const [dragIndex, setDragIndex] = useState(-1);
  const [dragOverIndex, setDragOverIndex] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dragIndex >= tabs.length) setDragIndex(-1);
    if (dragOverIndex >= tabs.length) setDragOverIndex(-1);
  }, [tabs.length, dragIndex, dragOverIndex]);

  // Always show the tab bar when there are 2+ tabs, even on the home view.
  if (tabs.length <= 1) return null;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDragIndex(index);
    try {
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
      className="sticky top-0 z-[60] flex items-stretch border-b border-purple-500/20 bg-black font-mono text-white"
      style={{ boxShadow: "inset 0 -1px 0 0 rgba(168, 85, 247, 0.15)" }}
    >
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
                "group relative flex max-w-[200px] min-w-[120px] cursor-pointer items-center gap-2 border-r border-purple-500/10 px-3 py-1.5 text-xs transition-colors select-none",
                isActive
                  ? "bg-purple-500/10 text-white"
                  : "bg-black/60 text-white/60 hover:bg-white/5 hover:text-white/90",
                isDragged && "opacity-40",
                isDropTarget && "ring-1 ring-inset ring-purple-500/60"
              )}
            >
              {isActive && (
                <span aria-hidden className="absolute left-0 right-0 top-0 h-0.5 bg-purple-500" />
              )}
              {isDropTarget && (
                <span aria-hidden className="absolute left-0 top-0 bottom-0 w-0.5 bg-purple-500" />
              )}
              {isLoading ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-purple-400" />
              ) : fav ? (
                <img src={fav} alt="" className="size-3.5 shrink-0 rounded-sm" referrerPolicy="no-referrer" draggable={false} />
              ) : (
                <span className="size-3.5 shrink-0 rounded-sm bg-white/20" aria-hidden />
              )}
              <span className="flex-1 truncate">{title}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
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
      <button
        type="button"
        onClick={goHome}
        aria-label="New tab"
        title="New tab (home)"
        className="flex shrink-0 items-center gap-1.5 border-l border-purple-500/20 px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-purple-500/10 hover:text-white"
      >
        <Plus className="size-3.5" />
        <span className="hidden sm:inline">new</span>
      </button>
    </div>
  );
}
