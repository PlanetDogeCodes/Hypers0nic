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

  // --- proxy tabs (multi-tab session) ---
  // tabs: the array of open proxy tabs. The first tab is the leftmost.
  // activeTabId: the currently-visible tab; null when on home or no tabs.
  // recentlyClosed: a small LIFO stack of closed tabs, useful for
  //   "reopen closed tab" / Ctrl+Shift+T. Capped at 8 entries.
  // loadingTabs: a map of tabId -> boolean. Each ProxyFrame updates its own
  //   entry when its iframe starts/finishes loading. The ProxyTabBar reads
  //   this to show a spinner on tabs whose content is still loading.
  tabs: ProxyTab[];
  activeTabId: string | null;
  recentlyClosed: ProxyTab[];
  loadingTabs: Record<string, boolean>;

  // --- focus sessions ---
  focusSessions: FocusSessionRecord[];
  todaySessionCount: number;
  todayFocusMinutes: number;
  focusStreak: number;

  // --- scramjet ---
  scramjet: ScramjetStateSnapshot;

  // --- transport health (Task 4) ---
  // transportQuality: coarse-grained health of the wisp relay transport,
  //   measured by the useTransportHealth hook. "good" = latency < 500ms,
  //   "poor" = 500-2000ms, "dead" = no response or > 2000ms.
  // transportLatency: the most recent measured round-trip latency in ms
  //   through the proxy (timing a small fetch through /service/). null when
  //   not yet measured or the probe failed.
  // These are written by useTransportHealth and read by ProxyHUD. Kept in
  // the store (rather than hook state) so any component can subscribe
  // without prop-drilling.
  transportQuality: "good" | "poor" | "dead";
  transportLatency: number | null;
  setTransportQuality: (q: "good" | "poor" | "dead") => void;
  setTransportLatency: (l: number | null) => void;

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
  // updateBookmarkTitle: edits a bookmark's display title in place (Task 5).
  // Used by the home-view's right-click "Edit title" context menu action.
  // No-op if the URL isn't bookmarked.
  updateBookmarkTitle: (url: string, title: string) => void;
  // reorderBookmarks: moves a bookmark from fromIndex to toIndex within the
  // bookmarks array (Task 5). Used by home-view's drag-to-reorder. The
  // visible bookmarks strip shows the first 6, so callers should pass
  // indices into the underlying array (not the visible slice).
  reorderBookmarks: (fromIndex: number, toIndex: number) => void;
  toggleStealth: () => void;
  recordFocusSession: (durationMinutes: number) => void;
  addCustomShortcut: (shortcut: Omit<CustomShortcut, "id" | "addedAt">) => void;
  removeCustomShortcut: (id: string) => void;

  // --- tab actions ---
  // openTab: ALWAYS creates a new tab (unlike navigate() which updates the
  // active tab when in proxy view). Rejects silently if 8 tabs are already
  // open.
  openTab: (input: string) => Promise<void>;
  // closeTab: closes a tab, records it in recentlyClosed, switches to an
  // adjacent tab or goes home if no tabs remain.
  closeTab: (id: string) => void;
  // switchTab: makes the given tab active and updates omniboxValue to its URL.
  switchTab: (id: string) => void;
  // reorderTabs: moves a tab from fromIndex to toIndex (drag-to-reorder).
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  // setTabTitle: updates a tab's title (called by ProxyFrame on page load).
  setTabTitle: (id: string, title: string) => void;
  // updateTabUrl: updates a tab's URL silently — no navNonce bump, since this
  // is called from the iframe's urlchange event (the iframe already moved).
  updateTabUrl: (id: string, url: string) => void;
  // reopenClosedTab: restores the most recently closed tab.
  reopenClosedTab: () => Promise<void>;
  // setTabLoading: updates a tab's loading flag. Called by ProxyFrame when
  // its iframe starts/finishes loading a page. The ProxyTabBar reads this
  // to show a spinner on tabs whose content is still loading.
  setTabLoading: (id: string, loading: boolean) => void;
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

