"use client";

import { useEffect, useRef } from "react";
import { useHypers0nic } from "@/store/hypers0nic";
import type { TinfoilPayload } from "@/lib/types";

/**
 * Auto-syncs Hypers0nic settings to the connected Tinf0il account.
 *
 * When the user is logged in to Tinf0il, any change to their theme, tab
 * cloak, search engine, or preferences triggers a debounced push to the
 * Tinf0il sync API. This means settings are automatically backed up to the
 * cloud and can be restored on any device by logging in.
 *
 * The sync is debounced by 2 seconds to avoid hammering the API on rapid
 * setting changes (e.g. dragging a slider).
 */
export function useTinfoilAutoSync() {
  const tinfoil = useHypers0nic((s) => s.settings.tinfoil);
  const theme = useHypers0nic((s) => s.settings.theme);
  const tabCloak = useHypers0nic((s) => s.settings.tabCloak);
  const searchEngine = useHypers0nic((s) => s.settings.searchEngine);
  const preferences = useHypers0nic((s) => s.settings.preferences);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // We need the username and password to sync. Since we don't store the
  // password (for security), we store a sync token after login that the
  // sync API can use. For now, we use the tinfoil profile's username and
  // a session token stored in sessionStorage.
  useEffect(() => {
    if (!tinfoil.connected || !tinfoil.username) return;

    // Debounce the sync to avoid rapid-fire API calls.
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      const payload: TinfoilPayload = {
        tabCloak,
        theme,
        searchEngine,
        preferences,
      };

      // Get the sync token from sessionStorage (set during login).
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
        // Silently ignore sync errors — settings are still saved locally.
      }
    }, 2000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [tinfoil.connected, tinfoil.username, theme, tabCloak, searchEngine, preferences]);
}
