"use client";

import { create } from "zustand";
import type {
  Hypers0nicSettings,
  HistoryEntry,
  Bookmark,
  CustomShortcut,
  ProxyTab,
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

  // --- proxy tabs ---
  tabs: ProxyTab[];
  activeTabId: string | null;
  loadingTabs: Record<string, boolean>;
  recentlyClosedTabs: { id: string; url: string; title: string }[];

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
  // tab actions
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  setTabTitle: (id: string, title: string) => void;
  updateTabUrl: (id: string, url: string) => void;
  setTabLoading: (id: string, loading: boolean) => void;
  reopenClosedTab: () => void;
}

let swRegistered = false;
let swRegisterPromise: Promise<boolean> | null = null;

// When the app is opened inside an about:blank popup (via the openInAboutBlank
// feature), it loads with a #go=<url> hash. This flag is set true on such
// loads so that subsequent navigations happen IN-PLACE (within the popup)
// instead of opening yet another about:blank popup. Without this, every link
// click inside the popup would spawn a new popup, creating an infinite chain.
let inAboutBlankPopup = false;

// Ensure the service worker is registered and controlling. Returns true if
// the SW is actively controlling the page. This function is idempotent —
// multiple calls share the same registration promise, preventing race
// conditions where hydrate() and navigate() both try to register the SW.
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
    // Subscribe to scramjet state so the UI reacts to boot progress.
    getScramjet().subscribe((snap) => set({ scramjet: snap }));
    // Auto-warm the proxy on page load. Register the SW first (awaited), then
    // init Scramjet. This ordering prevents the race condition where the SW
    // intercepts a /service/ request before the controller has finished
    // booting. Both are non-blocking to hydration.
    ensureServiceWorker().then(() => {
      getScramjet().init(settings.wispUrl).catch(() => {});
    });

    // --- Hash-based deep linking for about:blank popups ---
    // When the openInAboutBlank feature opens a popup, it loads the app with
    // a #go=<url> hash. On hydrate, we detect this hash, decode the target
    // URL, set the inAboutBlankPopup flag (so navigations happen in-place
    // instead of spawning more popups), and auto-navigate to the target.
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash;
      if (hash.startsWith("#go=")) {
        const targetUrl = decodeURIComponent(hash.substring(4));
        if (targetUrl) {
          inAboutBlankPopup = true;
          // Clear the hash so it doesn't interfere with future navigations
          // or get picked up on refresh.
          try {
            window.history.replaceState(null, "", window.location.pathname);
          } catch {}
          // Defer navigation to allow the UI to mount first. The ProxyFrame
          // component needs to be rendered before we can drive the iframe.
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

    // If the about:blank preference is enabled AND we're not already inside
    // an about:blank popup, open the target in a new about:blank tab.
    //
    // Approach: open about:blank, then write a document containing a
    // full-screen <iframe> that loads the app with a #go=<url> hash. The
    // iframe is same-origin, so the service worker intercepts /service/*
    // requests normally. The popup's address bar stays "about:blank"
    // because no top-level navigation occurs — only the iframe navigates.
    //
    // The #go= hash is detected by hydrate() on the iframe's app load,
    // which auto-navigates to the target URL and sets inAboutBlankPopup=true
    // so subsequent navigations happen in-place.
    //
    // Fallbacks:
    //   1. If window.open("about:blank") returns null (popup blocker),
    //      fall back to opening the app URL directly in a new tab.
    //   2. If that also fails, navigate in the current tab.
    if (settings.preferences.openInAboutBlank && !inAboutBlankPopup) {
      const appUrl =
        window.location.origin +
        window.location.pathname +
        "#go=" +
        encodeURIComponent(target);

      // Determine the cloak title/icon for the popup document.
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

      // Build the popup HTML. The iframe fills the entire viewport. The
      // title and favicon are set to match the current cloak so the popup
      // tab blends in with the user's other tabs.
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

      // CRITICAL: window.open must be called synchronously within the user
      // gesture (the Enter key press). Do NOT await anything before this
      // call — popup blockers check for user-activation, which expires
      // after any await.
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
          // document.write failed (cross-origin restriction?) — fall back
          // to opening the app URL directly. The address bar won't show
          // about:blank, but the content will load.
          try {
            win.location.href = appUrl;
          } catch {
            // Last resort: navigate the current tab.
            window.location.href = appUrl;
          }
        }
      } else {
        // Popup blocker prevented about:blank. Fall back to opening the
        // app URL directly in a new tab. The address bar will show the
        // app URL instead of about:blank, but the content still loads.
        try {
          window.open(appUrl, "_blank");
        } catch {
          // Last resort: navigate the current tab.
          window.location.href = appUrl;
        }
      }
      return;
    }

    // Create a new tab or update the active tab's URL.
    const state = get();
    const tabId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let newTabs: ProxyTab[];

    if (state.activeTabId && state.view === "proxy") {
      // Update the active tab's URL and bump its navNonce.
      newTabs = state.tabs.map((t) =>
        t.id === state.activeTabId
          ? { ...t, url: target, navNonce: t.navNonce + 1 }
          : t
      );
    } else {
      // Create a new tab (max 8).
      if (state.tabs.length >= 8) {
        // Close the oldest tab to make room.
        newTabs = [...state.tabs.slice(1), { id: tabId, url: target, title: target, navNonce: 1 }];
      } else {
        newTabs = [...state.tabs, { id: tabId, url: target, title: target, navNonce: 1 }];
      }
    }

    const activeId = state.activeTabId && state.view === "proxy" ? state.activeTabId : newTabs[newTabs.length - 1].id;
    set({
      view: "proxy",
      omniboxValue: target,
      loading: true,
      navNonce: get().navNonce + 1,
      tabs: newTabs,
      activeTabId: activeId,
    });
    saveTabs(newTabs);

    // Boot scramjet with aggressive retry. On networks with filters (e.g.
    // Netsweeper), the first transport attempt may fail. We retry up to 3
    // times with force-reconnect, trying different relays each time.
    const sj = getScramjet();
    const tryInit = async () => {
      let lastErr: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (attempt > 0) {
            sj.forceReconnect();
            await new Promise((r) => setTimeout(r, 1000));
          }
          await sj.init(settings.wispUrl);
          return;
        } catch (err) {
          lastErr = err;
          console.error(`[hypers0nic] scramjet init attempt ${attempt + 1} failed:`, err);
        }
      }
      throw lastErr;
    };
    try {
      await tryInit();
    } catch (err) {
      console.error("[hypers0nic] scramjet init failed after 3 attempts:", err);
      set({ loading: false });
      return;
    }
    // Ensure the SW is registered and controlling BEFORE setting proxyReady.
    // This is the critical fix for the 40% failure rate: previously, the SW
    // flag was set to true before registration completed, so /service/
    // requests would 404. Now we await and verify.
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

  closeTab: (id) => {
    const { tabs, activeTabId, recentlyClosedTabs } = get();
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    const newTabs = tabs.filter((t) => t.id !== id);
    const newClosed = [{ id: tab.id, url: tab.url, title: tab.title }, ...recentlyClosedTabs].slice(0, 20);
    // Switch to the adjacent tab, or go home if no tabs left.
    const closedIndex = tabs.findIndex((t) => t.id === id);
    let newActiveId = activeTabId;
    let newView = get().view;
    if (activeTabId === id) {
      if (newTabs.length > 0) {
        newActiveId = newTabs[Math.min(closedIndex, newTabs.length - 1)].id;
        const newActive = newTabs.find((t) => t.id === newActiveId);
        if (newActive) {
          set({ omniboxValue: newActive.url });
        }
      } else {
        newActiveId = null;
        newView = "home";
        set({ omniboxValue: "" });
      }
    }
    const newLoadingTabs = { ...get().loadingTabs };
    delete newLoadingTabs[id];
    set({ tabs: newTabs, activeTabId: newActiveId, recentlyClosedTabs: newClosed, loadingTabs: newLoadingTabs, view: newView });
    saveTabs(newTabs);
  },

  switchTab: (id) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    set({ activeTabId: id, omniboxValue: tab.url, view: "proxy" });
    saveTabs(tabs);
  },

  reorderTabs: (fromIndex, toIndex) => {
    const { tabs } = get();
    if (fromIndex < 0 || fromIndex >= tabs.length || toIndex < 0 || toIndex >= tabs.length) return;
    const newTabs = [...tabs];
    const [moved] = newTabs.splice(fromIndex, 1);
    newTabs.splice(toIndex, 0, moved);
    set({ tabs: newTabs });
    saveTabs(newTabs);
  },

  setTabTitle: (id, title) => {
    const { tabs } = get();
    const newTabs = tabs.map((t) => (t.id === id ? { ...t, title } : t));
    set({ tabs: newTabs });
    saveTabs(newTabs);
  },

  updateTabUrl: (id, url) => {
    const { tabs } = get();
    const newTabs = tabs.map((t) => (t.id === id ? { ...t, url } : t));
    set({ tabs: newTabs, omniboxValue: url });
    saveTabs(newTabs);
  },

  setTabLoading: (id, loading) => {
    const newLoadingTabs = { ...get().loadingTabs };
    if (loading) {
      newLoadingTabs[id] = true;
    } else {
      delete newLoadingTabs[id];
    }
    set({ loadingTabs: newLoadingTabs });
  },

  reopenClosedTab: () => {
    const { recentlyClosedTabs, tabs } = get();
    if (recentlyClosedTabs.length === 0) return;
    const [closed, ...rest] = recentlyClosedTabs;
    const newTab: ProxyTab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      url: closed.url,
      title: closed.title || closed.url,
      navNonce: 1,
    };
    const newTabs = tabs.length >= 8 ? [...tabs.slice(1), newTab] : [...tabs, newTab];
    set({
      tabs: newTabs,
      activeTabId: newTab.id,
      recentlyClosedTabs: rest,
      view: "proxy",
      omniboxValue: closed.url,
    });
    saveTabs(newTabs);
    // Trigger navigation
    setTimeout(() => get().navigate(closed.url), 100);
  },
}));
