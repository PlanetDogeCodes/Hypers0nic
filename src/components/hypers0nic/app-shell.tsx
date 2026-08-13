"use client";

import { useEffect, useState } from "react";
import { Header } from "./header";
import { Footer } from "./footer";
import { HomeView } from "./home-view";
import { ProxyFrame } from "./proxy-frame";
import { ProxyTabBar } from "./proxy-tab-bar";
import { SettingsDialog } from "./settings-dialog";
import { HistoryPanel } from "./history-panel";
import { CommandPalette } from "./command-palette";
import { AppsPanel } from "./apps-panel";
import { Tinf0ilAuth } from "./tinf0il-auth";
import { CookieManager } from "./cookie-manager";
import { SwUpdateBanner } from "./sw-update-banner";
import { useHypers0nic } from "@/store/hypers0nic";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { usePanicKey } from "@/hooks/use-panic-key";
import { useTinfoilAutoSync } from "@/hooks/use-tinfoil-auto-sync";
import { useTransportHealth } from "@/hooks/use-transport-health";
import { applyTabCloak } from "@/lib/tab-cloak";

export function AppShell() {
  const view = useHypers0nic((s) => s.view);
  const tabs = useHypers0nic((s) => s.tabs);
  const activeTabId = useHypers0nic((s) => s.activeTabId);
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
    // Ctrl+Shift+A → quick-open the apps panel (Task 5).
    onOpenApps: () => setAppsOpen(true),
    // Ctrl+Shift+T → reopen the most recently closed tab (Task 5). Reads
    // directly from the store via getState() to avoid subscribing this
    // component to recentlyClosed (which would re-render AppShell on every
    // tab close/open and cause needless child re-renders).
    onReopenClosedTab: () => {
      void useHypers0nic.getState().reopenClosedTab();
    },
  });

  usePanicKey();
  useTinfoilAutoSync();
  // Transport health monitor (Task 4). Pings the wisp relay every 30s and
  // writes transportQuality + transportLatency into the store, which the
  // ProxyHUD reads to render its connection-quality dot. The hook also
  // auto-force-reconnects when the transport has been dead for 2 ticks.
  // We intentionally don't use the return value here — the values flow
  // through the store. (Destructuring keeps the call self-documenting;
  // the cost is at most 1 re-render per 30s tick, which is negligible.)
  useTransportHealth();

  // Calculate the top padding needed to clear the fixed header (3rem) and
  // the tab bar (2rem when visible in proxy view with 2+ tabs).
  const hasTabBar = view === "proxy" && tabs.length > 1;
  const topPadding = topBarAlwaysVisible ? (hasTabBar ? "3.25rem" : "3rem") : "0";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SwUpdateBanner />
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenApps={() => setAppsOpen(true)}
        onOpenTinf0il={() => setTinf0ilOpen(true)}
        onOpenCookies={() => setCookiesOpen(true)}
      />
      <div style={{ paddingTop: topPadding }}>
        <main className="flex min-h-[calc(100vh-3rem)] flex-col">
          {view === "home" ? (
            <HomeView onOpenHistory={() => setHistoryOpen(true)} />
          ) : (
            <div className="flex flex-col">
              <ProxyTabBar />
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  style={{ display: tab.id === activeTabId ? "block" : "none" }}
                  aria-hidden={tab.id !== activeTabId}
                >
                  <ProxyFrame tabId={tab.id} />
                </div>
              ))}
            </div>
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
