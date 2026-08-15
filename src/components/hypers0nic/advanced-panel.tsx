"use client";

import { useState, useRef } from "react";
import { useHypers0nic } from "@/store/hypers0nic";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Server, RefreshCw, ExternalLink, CheckCircle2, XCircle, Download, Upload, Database, Trash2 } from "lucide-react";
import { getScramjet } from "@/lib/scramjet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  loadSettings,
  saveSettings,
  loadHistory,
  saveHistory,
  loadBookmarks,
  saveBookmarks,
  loadCustomShortcuts,
  saveCustomShortcuts,
  loadFocusSessions,
  saveFocusSessions,
} from "@/lib/storage";
import { applyTheme } from "@/lib/themes";
import { toast } from "sonner";

export function AdvancedPanel() {
  const wispUrl = useHypers0nic((s) => s.settings.wispUrl);
  const setWispUrl = useHypers0nic((s) => s.setWispUrl);
  const scramjet = useHypers0nic((s) => s.scramjet);
  const useLibcurlTransport = useHypers0nic((s) => s.settings.preferences.useLibcurlTransport);
  const setPreferences = useHypers0nic((s) => s.setPreferences);

  const wispUrlPath = useHypers0nic((s) => s.settings.wispUrlPath);
  const proxyPrefix = useHypers0nic((s) => s.settings.proxyPrefix);
  const setWispUrlPath = (path: string) => {
    const settings = { ...useHypers0nic.getState().settings, wispUrlPath: path };
    useHypers0nic.setState({ settings });
    saveSettings(settings);
  };
  const setProxyPrefix = (prefix: string) => {

    if (prefix && !/^\/[a-z0-9\-]+\/$/i.test(prefix)) return;
    const settings = { ...useHypers0nic.getState().settings, proxyPrefix: prefix || "/service/" };
    useHypers0nic.setState({ settings });
    saveSettings(settings);
  };

  const [draft, setDraft] = useState(wispUrl);
  const [draftPath, setDraftPath] = useState(wispUrlPath);
  const [draftPrefix, setDraftPrefix] = useState(proxyPrefix);
  const [testing, setTesting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    setWispUrl(draft);
    toast.success("Wisp relay saved. It applies on the next proxy boot.");
  };

  const handleExport = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: loadSettings(),
      history: loadHistory(),
      bookmarks: loadBookmarks(),
      customShortcuts: loadCustomShortcuts(),
      focusSessions: loadFocusSessions(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hypers0nic-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Settings exported to JSON file.");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (data.settings) {
          saveSettings(data.settings);
          applyTheme(data.settings.theme);
        }
        if (data.history) saveHistory(data.history);
        if (data.bookmarks) saveBookmarks(data.bookmarks);
        if (data.customShortcuts) saveCustomShortcuts(data.customShortcuts);
        if (data.focusSessions) saveFocusSessions(data.focusSessions);
        toast.success("Backup imported. Reloading to apply…");
        setTimeout(() => window.location.reload(), 1200);
      } catch {
        toast.error("Invalid backup file. Make sure it's a Hypers0nic export.");
      }
    };
    reader.readAsText(file);

    e.target.value = "";
  };

  const handleReset = () => {
    setDraft("");
    setWispUrl("");
    toast.success("Reset to the default relay.");
  };

  const handleResetAll = () => {

    const keys = [
      "hypers0nic:settings:v1",
      "hypers0nic:history:v1",
      "hypers0nic:bookmarks:v1",
      "hypers0nic:focus-sessions:v1",
      "hypers0nic:custom-shortcuts:v1",
      "hypers0nic:notepad:v1",
      "hypers0nic:weather:v1",
    ];
    keys.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {

      }
    });

    try {
      indexedDB.deleteDatabase("$scramjet");
    } catch {

    }
    toast.success("All data erased. Reloading…");
    setTimeout(() => window.location.reload(), 1200);
  };

  const handleRestart = async () => {
    setTesting(true);
    try {

      const sj = getScramjet();
      const snap = sj.getState();
      toast[scramjet.status === "ready" ? "success" : "error"](
        snap.status === "ready"
          ? "Proxy is healthy."
          : snap.error || "Proxy is not ready."
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Transport relay</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Scramjet tunnels traffic through a wisp WebSocket relay. Leave blank to
          use the default public relay; point at your own server for self-hosting.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wisp-url">Wisp relay URL</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Server className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="wisp-url"
              className="pl-9"
              placeholder="wss://your-relay.example.com/"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <Button onClick={handleSave}>Save</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Default: <code className="rounded bg-muted/60 px-1 py-0.5">wss://anura.pro/</code> (public relay)
        </p>
        <Button variant="ghost" size="sm" onClick={handleReset} className="mt-1 h-7 text-xs">
          Reset to default relay
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wisp-url-path">Wisp URL path disguise</Label>
        <div className="flex gap-2">
          <Input
            id="wisp-url-path"
            placeholder="/api/stream (optional)"
            value={draftPath}
            onChange={(e) => setDraftPath(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-xs"
          />
          <Button
            onClick={() => {
              setWispUrlPath(draftPath);
              toast.success("Wisp URL path saved. It applies on the next proxy boot.");
            }}
          >
            Save
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Optional. Appends a custom path to the wisp URL (e.g.,{" "}
          <code className="rounded bg-muted/60 px-1 py-0.5">/api/stream</code>) so the
          WebSocket traffic looks like a normal API call. Helps evade path-based filters.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="proxy-prefix">Proxy prefix</Label>
        <div className="flex gap-2">
          <Input
            id="proxy-prefix"
            placeholder="/service/"
            value={draftPrefix}
            onChange={(e) => setDraftPrefix(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-xs"
          />
          <Button
            onClick={() => {
              if (draftPrefix && !/^\/[a-z0-9\-]+\/$/i.test(draftPrefix)) {
                toast.error("Prefix must start and end with /, contain at least one letter/number, and only use letters, numbers, and hyphens. Example: /s/");
                return;
              }
              setProxyPrefix(draftPrefix);
              toast.success("Proxy prefix saved. Reload the page to apply (SW re-registration required).");
            }}
          >
            Save
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          The path the service worker intercepts. Default:{" "}
          <code className="rounded bg-muted/60 px-1 py-0.5">/service/</code>. Change
          to <code className="rounded bg-muted/60 px-1 py-0.5">/s/</code>,{" "}
          <code className="rounded bg-muted/60 px-1 py-0.5">/browse/</code>, etc. to
          evade filters that block the known /service/ path. Requires page reload.
        </p>
      </div>

      <div className="h-px bg-border/40" />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Transport mode</h3>
        <p className="text-xs text-muted-foreground">
          Choose how Scramjet tunnels traffic to the wisp relay. Epoxy is the
          default and works well in most environments. libcurl (Tinf0il mode)
          uses a different WASM-based transport that can bypass some network
          restrictions epoxy cannot, at the cost of slightly higher latency.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label
            className={
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors " +
              (!useLibcurlTransport
                ? "border-primary/60 bg-primary/5"
                : "border-border/40 hover:border-border/70")
            }
          >
            <input
              type="radio"
              name="transport-mode"
              className="mt-0.5 accent-primary"
              checked={!useLibcurlTransport}
              onChange={() => setPreferences({ useLibcurlTransport: false })}
            />
            <div className="space-y-0.5">
              <div className="text-sm font-medium text-foreground">Epoxy</div>
              <div className="text-[11px] text-muted-foreground">
                Default. Faster, lower overhead. Recommended for general use.
              </div>
            </div>
          </label>
          <label
            className={
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors " +
              (useLibcurlTransport
                ? "border-primary/60 bg-primary/5"
                : "border-border/40 hover:border-border/70")
            }
          >
            <input
              type="radio"
              name="transport-mode"
              className="mt-0.5 accent-primary"
              checked={useLibcurlTransport}
              onChange={() => {
                setPreferences({ useLibcurlTransport: true });
                toast.success("libcurl transport enabled. It applies on the next proxy boot.");
              }}
            />
            <div className="space-y-0.5">
              <div className="text-sm font-medium text-foreground">
                libcurl <span className="text-[10px] text-primary">(Tinf0il mode)</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Fallback for restrictive networks. Auto-used if epoxy fails.
              </div>
            </div>
          </label>
        </div>
      </div>

      <div className="h-px bg-border/40" />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Backup &amp; restore</h3>
        <p className="text-xs text-muted-foreground">
          Export all your settings, bookmarks, history, custom shortcuts and
          focus sessions to a JSON file. Import to restore on another device.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="size-4" />
            Export backup
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <Upload className="size-4" />
            Import backup
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImport}
            className="hidden"
          />
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Database className="size-3.5 shrink-0 text-primary" />
          <span>Includes: settings, themes, tab cloak, bookmarks, history, shortcuts, focus data.</span>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Reset all Hypers0nic data</p>
            <p className="text-xs text-muted-foreground">
              Permanently deletes settings, bookmarks, history, shortcuts, and
              focus data from this device.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-2 shrink-0">
                <Trash2 className="size-4" />
                Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently erase all your Hypers0nic data stored in
                  this browser: settings, themes, tab cloak, bookmarks, history,
                  custom shortcuts, and focus sessions. This cannot be undone.
                  Consider exporting a backup first.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleResetAll}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, erase everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="h-px bg-border/40" />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Diagnostics</h3>
        <div className="space-y-2 rounded-xl border border-border/50 bg-muted/30 p-3 text-xs">
          <DiagRow label="Scramjet status" value={scramjet.status} ok={scramjet.status === "ready"} />
          {scramjet.version && (
            <DiagRow label="Scramjet version" value={scramjet.version} />
          )}
          {scramjet.wispUrl && (
            <DiagRow label="Active relay" value={scramjet.wispUrl} mono />
          )}
          {scramjet.error && (
            <DiagRow label="Last error" value={scramjet.error} ok={false} mono />
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRestart} disabled={testing}>
            <RefreshCw className="size-4" />
            Check status
          </Button>
          <a href="https://github.com/MercuryWorkshop/scramjet" target="_blank" rel="noreferrer noopener">
            <Button variant="ghost" size="sm">
              <ExternalLink className="size-4" />
              Scramjet docs
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

function DiagRow({
  label,
  value,
  ok,
  mono,
}: {
  label: string;
  value: string;
  ok?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={
          "flex items-center gap-1.5 text-right " +
          (ok === undefined
            ? "text-foreground"
            : ok
              ? "text-emerald-500"
              : "text-destructive") +
          (mono ? " font-mono text-[11px] break-all" : "")
        }
      >
        {ok !== undefined &&
          (ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />)}
        {value}
      </span>
    </div>
  );
}
