"use client";

import { Search, Home, History, Settings, ArrowLeft, ArrowRight, RotateCw, CornerDownLeft, Command, Zap, EyeOff } from "lucide-react";

interface ShortcutDef {
  keys: string[];
  label: string;
  icon: React.ElementType;
}

const SHORTCUT_GROUPS: { title: string; shortcuts: ShortcutDef[] }[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["Ctrl+K"], label: "Open command palette (search everything)", icon: Command },
      { keys: ["/"], label: "Focus the search bar", icon: Search },
      { keys: ["Esc"], label: "Go home / blur active field", icon: Home },
      { keys: ["Ctrl+,"], label: "Open settings", icon: Settings },
      { keys: ["Ctrl+H"], label: "Toggle history panel", icon: History },
      { keys: ["Ctrl+`"], label: "Toggle stealth mode (instant tab cloak)", icon: EyeOff },
    ],
  },
  {
    title: "Proxy browsing",
    shortcuts: [
      { keys: ["Alt", "←"], label: "Go back", icon: ArrowLeft },
      { keys: ["Alt", "→"], label: "Go forward", icon: ArrowRight },
      { keys: ["Enter"], label: "Navigate to URL / search", icon: CornerDownLeft },
      { keys: ["Ctrl+R", "F5"], label: "Reload proxied page", icon: RotateCw },
    ],
  },
];

function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.75rem] items-center justify-center rounded border border-border/40 bg-card/60 px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground">
      {children}
    </kbd>
  );
}

export function ShortcutsPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Keyboard shortcuts</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Speed up your workflow with these keyboard shortcuts.
        </p>
      </div>

      {SHORTCUT_GROUPS.map((group) => (
        <div key={group.title}>
          <div className="mb-2.5 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </span>
            <div className="h-px flex-1 bg-border/20" />
          </div>
          <div className="space-y-1">
            {group.shortcuts.map((sc) => {
              const Icon = sc.icon;
              return (
                <div
                  key={sc.label}
                  className="flex items-center gap-3 rounded border border-border/15 bg-card/20 px-2 py-2 transition-colors hover:bg-card/40"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-sm text-foreground">{sc.label}</span>
                  <div className="flex items-center gap-1">
                    {sc.keys.map((key, i) =>
                      key === "or" ? (
                        <span
                          key={i}
                          className="text-[11px] text-muted-foreground"
                        >
                          or
                        </span>
                      ) : (
                        <KeyCap key={i}>{key}</KeyCap>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="rounded border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-2.5">
          <Zap className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Pro tip</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Press <KeyCap>Ctrl+K</KeyCap> anywhere to open the command palette —
              fuzzy-search your history, switch search engines, jump to settings,
              or navigate to a URL, all without touching the mouse.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
