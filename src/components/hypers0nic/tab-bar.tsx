"use client";

import { useState, useRef, useCallback } from "react";
import { X, Plus, Globe } from "lucide-react";
import { useHypers0nic } from "@/store/hypers0nic";
import { getScramjet } from "@/lib/scramjet";
import { cn } from "@/lib/utils";

export function TabBar() {
  const tabs = useHypers0nic((s) => s.tabs);
  const activeTabId = useHypers0nic((s) => s.activeTabId);
  const loadingTabs = useHypers0nic((s) => s.loadingTabs);
  const switchTab = useHypers0nic((s) => s.switchTab);
  const closeTab = useHypers0nic((s) => s.closeTab);
  const reorderTabs = useHypers0nic((s) => s.reorderTabs);
  const goHome = useHypers0nic((s) => s.goHome);
  const scramjet = useHypers0nic((s) => s.scramjet);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const getFaviconUrl = useCallback(
    (url: string): string => {
      try {
        const u = new URL(url);

        const favUrl = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
        const sj = getScramjet();
        if (sj && sj.getState().status === "ready") {
          return sj.encodeUrl(favUrl);
        }
        return favUrl;
      } catch {
        return "";
      }
    },
    [scramjet.status]
  );

  if (tabs.length === 0) return null;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", String(index));
    } catch {

    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overIndex !== index) setOverIndex(index);
  };

  const handleDragLeave = () => {
    setOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    setOverIndex(null);
    setDragIndex(null);
    dragIndexRef.current = null;
    if (from === null || from === index) return;
    reorderTabs(from, index);
  };

  const handleDragEnd = () => {
    setOverIndex(null);
    setDragIndex(null);
    dragIndexRef.current = null;
  };

  const connStatus = scramjet.status;
  const connDotClass =
    connStatus === "ready"
      ? "bg-emerald-500"
      : connStatus === "loading"
      ? "bg-amber-400"
      : connStatus === "error"
      ? "bg-red-500"
      : "bg-muted-foreground/60";
  const connTitle =
    connStatus === "ready"
      ? "Proxy connected"
      : connStatus === "loading"
      ? "Connecting…"
      : connStatus === "error"
      ? `Connection error${scramjet.error ? ": " + scramjet.error : ""}`
      : "Proxy idle";

  return (
    <div
      className="fixed left-0 right-0 top-0 z-60 flex h-8 items-center gap-1 overflow-x-auto border-b border-border/30 bg-background/95 px-2 backdrop-blur-md"
      role="tablist"
      aria-label="Proxy tabs"
      style={{ zIndex: 60 }}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTabId;
        const isLoading = !!loadingTabs[tab.id];
        const favUrl = getFaviconUrl(tab.url);
        const isDragging = dragIndex === index;
        const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                switchTab(tab.id);
              } else if (e.key === "Delete" || (e.key === "w" && (e.ctrlKey || e.metaKey))) {
                e.preventDefault();
                closeTab(tab.id);
              }
            }}
            onClick={() => switchTab(tab.id)}
            className={cn(
              "group relative flex h-6 min-w-0 max-w-[14rem] shrink cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs transition-all duration-150",
              "font-mono",
              isActive
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border/30 bg-card/40 text-muted-foreground hover:border-border/60 hover:bg-card/70 hover:text-foreground",
              isDragging && "opacity-40",
              isOver && "ring-2 ring-primary/50 ring-offset-1 ring-offset-background"
            )}
            title={tab.title || tab.url}
          >
            <span className="flex size-3.5 shrink-0 items-center justify-center">
              {isLoading ? (
                <Globe className="size-3 animate-pulse text-primary" />
              ) : favUrl ? (
                <img
                  src={favUrl}
                  alt=""
                  className="size-3.5 rounded-sm object-contain"
                  loading="lazy"
                  onError={(e) => {

                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <Globe className="size-3" />
              )}
            </span>

            <span className="truncate">
              {tab.title || tab.url}
            </span>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label={`Close ${tab.title || tab.url}`}
              className={cn(
                "ml-auto flex size-4 shrink-0 items-center justify-center rounded-sm transition-colors",
                isActive
                  ? "text-primary/70 hover:bg-primary/20 hover:text-primary"
                  : "text-muted-foreground/70 hover:bg-muted hover:text-foreground"
              )}
            >
              <X className="size-3" />
            </button>

            {isLoading && (
              <span
                className="tab-loading-bar pointer-events-none absolute bottom-0 left-0 h-0.5 bg-[#a855f7]"
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={goHome}
        aria-label="New tab"
        title="New tab"
        className="ml-1 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
      >
        <Plus className="size-3.5" />
      </button>

      <span
        className={cn(
          "ml-auto size-2 shrink-0 rounded-full transition-colors",
          connDotClass,
          connStatus === "loading" && "animate-pulse"
        )}
        role="status"
        aria-label={connTitle}
        title={connTitle}
      />
    </div>
  );
}
