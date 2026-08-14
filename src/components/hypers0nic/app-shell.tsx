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
  const tabs = useHypers0nic((s) => s.tabs);
  const hydrate = useHypers0nic((s) => s.hydrate);
  const tabCloak = useHypers0nic((s) => s.settings.tabCloak);
  const topBarAlwaysVisible = useHypers0nic((s) => s.settings.preferences.topBarAlwaysVisible);
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

  useKeyboardShortcuts({
    onOpenSettings: () => setSettingsOpen(true),
    onOpenHistory: () => setHistoryOpen((v) => !v),
    onOpenPalette: () => setPaletteOpen(true),
    onOpenApps: () => setAppsOpen(true),
    onReopenClosedTab: () => {
      void useHypers0nic.getState().reopenClosedTab();
    },
  });

  usePanicKey();
  useTinfoilAutoSync();

  // The tab bar sits ABOVE the header/toolbar. Both are position:fixed.
  // When tabs are visible (2+), the tab bar takes ~2rem at the top.
  // The header/toolbar sits below it at top:2rem.
  // Content padding must account for both: 2rem (tabs) + 3rem (header) = 5rem.
  // When tabs are hidden (0-1 tabs), just the header: 3rem.
  // When the top bar is auto-hidden, content starts at 0 (or 2rem for tabs).
  const hasTabs = tabs.length > 1;
  const tabBarHeight = hasTabs ? 2 : 0; // rem
  const headerHeight = topBarAlwaysVisible ? 3 : 0; // rem
  const totalOffset = tabBarHeight + headerHeight; // rem

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Tab bar — always on top, above the header/toolbar. Rendered as a
          fixed element so it stays visible during scroll. */}
      {hasTabs && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 60 }}>
          <TabBar />
        </div>
      )}

      {/* Header — when tabs are visible, push it down by the tab bar height.
          When auto-hidden, the header still renders (it reveals on hover). */}
      <div style={hasTabs ? { marginTop: `${tabBarHeight}rem` } : undefined}>
        <Header
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenHistory={() => setHistoryOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenApps={() => setAppsOpen(true)}
          onOpenTinf0il={() => setTinf0ilOpen(true)}
          onOpenCookies={() => setCookiesOpen(true)}
        />
      </div>

      {/* Content — pushed down by the total offset (tabs + header). */}
      <div style={{ paddingTop: `${totalOffset}rem` }}>
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
