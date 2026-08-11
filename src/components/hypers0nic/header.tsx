"use client";

import { useEffect, useState } from "react";
import { Settings, Home as HomeIcon, History, Search, EyeOff, Eye, LayoutGrid, ShieldCheck, User, Cookie } from "lucide-react";
import { useHypers0nic } from "@/store/hypers0nic";
import { Clock } from "./clock";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function Header({
  onOpenSettings,
  onOpenHistory,
  onOpenPalette,
  onOpenApps,
  onOpenTinf0il,
  onOpenCookies,
}: {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenPalette: () => void;
  onOpenApps: () => void;
  onOpenTinf0il: () => void;
  onOpenCookies: () => void;
}) {
  const view = useHypers0nic((s) => s.view);
  const goHome = useHypers0nic((s) => s.goHome);
  const tinfoil = useHypers0nic((s) => s.settings.tinfoil);
  const history = useHypers0nic((s) => s.history);
  const tabCloak = useHypers0nic((s) => s.settings.tabCloak);
  const toggleStealth = useHypers0nic((s) => s.toggleStealth);
  const topBarAlwaysVisible = useHypers0nic((s) => s.settings.preferences.topBarAlwaysVisible);
  const [visible, setVisible] = useState(topBarAlwaysVisible);

  useEffect(() => {
    setVisible(topBarAlwaysVisible);
  }, [topBarAlwaysVisible]);

  useEffect(() => {
    if (topBarAlwaysVisible) return;
    const handler = (e: MouseEvent) => {
      if (e.clientY <= 40) {
        setVisible(true);
      } else {
        const header = document.getElementById("main-header");
        if (header) {
          const rect = header.getBoundingClientRect();
          if (e.clientY > rect.bottom + 10) {
            setVisible(false);
          }
        }
      }
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, [topBarAlwaysVisible]);

  const handleStealth = () => {
    toggleStealth();
    toast.success(
      tabCloak.enabled
        ? "Stealth mode disabled"
        : "Stealth mode active"
    );
  };

  return (
    <>
      {!topBarAlwaysVisible && (
        <div className="fixed left-0 right-0 top-0 z-40 h-10" onMouseEnter={() => setVisible(true)} />
      )}

      <header
        id="main-header"
        className={cn(
          "fixed left-0 right-0 top-0 z-50 flex h-12 items-center gap-3 border-b border-border/30 bg-background/95 px-4 backdrop-blur-md transition-transform duration-200",
          visible ? "translate-y-0" : "-translate-y-full"
        )}
      >
        {/* Clock */}
        <button
          type="button"
          onClick={goHome}
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
          aria-label="Hypers0nic home"
        >
          <Clock className="text-sm font-bold text-foreground" />
        </button>

        {view === "proxy" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={goHome}
            className="ml-1 hidden text-muted-foreground sm:flex"
          >
            <HomeIcon className="size-4" />
            New search
          </Button>
        )}

        {/* Command palette trigger */}
        <button
          onClick={onOpenPalette}
          className="ml-auto hidden items-center gap-2 rounded border border-border/30 bg-card/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border/60 hover:text-foreground md:flex"
        >
          <Search className="size-3.5" />
          <span>Quick search…</span>
          <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-border/40 bg-muted/60 px-1 font-mono text-[10px] font-semibold text-foreground">
            Ctrl+K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1 md:ml-2">
          {/* Tinf0il login/profile button */}
          {tinfoil.connected ? (
            <button
              onClick={onOpenTinf0il}
              className="flex items-center gap-1.5 rounded border border-primary/30 bg-primary/5 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              aria-label="Tinf0il profile"
            >
              <User className="size-3.5" />
              <span className="hidden max-w-[6rem] truncate sm:inline">{tinfoil.username}</span>
            </button>
          ) : (
            <button
              onClick={onOpenTinf0il}
              className="flex items-center gap-1.5 rounded border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
              aria-label="Log in or sign up"
            >
              <ShieldCheck className="size-3.5" />
              <span>Log In / Sign Up</span>
            </button>
          )}

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onOpenApps}
                  className="inline-flex size-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                  aria-label="Open apps"
                >
                  <LayoutGrid className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Quick apps</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleStealth}
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded transition-colors",
                    tabCloak.enabled
                      ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                      : "text-muted-foreground hover:bg-card hover:text-foreground"
                  )}
                  aria-label={tabCloak.enabled ? "Disable stealth mode" : "Enable stealth mode"}
                >
                  {tabCloak.enabled ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{tabCloak.enabled ? "Stealth on · click to disable" : "Stealth mode"}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onOpenHistory}
                  className="relative size-8 text-muted-foreground hover:text-foreground"
                  aria-label="History"
                >
                  <History className="size-4" />
                  {history.length > 0 && (
                    <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-primary" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>History · Ctrl+H</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onOpenCookies}
                  className="size-8 text-muted-foreground hover:text-foreground"
                  aria-label="Cookie manager"
                >
                  <Cookie className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Cookies</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onOpenSettings}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Settings"
                >
                  <Settings className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Settings · Ctrl+,</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>
    </>
  );
}
