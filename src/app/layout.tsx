import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hypers0nic",
  description:
    "A Scramjet-powered web proxy client with Tinf0il sync and tab cloaking.",
  keywords: [
    "scramjet",
    "proxy",
    "tinf0il",
    "web proxy",
    "hypers0nic",
    "interception proxy",
  ],
  authors: [{ name: "Hypers0nic" }],
  applicationName: "Hypers0nic",
  icons: {
    icon: "/icon.png",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistMono.variable} antialiased bg-background text-foreground`}
        // suppressHydrationWarning: browser extensions (ProtonPass, Grammarly,
        // etc.) inject attributes like data-protonpass-form onto the body
        // before React hydrates, causing hydration mismatch warnings in dev.
        // This is harmless and expected — the warning is suppressed so it
        // doesn't clutter the console.
        suppressHydrationWarning
      >
        {/* Preload critical proxy assets for faster first navigation.
            The Scramjet WASM (~500KB) and JS bundle are needed before any
            page can be proxied. Preloading them in parallel with the page
            load shaves ~200-400ms off the first navigation. */}
        <link rel="preload" href="/scramjet/scramjet.all.js" as="script" />
        <link rel="preload" href="/scramjet/scramjet.wasm.wasm" as="fetch" crossOrigin="anonymous" />
        <link rel="preload" href="/baremux/worker.js" as="script" />
        <link rel="preload" href="/epoxy/index.mjs" as="script" />
        {/* modulepreload — tells the browser to start fetching AND parsing
            these JS modules in parallel with the page render. They're fetched
            with high priority and compiled off the main thread, so by the
            time the user clicks a search result, the Scramjet bundle and
            BareMux worker are already downloaded and ready to execute. */}
        <link rel="modulepreload" href="/scramjet/scramjet.all.js" />
        <link rel="modulepreload" href="/baremux/worker.js" />
        {children}
        <Toaster />
        <SonnerToaster
          position="bottom-center"
          toastOptions={{
            classNames: {
              toast: "bg-card border-border text-foreground font-mono",
            },
          }}
        />
      </body>
    </html>
  );
}
