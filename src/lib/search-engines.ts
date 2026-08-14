import type { SearchEngine } from "./types";

// Curated set of search engines. The `url` field uses %s as the query
// placeholder so the same template works for both navigation and the omnibox.
export const SEARCH_ENGINES: SearchEngine[] = [
  {
    id: "duckduckgo",
    name: "DuckDuckGo",
    url: "https://duckduckgo.com/?q=%s",
    suggest: "https://duckduckgo.com/ac/?q=%s&type=list",
    accent: "#de5833",
  },
  {
    id: "google",
    name: "Google",
    url: "https://google.com/search?q=%s",
    suggest: "https://suggestqueries.google.com/complete/search?client=firefox&q=%s",
    accent: "#4285f4",
  },
  {
    id: "bing",
    name: "Bing",
    url: "https://www.bing.com/search?q=%s",
    suggest: "https://api.bing.com/osjson.aspx?query=%s",
    accent: "#008373",
  },
  {
    id: "brave",
    name: "Brave",
    url: "https://search.brave.com/search?q=%s",
    suggest: "https://search.brave.com/api/suggest?q=%s",
    accent: "#fb542b",
  },
  {
    id: "startpage",
    name: "Startpage",
    url: "https://www.startpage.com/sp/search?query=%s",
    accent: "#6573ff",
  },
  {
    id: "ecosia",
    name: "Ecosia",
    url: "https://www.ecosia.org/search?q=%s",
    accent: "#1a8b3e",
  },
];

export const DEFAULT_SEARCH_ENGINE = "duckduckgo";

export function getSearchEngine(id: string): SearchEngine {
  return SEARCH_ENGINES.find((e) => e.id === id) ?? SEARCH_ENGINES[0];
}

/**
 * Decide whether a string looks like a URL (with a scheme) or a search query.
 * Bare domains like "wikipedia.org" are treated as URLs so users can skip the
 * "https://" prefix, matching the behaviour of every modern omnibox.
 */
export function isLikelyUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (/\s/.test(trimmed)) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) return true;
  if (/^localhost(:\d+)?(\/.*)?$/.test(trimmed)) return true;
  // "example.com" / "sub.example.co.uk" — must have a dot and a TLD-ish tail.
  return /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(:\d+)?(\/.*)?$/.test(trimmed);
}

/** Normalise loose input into a real URL the proxy can fetch. */
export function normalizeInput(input: string, engine: SearchEngine): string {
  const trimmed = input.trim();
  if (isLikelyUrl(trimmed)) {
    let url: string;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
      url = trimmed;
    } else {
      url = `https://${trimmed}`;
    }
    // Auto-add trailing slash if the URL has no path (e.g., "https://example.com"
    // becomes "https://example.com/"). This prevents 404s on sites that redirect
    // to the slash version, and ensures the proxy URL is consistent.
    try {
      const parsed = new URL(url);
      if (parsed.pathname === "") {
        url = url + "/";
      }
    } catch {
      // Not a valid URL, leave as-is
    }
    return url;
  }
  return engine.url.replace("%s", encodeURIComponent(trimmed));
}
