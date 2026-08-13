"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calculator, StickyNote, QrCode, Ruler, Pipette, KeyRound, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calculator as CalculatorApp } from "./calculator";
import { Notepad } from "./notepad";
import { QrGenerator } from "./qr-generator";
import { UnitConverter } from "./unit-converter";
import { ColorPicker } from "./color-picker";
import { PasswordGenerator } from "./password-generator";
import { Stopwatch } from "./stopwatch";

type AppId = "calculator" | "notepad" | "qr" | "converter" | "color" | "password" | "stopwatch";

const APPS: { id: AppId; name: string; icon: React.ElementType; description: string }[] = [
  { id: "calculator", name: "Calculator", icon: Calculator, description: "Quick math" },
  { id: "notepad", name: "Notepad", icon: StickyNote, description: "Jot & save" },
  { id: "qr", name: "QR Code", icon: QrCode, description: "Generate" },
  { id: "converter", name: "Converter", icon: Ruler, description: "Units" },
  { id: "color", name: "Color", icon: Pipette, description: "Picker" },
  { id: "password", name: "Password", icon: KeyRound, description: "Generator" },
  { id: "stopwatch", name: "Stopwatch", icon: Timer, description: "Timer" },
];

export function AppsPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [activeApp, setActiveApp] = useState<AppId | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setActiveApp(null);
        onOpenChange(v);
      }}
    >
      <DialogContent className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogTitle className="sr-only">Apps</DialogTitle>

        {activeApp === null ? (
          /* App launcher grid */
          <div className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Quick apps</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {APPS.map((app) => {
                const Icon = app.icon;
                return (
                  <button
                    key={app.id}
                    onClick={() => setActiveApp(app.id)}
                    className="group flex flex-col items-center gap-2 rounded border border-border/20 bg-card/40 p-3 transition-colors hover:border-primary/40 hover:bg-card/70"
                  >
                    <Icon className="size-5 text-muted-foreground transition-colors group-hover:text-primary" />
                    <span className="text-[11px] font-medium text-foreground">{app.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Active app view */
          <div className="p-4">
            {/* App switcher bar */}
            <div className="mb-3 flex items-center gap-1 border-b border-border/20 pb-2">
              <button
                onClick={() => setActiveApp(null)}
                className="rounded border border-border/20 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-card/40 hover:text-foreground"
              >
                ← Back to apps
              </button>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded border border-border/20 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                ✕ Close
              </button>
              <div className="ml-auto flex flex-wrap items-center gap-0.5">
                {APPS.map((app) => {
                  const Icon = app.icon;
                  return (
                    <button
                      key={app.id}
                      onClick={() => setActiveApp(app.id)}
                      className={cn(
                        "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                        activeApp === app.id
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-card/40 hover:text-foreground"
                      )}
                    >
                      <Icon className="size-3" />
                      <span className="hidden sm:inline">{app.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {activeApp === "calculator" && <CalculatorApp onClose={() => onOpenChange(false)} />}
              {activeApp === "notepad" && <Notepad onClose={() => onOpenChange(false)} />}
              {activeApp === "qr" && <QrGenerator onClose={() => onOpenChange(false)} />}
              {activeApp === "converter" && <UnitConverter onClose={() => onOpenChange(false)} />}
              {activeApp === "color" && <ColorPicker onClose={() => onOpenChange(false)} />}
              {activeApp === "password" && <PasswordGenerator onClose={() => onOpenChange(false)} />}
              {activeApp === "stopwatch" && <Stopwatch onClose={() => onOpenChange(false)} />}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
