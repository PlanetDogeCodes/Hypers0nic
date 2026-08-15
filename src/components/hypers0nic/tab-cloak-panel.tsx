"use client";

import { useHypers0nic } from "@/store/hypers0nic";
import { TAB_CLOAK_PRESETS, applyTabCloak } from "@/lib/tab-cloak";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Globe, Eye } from "lucide-react";
import { toast } from "sonner";

export function TabCloakPanel() {
  const tabCloak = useHypers0nic((s) => s.settings.tabCloak);
  const setTabCloak = useHypers0nic((s) => s.setTabCloak);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Tab cloaking</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Disguise this tab as another site. Changes the document title and
            favicon.
          </p>
        </div>
        <Switch
          checked={tabCloak.enabled}
          onCheckedChange={(v) => {
            setTabCloak({ enabled: v });
            if (v) toast.success("Tab cloak enabled.");
          }}
          aria-label="Enable tab cloaking"
        />
      </div>

      <div
        className={cn(
          "grid grid-cols-2 gap-2 sm:grid-cols-4 transition-opacity",
          !tabCloak.enabled && "pointer-events-none opacity-40"
        )}
      >
        {TAB_CLOAK_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setTabCloak({ preset: p.id });
              applyTabCloak(p.id, tabCloak.customTitle, tabCloak.customIcon);
            }}
            className={cn(
              "flex flex-col items-center gap-2 rounded border p-3 text-center transition-colors",
              tabCloak.preset === p.id
                ? "border-primary bg-primary/10"
                : "border-border/20 hover:border-primary/40 hover:bg-card/40"
            )}
          >
            {p.id === "custom" ? (
              <span className="flex size-8 items-center justify-center rounded bg-muted/40 text-muted-foreground">
                <Eye className="size-4" />
              </span>
            ) : p.icon.startsWith("/") ? (
              <span className="flex size-8 items-center justify-center rounded bg-primary/10">
                <Globe className="size-4 text-primary" />
              </span>
            ) : (
              <img
                src={p.icon}
                alt=""
                className="size-8 rounded bg-muted/30 p-1"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <span className="text-xs text-foreground">{p.name}</span>
          </button>
        ))}
      </div>

      {tabCloak.preset === "classroom" && (
        <div className="space-y-3 rounded border border-border/20 bg-card/20 p-4">
          <p className="text-xs font-medium text-foreground">
            Classroom cloak settings
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="cloak-title" className="text-xs">Tab title</Label>
            <Input
              id="cloak-title"
              placeholder="Home - Classroom"
              value={tabCloak.customTitle ?? ""}
              onChange={(e) => {
                setTabCloak({ customTitle: e.target.value });
                applyTabCloak("classroom", e.target.value, tabCloak.customIcon);
              }}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cloak-icon" className="text-xs">Favicon URL</Label>
            <Input
              id="cloak-icon"
              placeholder="https://..."
              value={tabCloak.customIcon ?? ""}
              onChange={(e) => {
                setTabCloak({ customIcon: e.target.value });
                applyTabCloak("classroom", tabCloak.customTitle, e.target.value);
              }}
              className="text-sm"
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {tabCloak.preset === "custom" && (
        <div className="space-y-3 rounded border border-border/20 bg-card/20 p-4">
          <p className="text-xs font-medium text-foreground">
            Custom cloak settings
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="custom-title" className="text-xs">Tab title</Label>
            <Input
              id="custom-title"
              placeholder="My Dashboard"
              value={tabCloak.customTitle ?? ""}
              onChange={(e) => {
                setTabCloak({ customTitle: e.target.value });
                applyTabCloak("custom", e.target.value, tabCloak.customIcon);
              }}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-icon" className="text-xs">Favicon URL</Label>
            <Input
              id="custom-icon"
              placeholder="https://example.com/favicon.ico"
              value={tabCloak.customIcon ?? ""}
              onChange={(e) => {
                setTabCloak({ customIcon: e.target.value });
                applyTabCloak("custom", tabCloak.customTitle, e.target.value);
              }}
              className="text-sm"
              spellCheck={false}
            />
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Current tab title:{" "}
        <span className="text-foreground">&ldquo;{document.title}&rdquo;</span>
      </p>
    </div>
  );
}
