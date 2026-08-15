"use client";

import { useEffect, useRef } from "react";
import { useHypers0nic } from "@/store/hypers0nic";
import type { TinfoilPayload } from "@/lib/types";

export function useTinfoilAutoSync() {
  const tinfoil = useHypers0nic((s) => s.settings.tinfoil);
  const theme = useHypers0nic((s) => s.settings.theme);
  const tabCloak = useHypers0nic((s) => s.settings.tabCloak);
  const searchEngine = useHypers0nic((s) => s.settings.searchEngine);
  const preferences = useHypers0nic((s) => s.settings.preferences);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!tinfoil.connected || !tinfoil.username) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      const payload: TinfoilPayload = {
        tabCloak,
        theme,
        searchEngine,
        preferences,
      };

      const token = sessionStorage.getItem("hypers0nic:tinfoil-token");
      if (!token) return;

      try {
        await fetch("/api/tinfoil/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "sync",
            username: tinfoil.username,
            password: token,
            payload,
          }),
        });
      } catch {

      }
    }, 2000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [tinfoil.connected, tinfoil.username, theme, tabCloak, searchEngine, preferences]);
}
