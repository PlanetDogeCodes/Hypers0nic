"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cookie, Trash2, RefreshCw, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CookieEntry {
  domain: string;
  name: string;
  value: string;
  path: string;
  expires?: string;
  secure: boolean;
  httponly: boolean;
}

/**
 * Cookie manager dialog.
 *
 * Reads cookies from the Scramjet IndexedDB ($scramjet / cookies store) and
 * lets the user view, search, and delete them. This is essential for managing
 * session auth — users can inspect what cookies a proxied site has set,
 * clear them to reset a session, or verify that login cookies are present.
 */
export function CookieManager({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [cookies, setCookies] = useState<CookieEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const loadCookies = useCallback(async () => {
    setLoading(true);
    try {
      // Read from the $scramjet IndexedDB cookies object store
      const dbPromise = new Promise<CookieEntry[]>((resolve) => {
        const DB_NAME = "$scramjet";
        const req = indexedDB.open(DB_NAME);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("cookies")) {
            db.close();
            resolve([]);
            return;
          }
          try {
            const tx = db.transaction("cookies", "readonly");
            const store = tx.objectStore("cookies");
            const getAll = store.getAll();
            getAll.onsuccess = () => {
              db.close();
              const entries: CookieEntry[] = [];
              const results = getAll.result || [];
              for (const row of results) {
                // The cookies store uses domain as key, value is an array of cookie objects
                if (Array.isArray(row)) {
                  for (const c of row) {
                    if (c && typeof c === "object") {
                      entries.push({
                        domain: c.domain || c.host || "unknown",
                        name: c.name || "",
                        value: c.value || "",
                        path: c.path || "/",
                        expires: c.expires || c.expiry || undefined,
                        secure: !!c.secure,
                        httponly: !!c.httponly || !!c.httpOnly,
                      });
                    }
                  }
                } else if (row && typeof row === "object") {
                  // Single cookie object
                  if (row.cookies && Array.isArray(row.cookies)) {
                    for (const c of row.cookies) {
                      entries.push({
                        domain: c.domain || row.domain || "unknown",
                        name: c.name || "",
                        value: c.value || "",
                        path: c.path || "/",
                        expires: c.expires || c.expiry || undefined,
                        secure: !!c.secure,
                        httponly: !!c.httponly || !!c.httpOnly,
                      });
                    }
                  } else {
                    entries.push({
                      domain: row.domain || row.host || "unknown",
                      name: row.name || "",
                      value: row.value || "",
                      path: row.path || "/",
                      expires: row.expires || row.expiry || undefined,
                      secure: !!row.secure,
                      httponly: !!row.httponly || !!row.httpOnly,
                    });
                  }
                }
              }
              resolve(entries);
            };
            getAll.onerror = () => {
              db.close();
              resolve([]);
            };
          } catch (e) {
            db.close();
            resolve([]);
          }
        };
        req.onerror = () => resolve([]);
      });

      const entries = await dbPromise;
      setCookies(entries);
    } catch {
      setCookies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadCookies();
    }
  }, [open, loadCookies]);

  const deleteAllCookies = async () => {
    try {
      const DB_NAME = "$scramjet";
      const req = indexedDB.open(DB_NAME);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("cookies")) {
          db.close();
          return;
        }
        try {
          const tx = db.transaction("cookies", "readwrite");
          const store = tx.objectStore("cookies");
          store.clear();
          tx.oncomplete = () => {
            db.close();
            setCookies([]);
            toast.success("All cookies cleared.");
          };
          tx.onerror = () => {
            db.close();
            toast.error("Failed to clear cookies.");
          };
        } catch {
          db.close();
        }
      };
    } catch {
      toast.error("Failed to access cookie store.");
    }
  };

  const filtered = search.trim()
    ? cookies.filter(
        (c) =>
          c.domain.toLowerCase().includes(search.toLowerCase()) ||
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.value.toLowerCase().includes(search.toLowerCase())
      )
    : cookies;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Cookie className="size-4 text-primary" />
            Cookie Manager
          </DialogTitle>
          <DialogDescription className="text-xs">
            View and manage cookies stored by proxied sites. {cookies.length} cookie
            {cookies.length === 1 ? "" : "s"} stored.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search cookies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadCookies}
            disabled={loading}
            className="shrink-0"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={deleteAllCookies}
            disabled={cookies.length === 0}
            className="shrink-0 gap-1.5"
          >
            <Trash2 className="size-3.5" />
            Clear all
          </Button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto rounded border border-border/20">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <Cookie className="size-6 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                {search ? "No matching cookies found." : "No cookies stored yet."}
              </p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card/80 backdrop-blur-sm">
                <tr className="border-b border-border/20 text-left">
                  <th className="px-2 py-1.5 font-medium text-muted-foreground">Domain</th>
                  <th className="px-2 py-1.5 font-medium text-muted-foreground">Name</th>
                  <th className="px-2 py-1.5 font-medium text-muted-foreground">Value</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr
                    key={i}
                    className="border-b border-border/10 transition-colors hover:bg-card/30"
                  >
                    <td className="px-2 py-1.5 font-mono text-foreground/80">{c.domain}</td>
                    <td className="px-2 py-1.5 font-mono text-foreground/80">{c.name}</td>
                    <td className="max-w-[12rem] truncate px-2 py-1.5 font-mono text-muted-foreground">
                      {c.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
