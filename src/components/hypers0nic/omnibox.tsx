"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Search, ArrowRight, Globe, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHypers0nic } from "@/store/hypers0nic";
import { getSearchEngine } from "@/lib/search-engines";

interface Suggestion {
  label: string;
  isUrl: boolean;
}

export function Omnibox({
  variant = "home",
  autoFocus = false,
}: {
  variant?: "home" | "toolbar";
  autoFocus?: boolean;
}) {
  const navigate = useHypers0nic((s) => s.navigate);
  const settings = useHypers0nic((s) => s.settings);
  const omniboxValue = useHypers0nic((s) => s.omniboxValue);
  const setOmnibox = useHypers0nic((s) => s.setOmnibox);

  const [query, setQuery] = useState(omniboxValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const engine = getSearchEngine(settings.searchEngine);

  useEffect(() => {
    setQuery(omniboxValue);
  }, [omniboxValue]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, []);

  const fetchSuggestions = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/suggest?engine=${encodeURIComponent(engine.id)}&q=${encodeURIComponent(q)}`
        );
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const data = (await res.json()) as { suggestions?: string[] };
        const list = (data.suggestions ?? []).slice(0, 8);
        setSuggestions(list.map((label) => ({ label, isUrl: false })));
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [engine.id]
  );

  const onChange = (value: string) => {
    setQuery(value);
    setActive(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 140);
  };

  const submit = (value?: string) => {
    const target = (value ?? query).trim();
    if (!target) return;
    setOpen(false);
    setSuggestions([]);
    setOmnibox(target);
    navigate(target);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
      setOpen(true);
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && suggestions[active]) {
        submit(suggestions[active].label);
      } else {
        submit();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showSuggestions = open && suggestions.length > 0;
  const isToolbar = variant === "toolbar";

  return (
    <div className="relative w-full">
      <div
        className={cn(
          "group flex items-center gap-3 rounded border bg-card/50 transition-colors",
          isToolbar
            ? "h-10 px-3 border-border/30 focus-within:border-primary"
            : "h-12 px-4 border-border/40 focus-within:border-primary"
        )}
      >
        <Search
          className={cn(
            "shrink-0 text-muted-foreground transition-colors group-focus-within:text-primary",
            isToolbar ? "size-4" : "size-5"
          )}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            setOpen(true);
            if (blurTimer.current) clearTimeout(blurTimer.current);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={onKeyDown}
          placeholder={
            isToolbar
              ? "Search or enter a URL"
              : `Search ${engine.name} or type a URL`
          }
          spellCheck={false}
          autoComplete="off"
          aria-label="Search or enter a URL"
          aria-autocomplete="list"
          className="min-w-0 flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
        />
        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        <button
          type="button"
          onClick={() => submit()}
          aria-label="Go"
          className={cn(
            "shrink-0 rounded border border-primary/30 bg-primary/10 text-primary flex items-center justify-center transition-colors hover:bg-primary/20 active:scale-90",
            isToolbar ? "size-7" : "size-8"
          )}
        >
          <ArrowRight className={isToolbar ? "size-3.5" : "size-4"} />
        </button>
      </div>

      {showSuggestions && (
        <ul
          role="listbox"
          className={cn(
            "absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border/60 bg-popover shadow-xl",
            isToolbar ? "rounded-xl" : "rounded-2xl"
          )}
        >
          {suggestions.map((s, i) => (
            <li key={s.label + i} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  submit(s.label);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm transition-colors",
                  i === active
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Globe className="size-4 shrink-0 text-primary/80" />
                <span className="truncate">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
