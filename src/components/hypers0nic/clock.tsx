"use client";

import { useEffect, useState } from "react";

interface ClockState {
  time: string;
  ampm: string;
}

function format(date: Date): ClockState {
  let hours = date.getHours();
  const mins = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const time = `${hours}:${mins}`;
  return { time, ampm };
}

/** Compact clock for the top bar — 12-hour format with AM/PM. */
export function Clock({ className }: { className?: string }) {
  const [state, setState] = useState<ClockState | null>(null);

  useEffect(() => {
    setState(format(new Date()));
    const id = setInterval(() => setState(format(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  if (!state) return <span className={className}>--:--</span>;

  return (
    <span className={className}>
      <span className="tabular-nums">{state.time}</span>
      <span className="ml-1 text-muted-foreground">{state.ampm}</span>
    </span>
  );
}
