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

/**
 * Global keyboard shortcuts.
 *
 *   Ctrl+K         Open the command palette (fuzzy search everything)
 *   /              Focus the omnibox directly
 *   Esc            Go home / close overlays
 *   Ctrl+,         Open settings
 *   Ctrl+H         Toggle history panel
 *   Ctrl+`         Toggle stealth mode (instant tab cloak)
 *   Ctrl+Shift+A   Open the apps panel
 *   Ctrl+Shift+T   Reopen the most recently closed tab
 *   Alt+←          Go back (proxy view)
 *   Alt+→          Go forward (proxy view)
 */
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

      // If a dialog/sheet is open, let it handle Escape and other keys — don't
      // fight Radix's own focus management.
      const dialogOpen =
        typeof document !== "undefined" &&
        (document.querySelector('[role="dialog"]') ||
          document.querySelector('[data-state="open"]'));

      // Ctrl+K → command palette (works everywhere, even when typing)
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        handlers.onOpenPalette?.();
        return;
      }

      // Ctrl+,  → settings (works everywhere)
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        handlers.onOpenSettings?.();
        return;
      }

      // Ctrl+H → history (works everywhere, but not when a dialog is open)
      if ((e.ctrlKey || e.metaKey) && e.key === "h" && !e.shiftKey && !dialogOpen) {
        e.preventDefault();
        handlers.onOpenHistory?.();
        return;
      }

      // Ctrl+Shift+A → open apps panel (works everywhere, not in a dialog)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "A" || e.key === "a") && !dialogOpen) {
        e.preventDefault();
        handlers.onOpenApps?.();
        return;
      }

      // Ctrl+Shift+T → reopen the most recently closed tab (works everywhere
      // except when a dialog is open — the dialog might consume Ctrl+T itself)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "T" || e.key === "t") && !dialogOpen) {
        e.preventDefault();
        handlers.onReopenClosedTab?.();
        return;
      }

      // Ctrl+` → toggle stealth mode (instant tab cloak)
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

      // Alt+Arrow Left/Right → back/forward in proxy
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

      // Esc → go home (only when no dialog is open and not typing)
      if (e.key === "Escape") {
        if (dialogOpen) return; // let the dialog close itself
        if (isTyping) {
          (target as HTMLElement).blur();
        } else {
          goHome();
        }
        return;
      }

      // "/" → focus omnibox (only when not already typing and no dialog)
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
