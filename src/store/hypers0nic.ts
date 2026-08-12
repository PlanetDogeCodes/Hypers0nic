"use client";

import { create } from "zustand";
import type {
  Hypers0nicSettings,
  HistoryEntry,
  Bookmark,
  CustomShortcut,
  View,
  ThemeId,
  TabCloakConfig,
  Preferences,
} from "@/lib/types";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  loadHistory,
  saveHistory,
  loadBookmarks,
  saveBookmarks,
  loadFocusSessions,
  saveFocusSessions,
  countTodaySessions,
  minutesToday,
  computeStreak,
  loadCustomShortcuts,
  saveCustomShortcuts,
  type FocusSessionRecord,
} from "@/lib/storage";
import { applyTheme } from "@/lib/themes";
import { applyTabCloak } from "@/lib/tab-cloak";
import {
  getScramjet,
  registerServiceWorker,
  type ScramjetStateSnapshot,
} from "@/lib/scramjet";
import {
  syncTinfoil,
  applyTinfoilPayload,
  type TinfoilCredentials,
} from "@/lib/tinfoil";
import { getSearchEngine, normalizeInput } from "@/lib/search-engines";

interface Hypers0nicStore {
  // --- boot ---
  hydrated: boolean;

  // --- view ---
  view: View;
  omniboxValue: string;
  loading: boolean;
  proxyReady: boolean;
  // Monotonically increasing counter that bumps ONLY on user-initiated
  // navigation (navigate()). It is NOT bumped by setOmnibox(), which is
  // called by Scramjet's urlchange/navigate events to update the omnibox
  // display. ProxyFrame's navigation effect depends on this nonce instead
  // of omniboxValue, so the feedback loop (go -> urlchange -> setOmnibox ->
  // go again) is broken: the first load is kept, no reload happens.
  navNonce: number;

  // --- settings ---
  settings: Hypers0nicSettings;

  // --- history ---
  history: HistoryEntry[];

  // --- bookmarks ---
  bookmarks: Bookmark[];

  // --- custom shortcuts ---
  customShortcuts: CustomShortcut[];

  // --- focus sessions ---
  focusSessions: FocusSessionRecord[];
  todaySessionCount: number;
  todayFocusMinutes: number;
  focusStreak: number;

  // --- scramjet ---
  scramjet: ScramjetStateSnapshot;

  // --- actions ---
  hydrate: () => void;
  navigate: (input: string) => Promise<void>;
  goHome: () => void;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  setOmnibox: (value: string) => void;
  setTheme: (theme: ThemeId) => void;
  setTabCloak: (cloak: Partial<TabCloakConfig>) => void;
  setSearchEngine: (id: string) => void;
  setPreferences: (prefs: Partial<Preferences>) => void;
  setWispUrl: (url: string) => void;
  connectTinfoil: (creds: TinfoilCredentials) => Promise<{ ok: boolean; error?: string }>;
  disconnectTinfoil: () => void;
  recordVisit: (url: string, title: string) => void;
  clearHistory: () => void;
  toggleBookmark: (url: string, title: string) => void;
  isBookmarked: (url: string) => boolean;
  removeBookmark: (url: string) => void;
  toggleStealth: () => void;
  recordFocusSession: (durationMinutes: number) => void;
  addCustomShortcut: (shortcut: Omit<CustomShortcut, "id" | "addedAt">) => void;
  removeCustomShortcut: (id: string) => void;
}

let swRegistered = false;

