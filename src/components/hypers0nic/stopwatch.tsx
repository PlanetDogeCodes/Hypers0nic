"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Play, Pause, RotateCcw, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

type StopwatchState = "idle" | "running" | "paused";

export function Stopwatch({ onClose }: { onClose?: () => void }) {
  const [state, setState] = useState<StopwatchState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const startRef = useRef<number>(0);
  const accumulatedRef = useRef<number>(0);

  const tickRef = useRef<() => void>(() => {});

  useEffect(() => {
    tickRef.current = () => {
      setElapsed(accumulatedRef.current + (Date.now() - startRef.current));
      rafRef.current = requestAnimationFrame(() => tickRef.current());
    };
  }, []);

  const start = useCallback(() => {
    startRef.current = Date.now();
    setState("running");
    rafRef.current = requestAnimationFrame(() => tickRef.current());
  }, []);

  const pause = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    accumulatedRef.current += Date.now() - startRef.current;
    setState("paused");
  }, []);

  const reset = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    accumulatedRef.current = 0;
    setElapsed(0);
    setState("idle");
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const format = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const centis = Math.floor((ms % 1000) / 10);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}.${centis.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Stopwatch</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            aria-label="Close stopwatch"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 rounded-xl border border-border/40 bg-card/30 py-8">
        <Timer className="size-5 text-primary/60" />
        <div
          className={cn(
            "bg-gradient-to-b bg-clip-text font-mono text-5xl font-bold tabular-nums text-transparent",
            state === "running"
              ? "from-primary to-fuchsia-500"
              : "from-foreground to-foreground/70"
          )}
        >
          {format(elapsed)}
        </div>
        <div className="text-xs text-muted-foreground">
          {state === "running" && "Running…"}
          {state === "paused" && "Paused"}
          {state === "idle" && "Ready"}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        {state === "idle" && (
          <button
            onClick={start}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:scale-105 active:scale-95"
          >
            <Play className="size-4" fill="currentColor" />
            Start
          </button>
        )}
        {state === "running" && (
          <button
            onClick={pause}
            className="flex items-center gap-2 rounded-full bg-amber-500/90 px-6 py-2.5 text-sm font-medium text-white transition-all hover:scale-105 active:scale-95"
          >
            <Pause className="size-4" fill="currentColor" />
            Pause
          </button>
        )}
        {state === "paused" && (
          <button
            onClick={start}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:scale-105 active:scale-95"
          >
            <Play className="size-4" fill="currentColor" />
            Resume
          </button>
        )}
        {state !== "idle" && (
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-full border border-border/40 bg-card/40 px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-card/70 hover:text-foreground active:scale-95"
          >
            <RotateCcw className="size-4" />
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
