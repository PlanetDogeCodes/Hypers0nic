"use client";

import { useEffect, useState } from "react";
import { Header } from "./header";
import { Footer } from "./footer";
import { HomeView } from "./home-view";
import { ProxyFrame } from "./proxy-frame";
import { TabBar } from "./tab-bar";
import { SettingsDialog } from "./settings-dialog";
import { HistoryPanel } from "./history-panel";
import { CommandPalette } from "./command-palette";
import { AppsPanel } from "./apps-panel";
import { Tinf0ilAuth } from "./tinf0il-auth";
import { CookieManager } from "./cookie-manager";
import { useHypers0nic } from "@/store/hypers0nic";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { usePanicKey } from "@/hooks/use-panic-key";
import { useTinfoilAutoSync } from "@/hooks/use-tinfoil-auto-sync";
import { applyTabCloak } from "@/lib/tab-cloak";

export function AppShell() {
  const view = useHypers0nic((s) => s.view);
  const hydrate = useHypers0nic((s) => s.hydrate);
  const tabCloak = useHypers0nic((s) => s.settings.tabCloak);
  const topBarAlwaysVisible = useHypers0nic((s) => s.settings.preferences.topBarAlwaysVisible);
  const tabCount = useHypers0nic((s) => s.tabs.length);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [tinf0ilOpen, setTinf0ilOpen] = useState(false);
  const [cookiesOpen, setCookiesOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (tabCloak.enabled) {
      applyTabCloak(
        tabCloak.preset,
        tabCloak.customTitle,
        tabCloak.customIcon
      );
      const id = setTimeout(() => {
        applyTabCloak(
          tabCloak.preset,
          tabCloak.customTitle,
          tabCloak.customIcon
        );
      }, 100);
      return () => clearTimeout(id);
    } else {
      applyTabCloak("default");
      const id = setTimeout(() => applyTabCloak("default"), 100);
      return () => clearTimeout(id);
    }
  }, [tabCloak.enabled, tabCloak.preset, tabCloak.customTitle, tabCloak.customIcon]);

  // The tab bar appears above the header when 2+ tabs are open. Both the
  // header/toolbar and the page content need to be pushed down to make room.
  const hasTabBar = tabCount >= 2;

  useKeyboardShortcuts({
    onOpenSettings: () => setSettingsOpen(true),
    onOpenHistory: () => setHistoryOpen((v) => !v),
    onOpenPalette: () => setPaletteOpen(true),
    onOpenApps: () => setAppsOpen(true),
    onReopenClosedTab: () => {
      useHypers0nic.getState().reopenClosedTab();
    },
  });

  usePanicKey();
  useTinfoilAutoSync();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {hasTabBar && <TabBar />}
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenApps={() => setAppsOpen(true)}
        onOpenTinf0il={() => setTinf0ilOpen(true)}
        onOpenCookies={() => setCookiesOpen(true)}
      />
      {/* When the top bar is always visible, push content down by its height.
          If the tab bar is also visible, add another 2rem (h-8) for it. */}
      <div className={(topBarAlwaysVisible ? "pt-12 " : "") + (hasTabBar ? "pt-8" : "")}>
        <main className="flex min-h-[calc(100vh-3rem)] flex-col">
          {view === "home" ? (
            <HomeView onOpenHistory={() => setHistoryOpen(true)} />
          ) : (
            <ProxyFrame />
          )}
        </main>
        {view === "home" && <Footer />}
      </div>
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onOpenTinf0il={() => {
          setSettingsOpen(false);
          setTinf0ilOpen(true);
        }}
      />
      <HistoryPanel open={historyOpen} onOpenChange={setHistoryOpen} />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
      />
      <AppsPanel open={appsOpen} onOpenChange={setAppsOpen} />
      <Tinf0ilAuth open={tinf0ilOpen} onOpenChange={setTinf0ilOpen} />
      <CookieManager open={cookiesOpen} onOpenChange={setCookiesOpen} />
    </div>
  );
}
