"use client";

import { useState } from "react";
import { X, Save, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const NOTEPAD_KEY = "hypers0nic:notepad:v1";

export function Notepad({ onClose }: { onClose?: () => void }) {
  // Lazy-init from localStorage so the first paint already has saved text —
  // no setState call inside the effect body.
  const [text, setText] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(NOTEPAD_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [saved, setSaved] = useState(false);

  const save = () => {
    try {
      localStorage.setItem(NOTEPAD_KEY, text);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const clear = () => {
    setText("");
    try {
      localStorage.removeItem(NOTEPAD_KEY);
    } catch {
      /* ignore */
    }
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Notepad</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={save}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              saved
                ? "bg-emerald-500/10 text-emerald-400"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            )}
          >
            {saved ? <Check className="size-3.5" /> : <Save className="size-3.5" />}
            {saved ? "Saved" : "Save"}
          </button>
          <button
            onClick={clear}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Clear notepad"
          >
            <Trash2 className="size-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              aria-label="Close notepad"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Jot down a quick note…"
        className="h-48 w-full resize-none rounded-xl border border-border/40 bg-card/40 p-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/40"
        spellCheck={false}
      />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{wordCount} words · {charCount} chars</span>
        <span className="flex items-center gap-1">
          <span className={cn("size-1.5 rounded-full", saved ? "bg-emerald-400" : "bg-muted-foreground/40")} />
          {saved ? "Saved to this device" : "Auto-saves on Save click"}
        </span>
      </div>
    </div>
  );
}
