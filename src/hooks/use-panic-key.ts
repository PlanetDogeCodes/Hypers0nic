"use client";

import { useEffect, useRef } from "react";
import { useHypers0nic } from "@/store/hypers0nic";

export function usePanicKey() {
  const enabled = useHypers0nic((s) => s.settings.preferences.panicKeyEnabled);
  const panicKey = useHypers0nic((s) => s.settings.preferences.panicKey);
  const panicUrl = useHypers0nic((s) => s.settings.preferences.panicUrl);
  const lastPressRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {

      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (isTyping) return;

      const keyMatch =
        e.key === panicKey ||
        (panicKey === "Escape" && (e.key === "Escape" || e.key === "Esc"));

      if (!keyMatch) return;

      const now = Date.now();
      if (now - lastPressRef.current < 500) {

        lastPressRef.current = 0;

        e.preventDefault();
        e.stopPropagation();

        window.open(panicUrl, "_blank");

        try {
          window.close();
        } catch {

          window.location.href = panicUrl;
        }
      } else {

        lastPressRef.current = now;
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [enabled, panicKey, panicUrl]);
}
