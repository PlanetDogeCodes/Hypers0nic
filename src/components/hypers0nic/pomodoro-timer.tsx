"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Coffee, Brain, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type PomodoroPhase = "focus" | "break" | "idle";

export function PomodoroTimer({ onClose }: { onClose?: () => void }) {
  const [phase, setPhase] = useState<PomodoroPhase>("idle");
  const [remaining, setRemaining] = useState(25 * 60);
  const [completedRounds, setCompletedRounds] = useState(0);
  const [autoStart, setAutoStart] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endTimeRef = useRef<number>(0);

  const FOCUS_DURATION = 25 * 60;
  const BREAK_DURATION = 5 * 60;

  useEffect(() => {
    if (phase === "idle") return;
    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, Math.round((endTimeRef.current - now) / 1000));
      setRemaining(left);
      if (left <= 0) {
        if (phase === "focus") {
          setCompletedRounds((r) => r + 1);
          toast.success("Focus complete! 5-minute break starting.");
          playBeep(880, 0.5);
          setPhase("break");
          endTimeRef.current = Date.now() + BREAK_DURATION * 1000;
          setRemaining(BREAK_DURATION);
        } else if (phase === "break") {
          toast.success("Break over! Starting next focus session.");
          playBeep(660, 0.3);
          if (autoStart) {
            setPhase("focus");
            endTimeRef.current = Date.now() + FOCUS_DURATION * 1000;
            setRemaining(FOCUS_DURATION);
          } else {
            setPhase("idle");
            setRemaining(FOCUS_DURATION);
          }
        }
      }
    };
    tick();
    intervalRef.current = setInterval(tick, 250);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase, autoStart]);

  const start = useCallback(() => {
    endTimeRef.current = Date.now() + (phase === "break" ? remaining : FOCUS_DURATION) * 1000;
    setPhase(phase === "break" ? "break" : "focus");
    if (phase === "idle") setRemaining(FOCUS_DURATION);
  }, [phase, remaining]);

  const pause = useCallback(() => {
    setPhase("idle");
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setRemaining(FOCUS_DURATION);
    setCompletedRounds(0);
  }, []);

  const isRunning = phase !== "idle";
  const totalForProgress = phase === "break" ? BREAK_DURATION : FOCUS_DURATION;
  const progress = isRunning ? 1 - remaining / totalForProgress : 0;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setPhase("idle");
            setRemaining(FOCUS_DURATION);
          }}
          className={cn(
            "rounded px-3 py-1 text-xs font-medium transition-colors",
            phase !== "break"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-card/40"
          )}
        >
          Focus
        </button>
        <button
          onClick={() => {
            setPhase("break");
            setRemaining(BREAK_DURATION);
          }}
          className={cn(
            "rounded px-3 py-1 text-xs font-medium transition-colors",
            phase === "break"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-card/40"
          )}
        >
          Break
        </button>
      </div>

      <div className="relative flex size-48 items-center justify-center">
        <svg className="size-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-border/20"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 45}
            strokeDashoffset={2 * Math.PI * 45 * (1 - progress)}
            className={cn(
              "transition-all duration-300",
              phase === "break" ? "text-emerald-500" : "text-primary"
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums text-foreground">
            {mins.toString().padStart(2, "0")}:{secs.toString().padStart(2, "0")}
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            {phase === "break" ? "Break" : phase === "focus" ? "Focus" : "Ready"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!isRunning ? (
          <button
            onClick={start}
            className="flex items-center gap-1.5 rounded border border-primary bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Play className="size-3.5" />
            Start
          </button>
        ) : (
          <button
            onClick={pause}
            className="flex items-center gap-1.5 rounded border border-border px-4 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Pause className="size-3.5" />
            Pause
          </button>
        )}
        <button
          onClick={reset}
          className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <RotateCcw className="size-3.5" />
          Reset
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-3.5" />
            Close
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Brain className="size-3 text-primary" />
          {completedRounds} {completedRounds === 1 ? "round" : "rounds"} completed
        </span>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={autoStart}
            onChange={(e) => setAutoStart(e.target.checked)}
            className="size-3 accent-primary"
          />
          Auto-start next
        </label>
      </div>
    </div>
  );
}

function playBeep(freq: number, duration: number) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    /* audio not available */
  }
}
