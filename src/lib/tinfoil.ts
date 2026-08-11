import type { TinfoilPayload, Hypers0nicSettings } from "./types";

// Tinf0il integration.
//
// Tinf0il stores a user profile (tab cloak, theme, search engine, preferences)
// on its own sync server. Hypers0nic never speaks to that server directly from
// the browser — instead it POSTs the credentials to our /api/tinfoil/sync route
// which performs the upstream fetch and normalises the payload into the shape
// defined by TinfoilPayload. This keeps tokens off the client and lets the
// server-side route adapt to whatever Tinf0il endpoint shape the user is on.

export interface TinfoilCredentials {
  /** Base URL of the Tinf0il sync instance, e.g. https://tinf0il.example.app */
  endpoint: string;
  /** Username or email on the Tinf0il instance. */
  username: string;
  /** Password or long-lived token. */
  token: string;
}

export interface TinfoilSyncResponse {
  ok: boolean;
  profile?: {
    username: string;
    payload: TinfoilPayload;
  };
  error?: string;
}

export async function syncTinfoil(
  creds: TinfoilCredentials
): Promise<TinfoilSyncResponse> {
  try {
    const res = await fetch("/api/tinfoil/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creds),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: text || `Tinf0il sync failed (HTTP ${res.status})` };
    }
    return (await res.json()) as TinfoilSyncResponse;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error contacting Tinf0il",
    };
  }
}

/**
 * Merge a Tinf0il payload into the current settings. Only fields actually
 * present in the payload are overridden, so partial profiles don't wipe local
 * configuration.
 */
export function applyTinfoilPayload(
  settings: Hypers0nicSettings,
  payload: TinfoilPayload,
  username: string
): Hypers0nicSettings {
  const next: Hypers0nicSettings = {
    ...settings,
    preferences: { ...settings.preferences },
    tabCloak: { ...settings.tabCloak },
    tinfoil: {
      connected: true,
      username,
      syncedAt: Date.now(),
      payload,
    },
  };
  if (payload.theme) next.theme = payload.theme;
  if (payload.searchEngine) next.searchEngine = payload.searchEngine;
  if (payload.tabCloak) {
    next.tabCloak = {
      enabled: payload.tabCloak.enabled ?? next.tabCloak.enabled,
      preset: payload.tabCloak.preset ?? next.tabCloak.preset,
      customTitle: payload.tabCloak.customTitle ?? next.tabCloak.customTitle,
      customIcon: payload.tabCloak.customIcon ?? next.tabCloak.customIcon,
    };
  }
  if (payload.preferences) {
    next.preferences = { ...next.preferences, ...payload.preferences };
  }
  return next;
}
