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

export function Clock({ className }: { className?: string }) {

  const [state, setState] = useState<ClockState>({ time: "--:--", ampm: "" });

  useEffect(() => {
    setState(format(new Date()));
    const id = setInterval(() => setState(format(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={className}>
      <span className="tabular-nums">{state.time}</span>
      {state.ampm && <span className="ml-1 text-muted-foreground">{state.ampm}</span>}
    </span>
  );
}
