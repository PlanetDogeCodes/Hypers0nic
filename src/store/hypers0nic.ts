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
  ProxyTab,
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
  loadTabs,
  saveTabs,
  type FocusSessionRecord,
} from "@/lib/storage";
import { applyTheme } from "@/lib/themes";
import { applyTabCloak, getPreset } from "@/lib/tab-cloak";
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

  hydrated: boolean;

  view: View;
  omniboxValue: string;
  loading: boolean;
  proxyReady: boolean;

  navNonce: number;

  settings: Hypers0nicSettings;

  history: HistoryEntry[];

  bookmarks: Bookmark[];

  customShortcuts: CustomShortcut[];

  focusSessions: FocusSessionRecord[];
  todaySessionCount: number;
  todayFocusMinutes: number;
  focusStreak: number;

  scramjet: ScramjetStateSnapshot;

  tabs: ProxyTab[];
  activeTabId: string | null;
  loadingTabs: Record<string, boolean>;
  recentlyClosedTabs: { id: string; url: string; title: string }[];

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

  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  reorderTabs: (from: number, to: number) => void;
  setTabTitle: (id: string, title: string) => void;
  updateTabUrl: (id: string, url: string) => void;
  setTabLoading: (id: string, loading: boolean) => void;
  reopenClosedTab: () => void;
}

let swRegistered = false;
let swRegisterPromise: Promise<boolean> | null = null;

let inAboutBlankPopup = false;

