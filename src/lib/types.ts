// Shared domain types for Hypers0nic.

export type View = "home" | "proxy";

export interface SearchEngine {
  id: string;
  name: string;
  /** Pattern with %s where the query goes. */
  url: string;
  /** Suggestion endpoint (optional). %s is replaced with the query. */
  suggest?: string;
  accent: string;
}

export interface TabCloakConfig {
  enabled: boolean;
  preset: TabCloakPresetId;
  customTitle?: string;
  customIcon?: string;
}

export type TabCloakPresetId =
  | "default"
  | "google"
  | "classroom"
  | "drive"
  | "docs"
  | "gmail"
  | "canvas"
  | "powerschool"
  | "custom";

export interface TabCloakPreset {
  id: TabCloakPresetId;
  name: string;
  title: string;
  icon: string;
}

export type ThemeId =
  | "hypers0nic"
  | "midnight"
  | "rose"
  | "forest"
  | "tinfoil"
  | "light";

export interface Theme {
  id: ThemeId;
  name: string;
  /** CSS variables applied to :root. */
  vars: Record<string, string>;
  isDark: boolean;
}

export interface Preferences {
  openLinksInNewTab: boolean;
  openInAboutBlank: boolean;
  preloadServiceWorker: boolean;
  showShortcuts: boolean;
  hideFromHistory: boolean;
  proxyImages: boolean;
  smoothTransitions: boolean;
  compactDensity: boolean;
  topBarAlwaysVisible: boolean;
  panicKeyEnabled: boolean;
  panicKey: string;
  panicUrl: string;
  adBlockerEnabled: boolean;
  autoProxyLinks: boolean;
  useLibcurlTransport: boolean;
}

export interface TinfoilProfile {
  connected: boolean;
  username?: string;
  syncedAt?: number;
  /** Raw payload returned by Tinf0il (kept for re-export / debugging). */
  payload?: TinfoilPayload;
}

export interface TinfoilPayload {
  tabCloak?: Partial<TabCloakConfig>;
  theme?: ThemeId;
  searchEngine?: string;
  preferences?: Partial<Preferences>;
}

export interface Hypers0nicSettings {
  theme: ThemeId;
  tabCloak: TabCloakConfig;
  searchEngine: string;
  preferences: Preferences;
  wispUrl: string;
  tinfoil: TinfoilProfile;
}

export interface HistoryEntry {
  url: string;
  title: string;
  visitedAt: number;
}

export interface Bookmark {
  url: string;
  title: string;
  addedAt: number;
}

export interface ProxyTab {
  id: string;
  url: string;
  title: string;
  navNonce: number;
}

export interface CustomShortcut {
  id: string;
  name: string;
  url: string;
  /** Optional emoji or single-letter label shown in the tile. */
  label?: string;
  /** Optional accent color (any CSS color). */
  color?: string;
  addedAt: number;
}
