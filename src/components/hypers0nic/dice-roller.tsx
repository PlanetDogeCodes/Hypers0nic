"use client";

import { useState, useCallback } from "react";
import { X, Dices, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface DieConfig {
  id: string;
  sides: number;
  count: number;
}

export function DiceRoller({ onClose }: { onClose?: () => void }) {
  const [dice, setDice] = useState<DieConfig[]>([
    { id: "d1", sides: 6, count: 1 },
  ]);
  const [results, setResults] = useState<{ sides: number; values: number[]; total: number }[]>([]);
  const [history, setHistory] = useState<string[]>([]);

  const addDie = useCallback(() => {
    setDice((prev) => [
      ...prev,
      { id: `d${Date.now()}`, sides: 6, count: 1 },
    ]);
  }, []);

  const removeDie = useCallback((id: string) => {
    setDice((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const updateDie = useCallback((id: string, field: "sides" | "count", value: number) => {
    setDice((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, [field]: Math.max(field === "sides" ? 2 : 1, Math.min(field === "sides" ? 1000 : 100, value)) }
          : d
      )
    );
  }, []);

  const roll = useCallback(() => {
    const newResults = dice.map((d) => {
      const values: number[] = [];
      for (let i = 0; i < d.count; i++) {
        values.push(Math.floor(Math.random() * d.sides) + 1);
      }
      return {
        sides: d.sides,
        values,
        total: values.reduce((sum, v) => sum + v, 0),
      };
    });
    setResults(newResults);

    const summary = newResults
      .map((r) => `${r.count || r.values.length}d${r.sides}: [${r.values.join(", ")}] = ${r.total}`)
      .join(" | ");
    setHistory((prev) => [summary, ...prev].slice(0, 10));
  }, [dice]);

  const grandTotal = results.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Dice Roller</span>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-3" />
            Close
          </button>
        )}
      </div>

      <div className="space-y-2">
        {dice.map((die) => (
          <div key={die.id} className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="100"
              value={die.count}
              onChange={(e) => updateDie(die.id, "count", parseInt(e.target.value) || 1)}
              className="w-14 rounded border border-border/40 bg-card/50 px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
              aria-label="Number of dice"
            />
            <span className="text-xs text-muted-foreground">d</span>
            <select
              value={die.sides}
              onChange={(e) => updateDie(die.id, "sides", parseInt(e.target.value))}
              className="rounded border border-border/40 bg-card/50 px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
            >
              {[4, 6, 8, 10, 12, 20, 100].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              onClick={() => removeDie(die.id)}
              className="text-muted-foreground hover:text-destructive"
              disabled={dice.length === 1}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={addDie}
          className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus className="size-3" />
          Add die
        </button>
        <button
          onClick={roll}
          className="flex items-center gap-1.5 rounded border border-primary bg-primary/10 px-4 py-1 text-xs font-medium text-primary hover:bg-primary/20"
        >
          <Dices className="size-3.5" />
          Roll!
        </button>
      </div>

      {results.length > 0 && (
        <div className="rounded border border-border/40 bg-card/50 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Results</div>
          <div className="space-y-1.5">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">{r.values.length}d{r.sides}:</span>
                <span className="font-mono text-foreground">
                  [{r.values.join(", ")}]
                </span>
                <span className="ml-auto font-bold text-primary">= {r.total}</span>
              </div>
            ))}
          </div>
          {results.length > 1 && (
            <div className="mt-2 border-t border-border/20 pt-2 text-xs">
              <span className="text-muted-foreground">Grand total: </span>
              <span className="font-bold text-primary">{grandTotal}</span>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">History</div>
          <div className="max-h-24 space-y-0.5 overflow-y-auto">
            {history.map((h, i) => (
              <div key={i} className="truncate font-mono text-[10px] text-muted-foreground">
                {h}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
