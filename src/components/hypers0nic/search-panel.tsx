"use client";

import { useHypers0nic } from "@/store/hypers0nic";
import { SEARCH_ENGINES } from "@/lib/search-engines";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function SearchPanel() {
  const searchEngine = useHypers0nic((s) => s.settings.searchEngine);
  const setSearchEngine = useHypers0nic((s) => s.setSearchEngine);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Default search engine</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Used when you type a query that isn&apos;t a URL. Tinf0il-synced
          preferences override this automatically.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SEARCH_ENGINES.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setSearchEngine(e.id)}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
              searchEngine === e.id
                ? "border-primary bg-primary/10"
                : "border-border/50 hover:border-primary/40 hover:bg-muted/40"
            )}
          >
            <span
              className="flex size-9 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ background: e.accent }}
            >
              {e.name[0]}
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{e.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {e.url.replace("https://", "").replace("?q=%s", "")}
              </p>
            </div>
            {searchEngine === e.id && <Check className="size-4 text-primary" />}
          </button>
        ))}
      </div>
    </div>
  );
}
