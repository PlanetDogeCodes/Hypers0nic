"use client";

import { useHypers0nic } from "@/store/hypers0nic";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, History, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function PreferencesPanel() {
  const preferences = useHypers0nic((s) => s.settings.preferences);
  const setPreferences = useHypers0nic((s) => s.setPreferences);
  const history = useHypers0nic((s) => s.history);
  const clearHistory = useHypers0nic((s) => s.clearHistory);

  const rows: {
    key: keyof typeof preferences;
    label: string;
    description: string;
  }[] = [
    {
      key: "adBlockerEnabled",
      label: "Ad & tracker blocker",
      description: "Block ads and tracking scripts on proxied pages. Uses a conservative filter list that won't break sites.",
    },
    {
      key: "autoProxyLinks",
      label: "Auto-proxy search result links",
      description: "Rewrite links on proxied pages so they open through the proxy instead of the real site.",
    },
    {
      key: "openInAboutBlank",
      label: "Open searches in about:blank tabs",
      description: "Every search/URL opens in a new about:blank tab for discretion.",
    },
    {
      key: "openLinksInNewTab",
      label: "Open proxied links in new tabs",
      description: "Spawn a new tab instead of navigating inside the frame.",
    },
    {
      key: "topBarAlwaysVisible",
      label: "Always show top bar",
      description: "Keep the top bar visible. When off, hover near the top to reveal it.",
    },
    {
      key: "hideFromHistory",
      label: "Incognito mode",
      description: "Don't record visited URLs in local history.",
    },
    {
      key: "proxyImages",
      label: "Proxy image traffic",
      description: "Route images through Scramjet too (better privacy, slower).",
    },
    {
      key: "autoClearHistoryOnClose",
      label: "Auto-clear history on tab close",
      description: "Automatically delete browsing history when you close the tab. Off by default.",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Browsing preferences</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Fine-tune how Hypers0nic handles navigation and history.
        </p>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-foreground">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.description}</p>
            </div>
            <Switch
              checked={preferences[r.key] as boolean}
              onCheckedChange={(v) => setPreferences({ [r.key]: v })}
              aria-label={r.label}
            />
          </div>
        ))}
      </div>

      <div className="h-px bg-border/20" />

      {/* Panic key configuration */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <AlertTriangle className="size-3.5 text-primary" />
              Panic key
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Double-press the configured key to instantly close Hypers0nic and
              open a safe website.
            </p>
          </div>
          <Switch
            checked={preferences.panicKeyEnabled}
            onCheckedChange={(v) => setPreferences({ panicKeyEnabled: v })}
            aria-label="Enable panic key"
          />
        </div>
        {preferences.panicKeyEnabled && (
          <div className="space-y-3 rounded border border-border/20 bg-card/20 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="panic-key" className="text-xs">Panic key</Label>
              <Input
                id="panic-key"
                value={preferences.panicKey}
                onChange={(e) => {
                  const val = e.target.value;
                  // Take only the last character typed.
                  setPreferences({ panicKey: val.slice(-1) || "`" });
                }}
                className="text-sm"
                placeholder="`"
                maxLength={1}
              />
              <p className="text-[10px] text-muted-foreground">
                Default: backtick (`). Double-press this key to trigger panic.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="panic-url" className="text-xs">Panic URL</Label>
              <Input
                id="panic-url"
                value={preferences.panicUrl}
                onChange={(e) => setPreferences({ panicUrl: e.target.value })}
                className="text-sm"
                placeholder="https://classroom.google.com"
                spellCheck={false}
              />
              <p className="text-[10px] text-muted-foreground">
                The website to open when the panic key is triggered.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="h-px bg-border/20" />

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <div>
            <p className="text-sm text-foreground">Local history</p>
            <p className="text-xs text-muted-foreground">
              {history.length} {history.length === 1 ? "entry" : "entries"} stored
              on this device.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            clearHistory();
            toast.success("History cleared.");
          }}
          disabled={history.length === 0}
        >
          <Trash2 className="size-4" />
          Clear
        </Button>
      </div>
    </div>
  );
}
