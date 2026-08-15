"use client";

import { useEffect } from "react";
import { useHypers0nic } from "@/store/hypers0nic";
import { toast } from "sonner";

interface ShortcutHandlers {
  onOpenSettings?: () => void;
  onOpenHistory?: () => void;
  onOpenPalette?: () => void;
  onOpenApps?: () => void;
  onReopenClosedTab?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const goHome = useHypers0nic((s) => s.goHome);
  const view = useHypers0nic((s) => s.view);
  const goBack = useHypers0nic((s) => s.goBack);
  const goForward = useHypers0nic((s) => s.goForward);
  const toggleStealth = useHypers0nic((s) => s.toggleStealth);
  const stealthOn = useHypers0nic((s) => s.settings.tabCloak.enabled);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      const dialogOpen =
        typeof document !== "undefined" &&
        (document.querySelector('[role="dialog"]') ||
          document.querySelector('[data-state="open"]'));

      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        handlers.onOpenPalette?.();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        handlers.onOpenSettings?.();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "h" && !e.shiftKey && !dialogOpen) {
        e.preventDefault();
        handlers.onOpenHistory?.();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "A" || e.key === "a") && !dialogOpen) {
        e.preventDefault();
        handlers.onOpenApps?.();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "T" || e.key === "t") && !dialogOpen) {
        e.preventDefault();
        handlers.onReopenClosedTab?.();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "`") {
        e.preventDefault();
        toggleStealth();
        toast.success(
          stealthOn
            ? "Stealth mode disabled"
            : "Stealth mode active · Tab disguised as Classroom"
        );
        return;
      }

      if (e.altKey && e.key === "ArrowLeft" && view === "proxy") {
        e.preventDefault();
        goBack();
        return;
      }
      if (e.altKey && e.key === "ArrowRight" && view === "proxy") {
        e.preventDefault();
        goForward();
        return;
      }

      if (e.key === "Escape") {
        if (dialogOpen) return;
        if (isTyping) {
          (target as HTMLElement).blur();
        } else {
          goHome();
        }
        return;
      }

      if (!dialogOpen && !isTyping && e.key === "/") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>(
          'input[aria-label="Search or enter a URL"]'
        );
        input?.focus();
        input?.select();
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, goHome, goBack, goForward, toggleStealth, stealthOn, handlers]);
}
