"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, X, Check, Coffee, Timer, Sparkles, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useHypers0nic } from "@/store/hypers0nic";

type FocusState = "idle" | "running" | "paused" | "completed" | "break";

interface DurationOption {
  label: string;
  value: number;
  icon: React.ElementType;
}

const DURATION_OPTIONS: DurationOption[] = [
  { label: "Quick", value: 15, icon: Sparkles },
  { label: "Focus", value: 25, icon: Timer },
  { label: "Deep", value: 50, icon: Coffee },
];

const BREAK_DURATION = 5 * 60;
const RADIUS = 140;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function FocusTimer() {
  const [state, setState] = useState<FocusState>("idle");
  const [duration, setDuration] = useState(25 * 60);
  const [remaining, setRemaining] = useState(25 * 60);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endTimeRef = useRef<number>(0);
  const recordFocusSession = useHypers0nic((s) => s.recordFocusSession);
  const todaySessionCount = useHypers0nic((s) => s.todaySessionCount);
  const todayFocusMinutes = useHypers0nic((s) => s.todayFocusMinutes);
  const focusStreak = useHypers0nic((s) => s.focusStreak);

  useEffect(() => {
    if (state !== "running" && state !== "break") return;
    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, Math.round((endTimeRef.current - now) / 1000));
      setRemaining(left);
      if (left <= 0) {
        if (state === "running") {
          setState("completed");
          playBeep(880, 0.8);
          recordFocusSession(duration / 60);
          toast.success("Focus session complete! Time for a 5-min break.", {
            duration: 6000,
          });
        } else if (state === "break") {
          setState("idle");
          setRemaining(duration);
          playBeep(660, 0.5);
          toast.success("Break over — ready for another session?", {
            duration: 6000,
          });
        }
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    tick();
    intervalRef.current = setInterval(tick, 250);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [state, duration, recordFocusSession]);

  const start = useCallback(() => {
    endTimeRef.current = Date.now() + duration * 1000;
    setRemaining(duration);
    setState("running");
  }, [duration]);

  const pause = useCallback(() => {
    setState("paused");
    endTimeRef.current = Date.now() + remaining * 1000;
  }, [remaining]);

  const resume = useCallback(() => {
    endTimeRef.current = Date.now() + remaining * 1000;
    setState("running");
  }, [remaining]);

  const cancel = useCallback(() => {
    setState("idle");
    setRemaining(duration);
  }, [duration]);

  const startBreak = useCallback(() => {
    endTimeRef.current = Date.now() + BREAK_DURATION * 1000;
    setRemaining(BREAK_DURATION);
    setState("break");
  }, []);

  const selectDuration = useCallback(
    (mins: number) => {
      const secs = mins * 60;
      setDuration(secs);
      setRemaining(secs);
    },
    []
  );

  const isActive = state !== "idle";
  const isBreak = state === "break";
  const totalForProgress = isBreak ? BREAK_DURATION : duration;
  const progress = isActive ? 1 - remaining / totalForProgress : 0;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeDisplay = `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;

  return (
    <div className="relative flex flex-col items-center">
      {/* Duration picker */}
      <AnimatePresence>
        {state === "idle" && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mb-4 flex items-center gap-1 rounded border border-border/30 bg-card/50 p-1"
          >
            {DURATION_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActiveDur = duration === opt.value * 60;
              return (
                <button
                  key={opt.value}
                  onClick={() => selectDuration(opt.value)}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    isActiveDur
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-card hover:text-foreground"
                  )}
                >
                  <Icon className="size-3" />
                  {opt.label}
                  <span className="opacity-60">{opt.value}m</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session counter + streak */}
      <AnimatePresence>
        {state === "idle" && todaySessionCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mb-3 flex items-center gap-2 rounded border border-border/20 bg-card/30 px-2.5 py-1 text-xs"
          >
            {focusStreak >= 2 ? (
              <Flame className="size-3.5 text-primary" fill="currentColor" />
            ) : (
              <Flame className="size-3.5 text-primary" />
            )}
            <span className="font-medium text-foreground">
              {todaySessionCount} {todaySessionCount === 1 ? "session" : "sessions"}
            </span>
            <span className="text-muted-foreground">
              · {todayFocusMinutes} min today
            </span>
            {focusStreak >= 2 && (
              <>
                <span className="text-border/40">·</span>
                <span className="flex items-center gap-1 rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 font-semibold text-primary">
                  <Flame className="size-3" fill="currentColor" />
                  {focusStreak}-day streak
                </span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clock / timer */}
      <div className="relative flex size-72 items-center justify-center sm:size-80">
        <AnimatePresence>
          {isActive && (
            <motion.svg
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 size-full"
              viewBox="0 0 320 320"
            >
              <circle
                cx="160"
                cy="160"
                r={RADIUS}
                fill="none"
                stroke="var(--foreground)"
                strokeWidth="2"
                opacity="0.1"
              />
              <circle
                cx="160"
                cy="160"
                r={RADIUS}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 160 160)"
                style={{ transition: "stroke-dashoffset 0.3s ease" }}
              />
            </motion.svg>
          )}
        </AnimatePresence>

        <button
          onClick={() => {
            if (state === "idle") start();
            else if (state === "running") pause();
            else if (state === "paused") resume();
            else if (state === "completed") startBreak();
            else if (state === "break") cancel();
          }}
          className="group relative cursor-pointer rounded px-4 py-2 transition-colors hover:bg-card/30"
          aria-label={
            state === "idle"
              ? "Start focus session"
              : state === "running"
                ? "Pause focus session"
                : state === "paused"
                  ? "Resume focus session"
                  : state === "completed"
                    ? "Start break"
                    : "End break"
          }
        >
          {isActive ? (
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "text-6xl font-bold tracking-tight tabular-nums sm:text-7xl",
                  state === "completed"
                    ? "text-primary"
                    : isBreak
                      ? "text-primary"
                      : "text-foreground"
                )}
              >
                {state === "completed" ? "00:00" : timeDisplay}
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                {state === "running" && (
                  <>
                    <Pause className="size-3.5 text-primary" />
                    <span className="text-primary">Focusing · click to pause</span>
                  </>
                )}
                {state === "paused" && (
                  <>
                    <Play className="size-3.5 text-amber-500" />
                    <span className="text-amber-500">Paused · click to resume</span>
                  </>
                )}
                {state === "completed" && (
                  <>
                    <Coffee className="size-3.5 text-primary" />
                    <span className="text-primary">Done! Click for a 5-min break</span>
                  </>
                )}
                {isBreak && (
                  <>
                    <Coffee className="size-3.5 text-primary" />
                    <span className="text-primary">On break · click to end</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="text-5xl font-bold tracking-tight tabular-nums text-foreground sm:text-6xl">
                {String(duration / 60).padStart(2, "0")}:00
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                <Coffee className="size-3 text-primary" />
                <span>Click to start a {duration / 60}-min focus session</span>
              </div>
            </div>
          )}
        </button>

        {isActive && state !== "completed" && (
          <button
            onClick={cancel}
            className="absolute -right-2 -top-2 z-10 flex size-6 items-center justify-center rounded border border-border/30 bg-background text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Cancel focus session"
          >
            <X className="size-3" />
          </button>
        )}
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