// Boot the Scramjet controller + service worker. Returns true if both are
// ready and the caller can set proxyReady. Used by navigate() and openTab()
// so the boot sequence isn't duplicated.
//
// Order matters: scramjet FIRST (creates IndexedDB schema), THEN SW (so the
// SW sees the schema when it boots — this was the cold-start fix in Task 1).
// On init failure, we force-reconnect and retry once (handles dropped
// transports).
async function bootProxy(wispUrl: string): Promise<boolean> {
  const sj = getScramjet();
  const tryInit = async () => {
    try {
      await sj.init(wispUrl);
    } catch (err) {
      console.error("[hypers0nic] scramjet init failed, retrying:", err);
      sj.forceReconnect();
      await sj.init(wispUrl);
    }
  };
  try {
    await tryInit();
  } catch (err) {
    console.error("[hypers0nic] scramjet init failed on retry:", err);
    return false;
  }
  // Ensure the SW is registered and controlling BEFORE returning ok.
  // This is the critical fix for the 40% failure rate: previously, the SW
  // flag was set to true before registration completed, so /service/
  // requests would 404. Now we await and verify.
  const swOk = await ensureServiceWorker();
  if (!swOk) {
    console.error("[hypers0nic] service worker not controlling after registration");
    return false;
  }
  return true;
}

