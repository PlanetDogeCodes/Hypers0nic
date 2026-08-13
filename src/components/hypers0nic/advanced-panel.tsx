"use client";

import { useState, useRef } from "react";
import { useHypers0nic } from "@/store/hypers0nic";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Server, RefreshCw, ExternalLink, CheckCircle2, XCircle, Download, Upload, Database, Trash2, BookmarkPlus } from "lucide-react";
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

  const [draft, setDraft] = useState(wispUrl);
  const [testing, setTesting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bookmarkInputRef = useRef<HTMLInputElement>(null);
  const importBookmarks = useHypers0nic((s) => s.importBookmarks);

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
    // Reset the input so the same file can be re-imported.
    e.target.value = "";
  };

  const handleReset = () => {
    setDraft("");
    setWispUrl("");
    toast.success("Reset to the local relay.");
  };

  const handleBookmarkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const html = reader.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const links = doc.querySelectorAll("a[href]");
        const bookmarks: { url: string; title: string }[] = [];
        links.forEach((a) => {
          const href = a.getAttribute("href");
          const title = a.textContent?.trim() || "";
          if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
            bookmarks.push({ url: href, title });
          }
        });
        if (bookmarks.length === 0) {
          toast.error("No valid bookmarks found in the file.");
          return;
        }
        importBookmarks(bookmarks);
        toast.success(`Imported ${bookmarks.length} bookmark${bookmarks.length === 1 ? "" : "s"}.`);
      } catch {
        toast.error("Failed to parse bookmark file. Make sure it's an HTML bookmark export.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleResetAll = () => {
    // Wipe every localStorage key Hypers0nic owns.
    const keys = [
      "hypers0nic:settings:v1",
      "hypers0nic:history:v1",
      "hypers0nic:bookmarks:v1",
      "hypers0nic:bookmark-folders:v1",
      "hypers0nic:focus-sessions:v1",
      "hypers0nic:custom-shortcuts:v1",
      "hypers0nic:notepad:v1",
      "hypers0nic:weather:v1",
    ];
    keys.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    });
    // Clear the scramjet IDB so a fresh boot isn't confused by a stale schema.
    try {
      indexedDB.deleteDatabase("$scramjet");
    } catch {
      /* ignore */
    }
    toast.success("All data erased. Reloading…");
    setTimeout(() => window.location.reload(), 1200);
  };

  const handleRestart = async () => {
    setTesting(true);
    try {
      // Re-initialise scramjet. The manager memoises by init promise, so we
      // rely on a full page reload to truly restart; here we just verify the
      // current state.
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
          use the bundled local relay; point at your own server for self-hosting.
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
          Default: <code className="rounded bg-muted/60 px-1 py-0.5">same-origin via Caddy → :3001</code>
        </p>
        <Button variant="ghost" size="sm" onClick={handleReset} className="mt-1 h-7 text-xs">
          Reset to local relay
        </Button>
      </div>

      <div className="h-px bg-border/40" />

      {/* Data backup / restore */}
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

      {/* Import browser bookmarks */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Import browser bookmarks</h3>
        <p className="text-xs text-muted-foreground">
          Import bookmarks from your browser's bookmark manager. Supports standard
          HTML bookmark export format (Netscape Bookmark File).
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => bookmarkInputRef.current?.click()}
            className="gap-2"
          >
            <BookmarkPlus className="size-4" />
            Import bookmarks
          </Button>
          <input
            ref={bookmarkInputRef}
            type="file"
            accept="text/html,.html,.htm"
            onChange={handleBookmarkImport}
            className="hidden"
          />
        </div>
      </div>

      {/* Danger zone — reset all data */}
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
