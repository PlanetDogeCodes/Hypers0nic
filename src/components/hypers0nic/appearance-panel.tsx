"use client";

import { useHypers0nic } from "@/store/hypers0nic";
import { THEMES } from "@/lib/themes";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThemeId } from "@/lib/types";
import { Switch } from "@/components/ui/switch";

function ThemeSwatch({ themeId }: { themeId: ThemeId }) {
  const theme = THEMES.find((t) => t.id === themeId)!;
  return (
    <div className="flex overflow-hidden rounded-md border border-border/40">
      <div style={{ background: theme.vars["--background"] }} className="size-5" />
      <div style={{ background: theme.vars["--card"] }} className="size-5" />
      <div style={{ background: theme.vars["--primary"] }} className="size-5" />
      <div style={{ background: theme.vars["--accent"] }} className="size-5" />
    </div>
  );
}

export function AppearancePanel() {
  const theme = useHypers0nic((s) => s.settings.theme);
  const setTheme = useHypers0nic((s) => s.setTheme);
  const preferences = useHypers0nic((s) => s.settings.preferences);
  const setPreferences = useHypers0nic((s) => s.setPreferences);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-sm font-semibold text-foreground">Theme</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Recolour the whole interface. Purple-forward themes are the default.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={cn(
                "group flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all",
                theme === t.id
                  ? "border-primary bg-primary/10"
                  : "border-border/50 hover:border-primary/40 hover:bg-muted/40"
              )}
            >
              <ThemeSwatch themeId={t.id} />
              <span className="flex-1 text-sm text-foreground">{t.name}</span>
              {theme === t.id && (
                <Check className="size-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-border/40" />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Motion &amp; layout</h3>
        <ToggleRow
          label="Smooth transitions"
          description="Animate view changes and hover states."
          checked={preferences.smoothTransitions}
          onChange={(v) => setPreferences({ smoothTransitions: v })}
        />
        <ToggleRow
          label="Compact density"
          description="Tighten spacing throughout the interface."
          checked={preferences.compactDensity}
          onChange={(v) => setPreferences({ compactDensity: v })}
        />
        <ToggleRow
          label="Show shortcuts on home"
          description="Display quick-launch tiles below the search bar."
          checked={preferences.showShortcuts}
          onChange={(v) => setPreferences({ showShortcuts: v })}
        />
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
      />
    </div>
  );
}
