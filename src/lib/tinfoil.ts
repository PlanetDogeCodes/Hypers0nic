import type { TinfoilPayload, Hypers0nicSettings } from "./types";

export interface TinfoilCredentials {

  endpoint: string;

  username: string;

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
