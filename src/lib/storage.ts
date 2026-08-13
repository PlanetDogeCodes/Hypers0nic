import type { Hypers0nicSettings, HistoryEntry, Bookmark, CustomShortcut, ProxyTab } from "./types";

const SETTINGS_KEY = "hypers0nic:settings:v1";
const HISTORY_KEY = "hypers0nic:history:v1";
const BOOKMARKS_KEY = "hypers0nic:bookmarks:v1";
const FOCUS_SESSIONS_KEY = "hypers0nic:focus-sessions:v1";
const CUSTOM_SHORTCUTS_KEY = "hypers0nic:custom-shortcuts:v1";
const TABS_KEY = "hypers0nic:tabs:v1";

export const DEFAULT_SETTINGS: Hypers0nicSettings = {
  theme: "hypers0nic",
  tabCloak: {
    enabled: true,
    preset: "classroom",
    customTitle: "Home - Classroom",
    customIcon:
      "https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ffreepnglogo.com%2Fimages%2Fall_img%2Fgoogle-classroom-9634.png&f=1&nofb=1&ipt=a1ca0c52fcf6dd60992466a97d2185d79fc090b86e7b5e6ca431fc99c64d07a7",
  },
  searchEngine: "duckduckgo",
  preferences: {
    openLinksInNewTab: false,
    openInAboutBlank: false,
    // The service worker is registered lazily on the first proxy navigation,
    // AFTER the Scramjet controller has created its IndexedDB schema. Registering
    // earlier would let the SW open the DB first (without an upgrade callback)
    // and leave behind an empty database that breaks controller.init().
    preloadServiceWorker: false,
    showShortcuts: true,
    hideFromHistory: false,
    proxyImages: true,
    smoothTransitions: true,
    compactDensity: false,
    topBarAlwaysVisible: true,
    panicKeyEnabled: true,
    panicKey: "Escape",
    panicUrl: "https://classroom.google.com",
    adBlockerEnabled: true,
    autoProxyLinks: true,
  },
  // Default wisp relay. Using wss://anura.pro as the public relay.
  wispUrl: "wss://anura.pro",
  tinfoil: { connected: false },
};

export function loadSettings(): Hypers0nicSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    // Validate the parsed value is a plain object (not null, array, or primitive).
    // Corrupted localStorage can contain anything; this prevents deepMerge
    // from producing a broken settings object.
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      window.localStorage.removeItem(SETTINGS_KEY);
      return DEFAULT_SETTINGS;
    }
    return deepMerge(DEFAULT_SETTINGS, parsed) as Hypers0nicSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Hypers0nicSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* quota / privacy mode — fail quietly */
  }
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter out corrupt entries (missing required fields).
    return parsed.filter(
      (e: any) => e && typeof e.url === "string" && typeof e.visitedAt === "number"
    ) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveHistory(history: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    // Cap history at 200 entries to keep localStorage tidy.
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 200)));
  } catch {
    /* ignore */
  }
}

export function loadBookmarks(): Bookmark[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (b: any) => b && typeof b.url === "string"
    ) as Bookmark[];
  } catch {
    return [];
  }
}

export function saveBookmarks(bookmarks: Bookmark[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  } catch {
    /* ignore */
  }
}

export interface FocusSessionRecord {
  /** ISO date string (YYYY-MM-DD) of the day the session was completed. */
  date: string;
  /** Duration of the completed session in minutes. */
  duration: number;
  /** Completion timestamp. */
  completedAt: number;
}

/** Returns today's date as YYYY-MM-DD in the user's local timezone. */
export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

export function loadFocusSessions(): FocusSessionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FOCUS_SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s: any) => s && typeof s.date === "string" && typeof s.duration === "number"
    ) as FocusSessionRecord[];
  } catch {
    return [];
  }
}

export function saveFocusSessions(sessions: FocusSessionRecord[]) {
  if (typeof window === "undefined") return;
  try {
    // Keep only the last 100 sessions to avoid unbounded growth.
    window.localStorage.setItem(
      FOCUS_SESSIONS_KEY,
      JSON.stringify(sessions.slice(-100))
    );
  } catch {
    /* ignore */
  }
}

/** Count how many focus sessions were completed today. */
export function countTodaySessions(sessions: FocusSessionRecord[]): number {
  const today = todayKey();
  return sessions.filter((s) => s.date === today).length;
}

/** Total focused minutes today. */
export function minutesToday(sessions: FocusSessionRecord[]): number {
  const today = todayKey();
  return sessions
    .filter((s) => s.date === today)
    .reduce((sum, s) => sum + s.duration, 0);
}

/**
 * Compute the current "streak" — the number of consecutive days (ending today
 * or yesterday) with at least one completed focus session.
 *
 * If the user focused today, the streak counts today + consecutive previous
 * days. If they didn't focus today but did yesterday, the streak still holds
 * (so it isn't reset the moment midnight strikes).
 */
export function computeStreak(sessions: FocusSessionRecord[]): number {
  if (sessions.length === 0) return 0;
  const dates = new Set(sessions.map((s) => s.date));

  // Start from today; if today has no session, start from yesterday so the
  // streak survives until a full day is missed.
  const today = new Date();
  let streak = 0;
  let cursor = new Date(today);

  if (!dates.has(dateKey(cursor))) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (!dates.has(dateKey(yesterday))) return 0;
    cursor = yesterday;
  }

  // Walk backwards day by day while sessions exist for that day.
  while (dates.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

export function loadCustomShortcuts(): CustomShortcut[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_SHORTCUTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s: any) => s && typeof s.url === "string" && typeof s.name === "string"
    ) as CustomShortcut[];
  } catch {
    return [];
  }
}

export function saveCustomShortcuts(shortcuts: CustomShortcut[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_SHORTCUTS_KEY, JSON.stringify(shortcuts));
  } catch {
    /* ignore */
  }
}

/**
 * Load persisted proxy tabs for session restore. Filters out entries that
 * are missing required fields (id / url) so corrupt localStorage can't
 * crash the app. Caps at 8 entries to match the in-app tab limit.
 */
export function loadTabs(): ProxyTab[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TABS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (t: any) =>
          t && typeof t.id === "string" && typeof t.url === "string"
      )
      .map((t: any) => ({
        id: t.id,
        url: t.url,
        // Default title to the URL if missing — every tab needs a title
        // for the tab bar to display something.
        title: typeof t.title === "string" ? t.title : t.url,
        navNonce: typeof t.navNonce === "number" ? t.navNonce : 0,
      }))
      .slice(0, 8) as ProxyTab[];
  } catch {
    return [];
  }
}

export function saveTabs(tabs: ProxyTab[]) {
  if (typeof window === "undefined") return;
  try {
    // Cap at 8 to match the in-app tab limit and keep localStorage tidy.
    window.localStorage.setItem(TABS_KEY, JSON.stringify(tabs.slice(0, 8)));
  } catch {
    /* quota / privacy mode — fail quietly */
  }
}

function deepMerge<T>(base: T, override: Partial<T>): T {
  if (override === null || override === undefined) return base;
  if (typeof base !== "object" || base === null) return override as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (out as Record<string, unknown>)[key] === "object"
    ) {
      out[key] = deepMerge((out as Record<string, unknown>)[key], value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}
