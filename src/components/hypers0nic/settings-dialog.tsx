"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AppearancePanel } from "./appearance-panel";
import { TabCloakPanel } from "./tab-cloak-panel";
import { SearchPanel } from "./search-panel";
import { PreferencesPanel } from "./preferences-panel";
import { AdvancedPanel } from "./advanced-panel";
import { ShortcutsPanel } from "./shortcuts-panel";
import {
  Palette,
  EyeOff,
  Search,
  SlidersHorizontal,
  Wrench,
  Keyboard,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHypers0nic } from "@/store/hypers0nic";

const TABS = [
  { value: "appearance", icon: Palette, label: "Appearance" },
  { value: "cloak", icon: EyeOff, label: "Cloak" },
  { value: "search", icon: Search, label: "Search" },
  { value: "prefs", icon: SlidersHorizontal, label: "Prefs" },
  { value: "shortcuts", icon: Keyboard, label: "Shortcuts" },
  { value: "advanced", icon: Wrench, label: "Advanced" },
] as const;

export function SettingsDialog({
  open,
  onOpenChange,
  onOpenTinf0il,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenTinf0il: () => void;
}) {
  const tinfoil = useHypers0nic((s) => s.settings.tinfoil);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border/30 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            Settings
          </DialogTitle>
          <DialogDescription className="text-xs">
            <button
              onClick={onOpenTinf0il}
              className="flex items-center gap-1.5 text-primary hover:underline"
            >
              <ShieldCheck className="size-3" />
              {tinfoil.connected
                ? `Connected as ${tinfoil.username} · Manage`
                : "Connect Tinf0il account to sync settings"}
            </button>
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="appearance"
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="px-3 pt-3">
            <TabsList className="grid h-auto grid-cols-3 gap-1 bg-card/50 p-1 sm:grid-cols-6">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex-col gap-1 py-2 text-[10px] font-medium sm:flex-row sm:gap-1.5 sm:text-xs"
                  >
                    <Icon className="size-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <TabsContent value="appearance" className="mt-0">
              <AppearancePanel />
            </TabsContent>
            <TabsContent value="cloak" className="mt-0">
              <TabCloakPanel />
            </TabsContent>
            <TabsContent value="search" className="mt-0">
              <SearchPanel />
            </TabsContent>
            <TabsContent value="prefs" className="mt-0">
              <PreferencesPanel />
            </TabsContent>
            <TabsContent value="shortcuts" className="mt-0">
              <ShortcutsPanel />
            </TabsContent>
            <TabsContent value="advanced" className="mt-0">
              <AdvancedPanel />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