function ensureServiceWorker(): Promise<boolean> {
  if (swRegistered && typeof navigator !== "undefined" && navigator.serviceWorker?.controller) {
    return Promise.resolve(true);
  }
  if (swRegisterPromise) return swRegisterPromise;
  swRegisterPromise = registerServiceWorker().then((ok) => {
    swRegistered = ok;
    swRegisterPromise = null;
    return ok;
  });
  return swRegisterPromise;
}

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
  tabs: [],
  activeTabId: null,
  loadingTabs: {},
  recentlyClosedTabs: [],

  hydrate: () => {
    if (get().hydrated) return;
    const settings = loadSettings();
    const history = loadHistory();
    const bookmarks = loadBookmarks();
    const focusSessions = loadFocusSessions();
    const customShortcuts = loadCustomShortcuts();

    const savedTabs = loadTabs();
    set({
      settings,
      history,
      bookmarks,
      customShortcuts,
      focusSessions,
      tabs: savedTabs,
      activeTabId: savedTabs.length > 0 ? savedTabs[0].id : null,
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

    getScramjet().subscribe((snap) => set({ scramjet: snap }));

    getScramjet().startHeartbeat();
    getScramjet().startVisibilityWatcher();

    ensureServiceWorker().then(() => {
      getScramjet().init(settings.wispUrl).catch(() => {});
    });

    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash;
      if (hash.startsWith("#go=")) {
        const targetUrl = decodeURIComponent(hash.substring(4));
        if (targetUrl) {
          inAboutBlankPopup = true;

          try {
            window.history.replaceState(null, "", window.location.pathname);
          } catch {}

          setTimeout(() => {
            get().navigate(targetUrl);
          }, 800);
        }
      }
    }
  },

  navigate: async (input) => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const { settings } = get();
    const engine = getSearchEngine(settings.searchEngine);
    const target = normalizeInput(trimmed, engine);

    if (settings.preferences.openInAboutBlank && !inAboutBlankPopup) {
      const appUrl =
        window.location.origin +
        window.location.pathname +
        "#go=" +
        encodeURIComponent(target);

      const cloak = settings.tabCloak;
      const preset = cloak.enabled
        ? getPreset(cloak.preset)
        : getPreset("default");
      const cloakTitle =
        cloak.preset === "custom"
          ? cloak.customTitle || "about:blank"
          : cloak.enabled
          ? preset.title
          : "about:blank";
      const cloakIcon =
        cloak.preset === "custom"
          ? cloak.customIcon || ""
          : cloak.enabled
          ? preset.icon || ""
          : "";

      const faviconTag = cloakIcon
        ? `<link rel="icon" href="${cloakIcon}">`
        : "";
      const popupHtml =
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\">" +
        "<title>" + cloakTitle + "</title>" +
        faviconTag +
        "<style>" +
        "html,body{margin:0;padding:0;overflow:hidden;background:#000;}" +
        "iframe{width:100vw;height:100vh;border:0;}" +
        "</style></head><body>" +
        "<iframe src=\"" + appUrl + "\" allow=\"fullscreen;autoplay;encrypted-media;clipboard-read;clipboard-write;picture-in-picture\" sandbox=\"allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-storage-access-by-user-activation\"></iframe>" +
        "</body></html>";

      let win: Window | null = null;
      try {
        win = window.open("about:blank", "_blank");
      } catch {
        win = null;
      }

      if (win) {
        try {
          win.document.write(popupHtml);
          win.document.close();
        } catch {

          try {
            win.location.href = appUrl;
          } catch {

            window.location.href = appUrl;
          }
        }
      } else {

        try {
          window.open(appUrl, "_blank");
        } catch {

          window.location.href = appUrl;
        }
      }
      return;
    }

    const nextNavNonce = get().navNonce + 1;
    const currentTabs = get().tabs;
    const currentActiveId = get().activeTabId;
    let updatedTabs: ProxyTab[];
    let newActiveId: string;
    if (get().view === "proxy" && currentActiveId) {

      updatedTabs = currentTabs.map((t) =>
        t.id === currentActiveId
          ? { ...t, url: target, title: target, navNonce: nextNavNonce }
          : t
      );
      newActiveId = currentActiveId;
    } else {

      const newTab: ProxyTab = {
        id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        url: target,
        title: target,
        navNonce: nextNavNonce,
      };

      if (currentTabs.length >= 8) {
        const [oldest, ...rest] = currentTabs;
        if (oldest) {
          get().recentlyClosedTabs.push({
            id: oldest.id,
            url: oldest.url,
            title: oldest.title,
          });
          set({
            recentlyClosedTabs: get().recentlyClosedTabs.slice(-20),
          });
        }
        updatedTabs = [...rest, newTab];
      } else {
        updatedTabs = [...currentTabs, newTab];
      }
      newActiveId = newTab.id;
    }
    saveTabs(updatedTabs);
    set({
      view: "proxy",
      omniboxValue: target,
      loading: true,
      navNonce: nextNavNonce,
      tabs: updatedTabs,
      activeTabId: newActiveId,
    });

    const sj = getScramjet();
    const tryInit = async () => {
      try {
        await sj.init(settings.wispUrl);
      } catch (err) {
        console.error("[hypers0nic] scramjet init failed, retrying:", err);
        sj.forceReconnect();
        await sj.init(settings.wispUrl);
      }
    };
    try {
      await tryInit();
    } catch (err) {
      console.error("[hypers0nic] scramjet init failed on retry:", err);
      set({ loading: false });
      return;
    }

    const swOk = await ensureServiceWorker();
    if (!swOk) {
      console.error("[hypers0nic] service worker not controlling after registration");
      set({ loading: false });
      return;
    }
    set({ proxyReady: true, loading: false });
  },

  goHome: () => {
    set({ view: "home", omniboxValue: "", loading: false });
  },

  goBack: () => {

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

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const closed = tabs[idx];
    if (!closed) return;

    const recentlyClosedTabs = [
      ...get().recentlyClosedTabs,
      { id: closed.id, url: closed.url, title: closed.title },
    ].slice(-20);
    const remaining = tabs.filter((t) => t.id !== id);
    saveTabs(remaining);

    if (activeTabId === id) {
      if (remaining.length === 0) {

        set({
          tabs: remaining,
          activeTabId: null,
          recentlyClosedTabs,
          view: "home",
          omniboxValue: "",
          loading: false,
        });
        return;
      }

      const nextActive = remaining[Math.min(idx, remaining.length - 1)];
      if (nextActive) {
        set({
          tabs: remaining,
          activeTabId: nextActive.id,
          recentlyClosedTabs,
          omniboxValue: nextActive.url,
          view: "proxy",
          navNonce: get().navNonce + 1,
          loading: true,
        });
      } else {
        set({ tabs: remaining, activeTabId: null, recentlyClosedTabs, view: "home", loading: false });
      }
    } else {
      set({ tabs: remaining, recentlyClosedTabs });
    }
  },

  switchTab: (id) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    set({
      activeTabId: id,
      omniboxValue: tab.url,
      view: "proxy",
      navNonce: get().navNonce + 1,
      loading: true,
    });
  },

  reorderTabs: (from, to) => {
    const { tabs } = get();
    if (
      from < 0 || from >= tabs.length ||
      to < 0 || to >= tabs.length ||
      from === to
    ) return;
    const next = [...tabs];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    saveTabs(next);
    set({ tabs: next });
  },

  setTabTitle: (id, title) => {
    const { tabs } = get();
    const next = tabs.map((t) => (t.id === id ? { ...t, title } : t));
    saveTabs(next);
    set({ tabs: next });
  },

  updateTabUrl: (id, url) => {
    const { tabs, activeTabId } = get();
    const next = tabs.map((t) => (t.id === id ? { ...t, url } : t));
    saveTabs(next);

    const patch: Partial<Hypers0nicStore> = { tabs: next };
    if (activeTabId === id) patch.omniboxValue = url;
    set(patch);
  },

  setTabLoading: (id, loading) => {
    const { loadingTabs } = get();
    const next = { ...loadingTabs };
    if (loading) {
      next[id] = true;
    } else {
      delete next[id];
    }
    set({ loadingTabs: next });
  },

  reopenClosedTab: () => {
    const { recentlyClosedTabs, tabs, navNonce } = get();
    if (recentlyClosedTabs.length === 0) return;
    const last = recentlyClosedTabs[recentlyClosedTabs.length - 1];
    if (!last) return;
    const recentlyClosed = recentlyClosedTabs.slice(0, -1);

    let nextTabs: ProxyTab[];
    if (tabs.length >= 8) {
      const [, ...rest] = tabs;
      nextTabs = [...rest, { id: last.id, url: last.url, title: last.title, navNonce: navNonce + 1 }];
    } else {
      nextTabs = [...tabs, { id: last.id, url: last.url, title: last.title, navNonce: navNonce + 1 }];
    }
    saveTabs(nextTabs);
    set({
      tabs: nextTabs,
      activeTabId: last.id,
      recentlyClosedTabs: recentlyClosed,
      omniboxValue: last.url,
      view: "proxy",
      navNonce: navNonce + 1,
      loading: true,
    });
  },
}));
