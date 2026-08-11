import type { Theme, ThemeId } from "./types";

// All themes use a pure-black background with white monospace text and white
// borders. The only variation is the accent colour — purple by default, with
// a few alternatives for users who want a different highlight.
export const THEMES: Theme[] = [
  {
    id: "hypers0nic",
    name: "Hypers0nic",
    isDark: true,
    vars: {
      "--background": "#000000",
      "--foreground": "#ffffff",
      "--card": "#0a0a0a",
      "--card-foreground": "#ffffff",
      "--popover": "#0a0a0a",
      "--popover-foreground": "#ffffff",
      "--primary": "#a855f7",
      "--primary-foreground": "#ffffff",
      "--secondary": "#141414",
      "--secondary-foreground": "#ffffff",
      "--muted": "#141414",
      "--muted-foreground": "#888888",
      "--accent": "#1a1a1a",
      "--accent-foreground": "#ffffff",
      "--destructive": "#ef4444",
      "--border": "#ffffff",
      "--input": "#ffffff",
      "--ring": "#a855f7",
    },
  },
  {
    id: "midnight",
    name: "Terminal",
    isDark: true,
    vars: {
      "--background": "#000000",
      "--foreground": "#00ff00",
      "--card": "#0a0a0a",
      "--card-foreground": "#00ff00",
      "--popover": "#0a0a0a",
      "--popover-foreground": "#00ff00",
      "--primary": "#00ff00",
      "--primary-foreground": "#000000",
      "--secondary": "#0a1a0a",
      "--secondary-foreground": "#00ff00",
      "--muted": "#0a1a0a",
      "--muted-foreground": "#008800",
      "--accent": "#0a1a0a",
      "--accent-foreground": "#00ff00",
      "--destructive": "#ff0000",
      "--border": "#00ff00",
      "--input": "#00ff00",
      "--ring": "#00ff00",
    },
  },
  {
    id: "rose",
    name: "Crimson",
    isDark: true,
    vars: {
      "--background": "#000000",
      "--foreground": "#ff6b6b",
      "--card": "#0a0a0a",
      "--card-foreground": "#ff6b6b",
      "--popover": "#0a0a0a",
      "--popover-foreground": "#ff6b6b",
      "--primary": "#ff6b6b",
      "--primary-foreground": "#000000",
      "--secondary": "#1a0a0a",
      "--secondary-foreground": "#ff6b6b",
      "--muted": "#1a0a0a",
      "--muted-foreground": "#884444",
      "--accent": "#1a0a0a",
      "--accent-foreground": "#ff6b6b",
      "--destructive": "#ff0000",
      "--border": "#ff6b6b",
      "--input": "#ff6b6b",
      "--ring": "#ff6b6b",
    },
  },
  {
    id: "forest",
    name: "Matrix",
    isDark: true,
    vars: {
      "--background": "#000000",
      "--foreground": "#22c55e",
      "--card": "#0a0a0a",
      "--card-foreground": "#22c55e",
      "--popover": "#0a0a0a",
      "--popover-foreground": "#22c55e",
      "--primary": "#22c55e",
      "--primary-foreground": "#000000",
      "--secondary": "#0a1a0a",
      "--secondary-foreground": "#22c55e",
      "--muted": "#0a1a0a",
      "--muted-foreground": "#447744",
      "--accent": "#0a1a0a",
      "--accent-foreground": "#22c55e",
      "--destructive": "#ef4444",
      "--border": "#22c55e",
      "--input": "#22c55e",
      "--ring": "#22c55e",
    },
  },
  {
    id: "tinfoil",
    name: "Tinf0il",
    isDark: true,
    vars: {
      "--background": "#000000",
      "--foreground": "#ffffff",
      "--card": "#0a0a0a",
      "--card-foreground": "#ffffff",
      "--popover": "#0a0a0a",
      "--popover-foreground": "#ffffff",
      "--primary": "#3b82f6",
      "--primary-foreground": "#ffffff",
      "--secondary": "#141414",
      "--secondary-foreground": "#ffffff",
      "--muted": "#141414",
      "--muted-foreground": "#888888",
      "--accent": "#1a1a1a",
      "--accent-foreground": "#ffffff",
      "--destructive": "#ef4444",
      "--border": "#ffffff",
      "--input": "#ffffff",
      "--ring": "#3b82f6",
    },
  },
  {
    id: "light",
    name: "Inverted",
    isDark: false,
    vars: {
      "--background": "#ffffff",
      "--foreground": "#000000",
      "--card": "#f5f5f5",
      "--card-foreground": "#000000",
      "--popover": "#f5f5f5",
      "--popover-foreground": "#000000",
      "--primary": "#a855f7",
      "--primary-foreground": "#ffffff",
      "--secondary": "#e5e5e5",
      "--secondary-foreground": "#000000",
      "--muted": "#e5e5e5",
      "--muted-foreground": "#666666",
      "--accent": "#e5e5e5",
      "--accent-foreground": "#000000",
      "--destructive": "#ef4444",
      "--border": "#000000",
      "--input": "#000000",
      "--ring": "#a855f7",
    },
  },
];

export function getTheme(id: ThemeId): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyTheme(id: ThemeId) {
  const theme = getTheme(id);
  const root = document.documentElement;
  THEMES.forEach((t) => {
    Object.keys(t.vars).forEach((key) => root.style.removeProperty(key));
  });
  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  root.classList.toggle("dark", theme.isDark);
  root.dataset.theme = id;
}