export const useHypers0nic = create<Hypers0nicStore>((set, get) => ({
  hydrated: false,
  view: "home",
  omniboxValue: "",
  loading: false,
  proxyReady: false,
  navNonce: 0,
  settings: DEFAULT_SETTINGS,
  history: [],
  bookmarks: [],
  customShortcuts: [],
  focusSessions: [],
  todaySessionCount: 0,
  todayFocusMinutes: 0,
  focusStreak: 0,
  scramjet: { status: "idle" },

  hydrate: () => {
    if (get().hydrated) return;
    const settings = loadSettings();
    const history = loadHistory();
    const bookmarks = loadBookmarks();
    const focusSessions = loadFocusSessions();
    const customShortcuts = loadCustomShortcuts();
    set({
      settings,
      history,
      bookmarks,
      customShortcuts,
      focusSessions,
      todaySessionCount: countTodaySessions(focusSessions),
      todayFocusMinutes: minutesToday(focusSessions),
      focusStreak: computeStreak(focusSessions),
      hydrated: true,
    });
    applyTheme(settings.theme);
    if (settings.tabCloak.enabled) {
      applyTabCloak(
        settings.tabCloak.preset,
        settings.tabCloak.customTitle,
        settings.tabCloak.customIcon
      );
    }
    // Subscribe to scramjet state so the UI reacts to boot progress.
    getScramjet().subscribe((snap) => set({ scramjet: snap }));
    // Auto-warm the proxy on page load. This pre-initialises the Scramjet
    // controller and registers the service worker so that the first search
    // is instant, avoiding the "Cannot read properties of undefined (reading
    // 'prefix')" race condition that occurs when the SW intercepts a request
    // before the controller has finished booting.
    if (!swRegistered) {
      swRegistered = true;
      registerServiceWorker();
    }
    // Kick off the scramjet init in the background (don't await — we don't
    // want to block hydration). The init promise is memoised, so when the
    // user actually navigates it will resolve immediately if already done.
    getScramjet().init(settings.wispUrl).catch(() => {
      // Silently ignore — will retry on first navigation.
    });
  },

  navigate: async (input) => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const { settings } = get();
    const engine = getSearchEngine(settings.searchEngine);
    const target = normalizeInput(trimmed, engine);

    // If the about:blank preference is enabled, open the proxied URL in a new
    // about:blank tab. This creates a blank window and writes a meta-refresh
    // redirect to the encoded proxy URL, so the tab appears as "about:blank"
    // in the browser's tab list while loading the proxied content.
    if (settings.preferences.openInAboutBlank) {
      const sj = getScramjet();
      try {
        await sj.init(settings.wispUrl);
      } catch {
        /* will retry on next navigation */
      }
      if (!swRegistered) {
        swRegistered = true;
        await registerServiceWorker();
      }
      const encoded = sj.encodeUrl(target);
      const win = window.open("about:blank", "_blank");
      if (win) {
        win.document.write(
          `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${encoded}"><title>about:blank</title></head><body></body></html>`
        );
        win.document.close();
      }
      return;
    }

    set({ view: "proxy", omniboxValue: target, loading: true, navNonce: get().navNonce + 1 });

    // Boot scramjet lazily on first navigation. The promise is memoised inside
    // the manager so subsequent navigations are instant. If init fails, we
    // force-reconnect and retry once before giving up — this handles the case
    // where the transport silently dropped (e.g. wisp relay restarted).
    const sj = getScramjet();
    try {
      await sj.init(settings.wispUrl);
    } catch (err) {
      console.error("[hypers0nic] scramjet init failed, retrying:", err);
      sj.forceReconnect();
      try {
        await sj.init(settings.wispUrl);
      } catch (err2) {
        console.error("[hypers0nic] scramjet init failed on retry:", err2);
        set({ loading: false });
        return;
      }
    }
    // Make sure the service worker is up before we ask it to intercept.
    if (!swRegistered) {
      swRegistered = true;
      await registerServiceWorker();
    }
    set({ proxyReady: true, loading: false });
    // The ProxyFrame component reads `omniboxValue` and drives the iframe.
  },

  goHome: () => {
    set({ view: "home", omniboxValue: "", loading: false });
  },

  goBack: () => {
    // Back/forward is delegated to the ScramjetFrame instance living inside
    // ProxyFrame. We emit a window event the frame listens for.
    window.dispatchEvent(new CustomEvent("hypers0nic:navigate", { detail: { action: "back" } }));
  },

  goForward: () => {
    window.dispatchEvent(new CustomEvent("hypers0nic:navigate", { detail: { action: "forward" } }));
  },

  reload: () => {
    window.dispatchEvent(new CustomEvent("hypers0nic:navigate", { detail: { action: "reload" } }));
  },

  setOmnibox: (value) => set({ omniboxValue: value }),

  setTheme: (theme) => {
    const settings = { ...get().settings, theme };
    set({ settings });
    saveSettings(settings);
    applyTheme(theme);
  },

  setTabCloak: (cloak) => {
    const settings = {
      ...get().settings,
      tabCloak: { ...get().settings.tabCloak, ...cloak },
    };
    set({ settings });
    saveSettings(settings);
    if (settings.tabCloak.enabled) {
      applyTabCloak(
        settings.tabCloak.preset,
        settings.tabCloak.customTitle,
        settings.tabCloak.customIcon
      );
    } else {
      applyTabCloak("default");
    }
  },

  setSearchEngine: (id) => {
    const settings = { ...get().settings, searchEngine: id };
    set({ settings });
    saveSettings(settings);
  },

  setPreferences: (prefs) => {
    const settings = {
      ...get().settings,
      preferences: { ...get().settings.preferences, ...prefs },
    };
    set({ settings });
    saveSettings(settings);
  },

  setWispUrl: (url) => {
    const settings = { ...get().settings, wispUrl: url };
    set({ settings });
    saveSettings(settings);
  },

  connectTinfoil: async (creds) => {
    const res = await syncTinfoil(creds);
    if (!res.ok || !res.profile) {
      return { ok: false, error: res.error };
    }
    const settings = applyTinfoilPayload(
      get().settings,
      res.profile.payload,
      res.profile.username
    );
    set({ settings });
    saveSettings(settings);
    applyTheme(settings.theme);
    if (settings.tabCloak.enabled) {
      applyTabCloak(
        settings.tabCloak.preset,
        settings.tabCloak.customTitle,
        settings.tabCloak.customIcon
      );
    }
    return { ok: true };
  },

  disconnectTinfoil: () => {
    const settings: Hypers0nicSettings = {
      ...get().settings,
      tinfoil: { connected: false },
    };
    set({ settings });
    saveSettings(settings);
  },

  recordVisit: (url, title) => {
    const { settings, history } = get();
    if (settings.preferences.hideFromHistory) return;
    const next = [
      { url, title: title || url, visitedAt: Date.now() },
      ...history.filter((h) => h.url !== url),
    ].slice(0, 200);
    set({ history: next });
    saveHistory(next);
  },

  clearHistory: () => {
    set({ history: [] });
    saveHistory([]);
  },

  toggleBookmark: (url, title) => {
    const existing = get().bookmarks;
    const next = existing.some((b) => b.url === url)
      ? existing.filter((b) => b.url !== url)
      : [{ url, title: title || url, addedAt: Date.now() }, ...existing];
    set({ bookmarks: next });
    saveBookmarks(next);
  },

  isBookmarked: (url) => get().bookmarks.some((b) => b.url === url),

  removeBookmark: (url) => {
    const next = get().bookmarks.filter((b) => b.url !== url);
    set({ bookmarks: next });
    saveBookmarks(next);
  },

  toggleStealth: () => {
    const current = get().settings.tabCloak;
    const enabled = !current.enabled;
    const preset = enabled ? "classroom" : current.preset;
    const settings = {
      ...get().settings,
      tabCloak: { ...current, enabled, preset },
    };
    set({ settings });
    saveSettings(settings);
    if (enabled) {
      applyTabCloak("classroom", current.customTitle, current.customIcon);
    } else {
      applyTabCloak("default");
    }
  },

  recordFocusSession: (durationMinutes) => {
    const record: FocusSessionRecord = {
      date: new Date().toISOString().slice(0, 10),
      duration: durationMinutes,
      completedAt: Date.now(),
    };
    const sessions = [...get().focusSessions, record];
    set({
      focusSessions: sessions,
      todaySessionCount: countTodaySessions(sessions),
      todayFocusMinutes: minutesToday(sessions),
      focusStreak: computeStreak(sessions),
    });
    saveFocusSessions(sessions);
  },

  addCustomShortcut: (shortcut) => {
    const newShortcut: CustomShortcut = {
      ...shortcut,
      id: `cs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      addedAt: Date.now(),
    };
    const next = [...get().customShortcuts, newShortcut];
    set({ customShortcuts: next });
    saveCustomShortcuts(next);
  },

  removeCustomShortcut: (id) => {
    const next = get().customShortcuts.filter((s) => s.id !== id);
    set({ customShortcuts: next });
    saveCustomShortcuts(next);
  },
}));
