"use client";

import { useEffect, useRef } from "react";
import { useHypers0nic } from "@/store/hypers0nic";

/**
 * Panic key hook.
 *
 * When enabled, double-pressing the configured key within 500ms closes the
 * current Hypers0nic tab and opens the user's configured panic URL in a new
 * tab. This is the classic "teacher approaching" escape hatch.
 *
 * The double-press detection uses a ref-based timestamp to avoid re-renders.
 *
 * This listener is registered with `capture: true` so it runs BEFORE the
 * regular keyboard-shortcut handler, letting the panic key (which defaults to
 * Escape) intercept the first press. If the second press doesn't arrive
 * within 500ms, the first press is discarded and the regular Escape behavior
 * (go home / blur) fires normally on the next press.
 */
export function usePanicKey() {
  const enabled = useHypers0nic((s) => s.settings.preferences.panicKeyEnabled);
  const panicKey = useHypers0nic((s) => s.settings.preferences.panicKey);
  const panicUrl = useHypers0nic((s) => s.settings.preferences.panicUrl);
  const lastPressRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs.
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (isTyping) return;

      // Check if the pressed key matches the panic key.
      // For "Escape", check both e.key === "Escape" and e.key === "Esc".
      const keyMatch =
        e.key === panicKey ||
        (panicKey === "Escape" && (e.key === "Escape" || e.key === "Esc"));

      if (!keyMatch) return;

      const now = Date.now();
      if (now - lastPressRef.current < 500) {
        // Double-press detected — trigger panic.
        lastPressRef.current = 0;
        // Prevent the regular Escape handler from also firing.
        e.preventDefault();
        e.stopPropagation();
        // Open the panic URL in a new tab.
        window.open(panicUrl, "_blank");
        // Close the current tab. window.close() only works for tabs opened
        // by script, so as a fallback we redirect to the panic URL.
        try {
          window.close();
        } catch {
          // If we can't close, redirect to the panic URL.
          window.location.href = panicUrl;
        }
      } else {
        // First press — record the timestamp and suppress the regular handler
        // so the first Escape doesn't immediately go home. If no second press
        // arrives within 500ms, the user can press Escape again normally.
        lastPressRef.current = now;
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Capture phase so this runs before the regular keyboard-shortcut handler.
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [enabled, panicKey, panicUrl]);
}
