"use client";

import { useHypers0nic } from "@/store/hypers0nic";
import { Shield, Zap, AlertTriangle, Loader2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

export function ProxyHUD() {
  const scramjet = useHypers0nic((s) => s.scramjet);

  const config = {
    idle: {
      label: "Standing by",
      sub: "Proxy will boot on first search",
      dotClass: "bg-muted-foreground",
      icon: Zap,
      iconClass: "text-muted-foreground",
    },
    loading: {
      label: "Establishing relay",
      sub: "Negotiating wisp transport…",
      dotClass: "bg-primary",
      icon: Loader2,
      iconClass: "text-primary",
    },
    ready: {
      label: "Proxy online",
      sub: "Traffic routed through Scramjet",
      dotClass: "bg-primary",
      icon: Shield,
      iconClass: "text-primary",
    },
    error: {
      label: "Proxy offline",
      sub: scramjet.error || "Connection failed",
      dotClass: "bg-destructive",
      icon: AlertTriangle,
      iconClass: "text-destructive",
    },
  }[scramjet.status];

  const Icon = config.icon;
  const animate = scramjet.status === "loading" || scramjet.status === "ready";
  const showDot = scramjet.status === "ready" || scramjet.status === "loading";
  const maskedIp = useScramblingIp(scramjet.status === "ready");

  return (
    <div className="mt-4 flex items-center gap-2.5">
      {showDot ? (
        <span className="relative flex size-2 shrink-0">
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-60",
              config.dotClass,
              scramjet.status === "ready" && "animate-ping"
            )}
          />
          <span className={cn("relative inline-flex size-2 rounded-full", config.dotClass)} />
        </span>
      ) : (
        <Icon className={cn("size-3.5 shrink-0", config.iconClass, scramjet.status === "loading" && "animate-spin")} />
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-foreground">{config.label}</p>
          {scramjet.version && scramjet.status === "ready" && (
            <span className="rounded border border-primary/30 px-1 py-0.5 text-[9px] font-medium text-primary">
              v{scramjet.version}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <p className="truncate text-[11px] text-muted-foreground">{config.sub}</p>
          {scramjet.status === "ready" && (
            <>
              <span className="text-border/40">·</span>
              <span className="flex items-center gap-1 font-mono text-[10px] text-primary/80">
                <Activity className="size-2.5" />
                {maskedIp}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function useScramblingIp(active: boolean): string {
  const [ip, setIp] = useState(() =>
    active ? randomOctets() : "•••.•••.•••.•••"
  );

  const tickRef = useRef<() => void>(() => {});
  useEffect(() => {
    tickRef.current = () => {
      setIp(Math.random() > 0.6 ? randomOctets() : "•••.•••.•••.•••");
    };
  }, []);

  useEffect(() => {
    if (!active) {
      setIp("•••.•••.•••.•••");
      return;
    }
    const id = setInterval(() => tickRef.current(), 1200);
    return () => clearInterval(id);
  }, [active]);

  return ip;
}

function randomOctets(): string {
  const digit = () => Math.floor(Math.random() * 10).toString();
  const octet = () => digit() + digit() + digit();
  return `${octet()}.${octet()}.${octet()}.${octet()}`;
}