// Generate a unique tab id. Uses timestamp + random suffix to avoid
// collisions across rapid tab creation.
function makeTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
  tabs: [],
  activeTabId: null,
  recentlyClosed: [],
  loadingTabs: {},
  focusSessions: [],
  todaySessionCount: 0,
  todayFocusMinutes: 0,
  focusStreak: 0,
  scramjet: { status: "idle" },
  // Transport health defaults: "dead" until the first successful probe.
  // latency null until measured. These are updated by useTransportHealth.
  transportQuality: "dead",
  transportLatency: null,

  hydrate: () => {
    if (get().hydrated) return;
    const settings = loadSettings();
    const history = loadHistory();
    const bookmarks = loadBookmarks();
    const focusSessions = loadFocusSessions();
    const customShortcuts = loadCustomShortcuts();

    // --- Hash-based deep linking for about:blank popups ---
    // When the openInAboutBlank feature opens a popup, it loads the app with
    // a #go=<url> hash. On hydrate, we detect this hash, decode the target
    // URL, set the inAboutBlankPopup flag (so navigations happen in-place
    // instead of spawning more popups), and auto-navigate to the target.
    //
    // IMPORTANT: if a #go= hash is present, this is a fresh popup session —
    // we deliberately do NOT restore saved tabs (the popup is its own
    // independent browsing context, not a continuation of the parent's
    // session).
    let hashGoUrl: string | null = null;
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash;
      if (hash.startsWith("#go=")) {
        const targetUrl = decodeURIComponent(hash.substring(4));
        if (targetUrl) {
          hashGoUrl = targetUrl;
          inAboutBlankPopup = true;
          // Clear the hash so it doesn't interfere with future navigations
          // or get picked up on refresh.
          try {
            window.history.replaceState(null, "", window.location.pathname);
          } catch {}
        }
      }
    }

    // Load saved tabs for session restore — but ONLY if this isn't an
    // about:blank popup load (popups have their own session).
    const savedTabs = hashGoUrl ? [] : loadTabs();

    const initialPatch: Partial<Hypers0nicStore> = {
      settings,
      history,
      bookmarks,
      customShortcuts,
      focusSessions,
      todaySessionCount: countTodaySessions(focusSessions),
      todayFocusMinutes: minutesToday(focusSessions),
      focusStreak: computeStreak(focusSessions),
      hydrated: true,
    };

    if (savedTabs.length > 0) {
      // Session restore: jump straight to the proxy view with the first
      // saved tab as active. ProxyFrame's nav effect will fire when
      // `ready` flips to true (after SW + scramjet boot), and it will
      // call frame.go(omniboxRef.current) — which is initialized from
      // omniboxValue (the active tab's URL).
      initialPatch.tabs = savedTabs;
      initialPatch.activeTabId = savedTabs[0].id;
      initialPatch.view = "proxy";
      initialPatch.omniboxValue = savedTabs[0].url;
      initialPatch.loading = true;
    } else {
      initialPatch.tabs = [];
      initialPatch.activeTabId = null;
    }

    set(initialPatch);

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
    //
    // When saved tabs are being restored, we MUST set proxyReady=true after
    // init completes so the ProxyFrames' nav effects fire and the iframes
    // actually load. Without this, restored tabs would show "Preparing the
    // proxy…" forever (the nav effect's `ready` check requires proxyReady).
    ensureServiceWorker().then(() => {
      getScramjet()
        .init(settings.wispUrl)
        .then(() => {
          if (savedTabs.length > 0 && !hashGoUrl) {
            set({ proxyReady: true, loading: false });
          }
        })
        .catch(() => {});
    });

    // If this is an about:blank popup load (#go= hash), auto-navigate to
    // the target URL after a short delay (lets the UI mount first so the
    // ProxyFrame is ready to drive the iframe).
    if (hashGoUrl) {
      const targetUrl = hashGoUrl;
      setTimeout(() => {
        get().navigate(targetUrl);
      }, 800);
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

    // --- Tab management ---
    //
    // From the home view (or when there's no active tab to update), navigate()
    // creates a NEW tab and switches to the proxy view. From the proxy view
    // with an existing active tab, it updates that tab's URL in place (same
    // tab, new destination) — this matches the omnibox's "enter a new URL"
    // behaviour in a normal browser tab.
    //
    // The global navNonce is bumped in both cases so ProxyFrame's nav effect
    // fires frame.go(target). The active tab's per-tab navNonce is also
    // bumped so future UI (e.g. a per-tab loading indicator) can tell when
    // a tab's content has been refreshed.
    const { view, tabs, activeTabId } = get();
    const activeTab = activeTabId ? tabs.find((t) => t.id === activeTabId) : null;
    const shouldCreateTab = view === "home" || !activeTab;

    let newTabs: ProxyTab[];
    let newActiveTabId: string;
    if (shouldCreateTab) {
      // Honor the 8-tab cap even from navigate() — if we're somehow at the
      // limit, replace the oldest tab instead of exceeding the cap. This
      // shouldn't normally happen (openTab enforces the cap), but defends
      // against session-restore edge cases.
      const newTab: ProxyTab = {
        id: makeTabId(),
        url: target,
        title: target,
        navNonce: 1,
      };
      newTabs = [...tabs, newTab];
      while (newTabs.length > 8) newTabs.shift();
      newActiveTabId = newTab.id;
    } else {
      // Update the active tab's URL + bump its navNonce. Other tabs are
      // left untouched.
      newTabs = tabs.map((t) =>
        t.id === activeTab!.id
          ? { ...t, url: target, navNonce: t.navNonce + 1 }
          : t
      );
      newActiveTabId = activeTab!.id;
    }

    set({
      view: "proxy",
      omniboxValue: target,
      loading: true,
      tabs: newTabs,
      activeTabId: newActiveTabId,
      navNonce: get().navNonce + 1,
    });
    saveTabs(newTabs);

    // Boot scramjet + service worker (cold-start fix order: scramjet FIRST
    // so its IndexedDB schema exists before the SW opens it, then SW).
    // On failure, force-reconnect and retry once. Memoised inside the
    // ScramjetManager so subsequent navigations are instant.
    const ok = await bootProxy(settings.wispUrl);
    if (!ok) {
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
    // the active tab's ProxyFrame. We emit a window event that ProxyFrame
    // listens for. The event includes the active tab's id so only the active
    // ProxyFrame acts on it (other tabs' ProxyFrames ignore it).
    window.dispatchEvent(
      new CustomEvent("hypers0nic:navigate", {
        detail: { action: "back", tabId: get().activeTabId },
      })
    );
  },

  goForward: () => {
    window.dispatchEvent(
      new CustomEvent("hypers0nic:navigate", {
        detail: { action: "forward", tabId: get().activeTabId },
      })
    );
  },

  reload: () => {
    window.dispatchEvent(
      new CustomEvent("hypers0nic:navigate", {
        detail: { action: "reload", tabId: get().activeTabId },
      })
    );
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

  // updateBookmarkTitle (Task 5): finds the bookmark by URL and replaces its
  // title. If the URL isn't bookmarked or the title is empty, no-op. We
  // deliberately do NOT trim/normalize the title here — the caller is
  // responsible for that (the context menu uses window.prompt which already
  // returns a trimmed value when the user clicks OK on whitespace-only
  // input).
  updateBookmarkTitle: (url, title) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const { bookmarks } = get();
    const idx = bookmarks.findIndex((b) => b.url === url);
    if (idx === -1) return;
    // Skip the state update if the title hasn't changed — avoids an
    // unnecessary re-render of the home-view's bookmark strip.
    if (bookmarks[idx].title === trimmed) return;
    const next = bookmarks.map((b) =>
      b.url === url ? { ...b, title: trimmed } : b
    );
    set({ bookmarks: next });
    saveBookmarks(next);
  },

  // reorderBookmarks (Task 5): moves a bookmark from fromIndex to toIndex
  // within the bookmarks array. Mirrors reorderTabs' implementation: splice
  // out the moved item, then splice it back in at the target index. No-op
  // on out-of-bounds indices or when from === to.
  reorderBookmarks: (fromIndex, toIndex) => {
    const { bookmarks } = get();
    if (
      fromIndex < 0 ||
      fromIndex >= bookmarks.length ||
      toIndex < 0 ||
      toIndex >= bookmarks.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    const next = [...bookmarks];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
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

  // ============================================================
  // Tab actions
  // ============================================================

  openTab: async (input) => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const { settings, tabs } = get();
    // Enforce the 8-tab cap. Silently reject if at the limit — the tab bar
    // UI is responsible for surfacing the limit to the user (e.g. a toast).
    if (tabs.length >= 8) return;

    const engine = getSearchEngine(settings.searchEngine);
    const target = normalizeInput(trimmed, engine);

    // openTab ALWAYS creates a new in-app tab. It deliberately bypasses the
    // about:blank popup path (that's navigate()'s job) — openTab is the
    // "new tab" button in the tab bar.
    const newTab: ProxyTab = {
      id: makeTabId(),
      url: target,
      title: target,
      navNonce: 1,
    };
    const newTabs = [...tabs, newTab];
    set({
      view: "proxy",
      omniboxValue: target,
      loading: true,
      tabs: newTabs,
      activeTabId: newTab.id,
      navNonce: get().navNonce + 1,
    });
    saveTabs(newTabs);

    const ok = await bootProxy(settings.wispUrl);
    if (!ok) {
      set({ loading: false });
      return;
    }
    set({ proxyReady: true, loading: false });
  },

  closeTab: (id) => {
    const { tabs, activeTabId, recentlyClosed } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const closed = tabs[idx];

    const newTabs = tabs.filter((t) => t.id !== id);
    // Record the closed tab at the head of recentlyClosed (LIFO). Filter
    // out any stale entry with the same id first to avoid dupes. Capped
    // at 8 entries so localStorage doesn't grow unbounded.
    const newRecentlyClosed = [
      closed,
      ...recentlyClosed.filter((t) => t.id !== id),
    ].slice(0, 8);

    if (newTabs.length === 0) {
      // Closed the last tab — go home and clear the active tab.
      set({
        tabs: [],
        activeTabId: null,
        recentlyClosed: newRecentlyClosed,
        view: "home",
        omniboxValue: "",
        loading: false,
        loadingTabs: {},
      });
      saveTabs([]);
      return;
    }

    if (activeTabId === id) {
      // Closed the active tab — switch to an adjacent one. Prefer the tab
      // now sitting at the closed tab's index (the one that shifted in
      // from the right); if the closed tab was the rightmost, fall back
      // to the tab immediately to its left.
      const newIdx = Math.min(idx, newTabs.length - 1);
      const newActive = newTabs[newIdx];
      // Clean up the closed tab's loading flag so the tab bar doesn't
      // show a stale spinner for a tab that no longer exists.
      const nextLoadingTabs = { ...get().loadingTabs };
      delete nextLoadingTabs[id];
      set({
        tabs: newTabs,
        activeTabId: newActive.id,
        recentlyClosed: newRecentlyClosed,
        omniboxValue: newActive.url,
        loadingTabs: nextLoadingTabs,
        // Bump navNonce so ProxyFrame re-navigates the iframe to the
        // newly-active tab's URL.
        navNonce: get().navNonce + 1,
      });
    } else {
      // Closed a background tab — active tab unchanged, no re-navigation.
      const nextLoadingTabs = { ...get().loadingTabs };
      delete nextLoadingTabs[id];
      set({
        tabs: newTabs,
        recentlyClosed: newRecentlyClosed,
        loadingTabs: nextLoadingTabs,
      });
    }
    saveTabs(newTabs);
  },

  switchTab: (id) => {
    const { tabs, activeTabId } = get();
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    // No-op if the tab is already active.
    if (activeTabId === id) return;

    set({
      activeTabId: id,
      // Ensure we're in the proxy view — the user may have clicked a tab
      // from the home view's tab bar (if one exists there).
      view: "proxy",
      omniboxValue: tab.url,
      // Bump navNonce so ProxyFrame re-navigates the iframe to the
      // switched tab's URL. The per-tab navNonce is intentionally NOT
      // bumped — switching tabs doesn't navigate the tab itself, it just
      // brings it into the foreground.
      navNonce: get().navNonce + 1,
    });
    // tabs array hasn't changed, but save anyway to persist activeTabId
    // ordering / any pending mutations. (saveTabs only persists the tabs
    // array, not activeTabId — that's by design: on restore, the first
    // tab becomes active.)
    saveTabs(tabs);
  },

  reorderTabs: (fromIndex, toIndex) => {
    const { tabs } = get();
    if (
      fromIndex < 0 ||
      fromIndex >= tabs.length ||
      toIndex < 0 ||
      toIndex >= tabs.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    const newTabs = [...tabs];
    const [moved] = newTabs.splice(fromIndex, 1);
    newTabs.splice(toIndex, 0, moved);
    set({ tabs: newTabs });
    saveTabs(newTabs);
  },

  setTabTitle: (id, title) => {
    const { tabs } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    // Skip the state update if the title hasn't changed — avoids
    // unnecessary re-renders of the tab bar on every urlchange event.
    if (tabs[idx].title === title) return;
    const newTabs = tabs.map((t) => (t.id === id ? { ...t, title } : t));
    set({ tabs: newTabs });
    saveTabs(newTabs);
  },

  updateTabUrl: (id, url) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    if (tabs[idx].url === url) return;
    const newTabs = tabs.map((t) => (t.id === id ? { ...t, url } : t));
    const patch: Partial<Hypers0nicStore> = { tabs: newTabs };
    // If this is the active tab, also update omniboxValue so the omnibox
    // reflects the iframe's current URL. We do NOT bump navNonce — the
    // iframe already navigated itself (this is called from the
    // urlchange event handler in ProxyFrame).
    if (activeTabId === id) {
      patch.omniboxValue = url;
    }
    set(patch);
    saveTabs(newTabs);
  },

  reopenClosedTab: async () => {
    const { recentlyClosed, tabs } = get();
    if (recentlyClosed.length === 0) return;
    // Honor the 8-tab cap.
    if (tabs.length >= 8) return;
    const [restored, ...rest] = recentlyClosed;
    // Give the restored tab a fresh id (so it doesn't collide if the user
    // closes it again) and bump its navNonce so ProxyFrame navigates to it.
    const newTab: ProxyTab = {
      ...restored,
      id: makeTabId(),
      navNonce: restored.navNonce + 1,
    };
    const newTabs = [...tabs, newTab];
    set({
      tabs: newTabs,
      activeTabId: newTab.id,
      recentlyClosed: rest,
      view: "proxy",
      omniboxValue: newTab.url,
      loading: true,
      navNonce: get().navNonce + 1,
    });
    saveTabs(newTabs);

    const ok = await bootProxy(get().settings.wispUrl);
    if (!ok) {
      set({ loading: false });
      return;
    }
    set({ proxyReady: true, loading: false });
  },

  setTabLoading: (id, loading) => {
    const current = get().loadingTabs[id];
    // Skip the state update if the flag hasn't changed — avoids unnecessary
    // re-renders of the ProxyTabBar on every load event.
    if (current === loading) return;
    const nextLoadingTabs = { ...get().loadingTabs };
    if (loading) {
      nextLoadingTabs[id] = true;
    } else {
      delete nextLoadingTabs[id];
    }
    set({ loadingTabs: nextLoadingTabs });
  },

  // --- transport health setters (Task 4) ---
  // Simple setters used by useTransportHealth. They write a single field
  // each — React 18's auto-batching coalesces back-to-back synchronous
  // calls into one re-render, so callers that update both at once (the
  // common case) won't trigger two renders.
  setTransportQuality: (q) => {
    if (get().transportQuality === q) return;
    set({ transportQuality: q });
  },
  setTransportLatency: (l) => {
    if (get().transportLatency === l) return;
    set({ transportLatency: l });
  },
}));
