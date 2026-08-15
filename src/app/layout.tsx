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

        suppressHydrationWarning
      >
        <link rel="preload" href="/scramjet/scramjet.all.js" as="script" />
        <link rel="preload" href="/scramjet/scramjet.wasm.wasm" as="fetch" crossOrigin="anonymous" />
        <link rel="preload" href="/baremux/worker.js" as="script" />
        <link rel="preload" href="/epoxy/index.mjs" as="script" />
        <link rel="modulepreload" href="/scramjet/scramjet.all.js" />
        <link rel="modulepreload" href="/baremux/worker.js" />
        <link rel="preconnect" href="https://anura.pro" />
        <link rel="preconnect" href="https://wisp.mercurywork.shop" />
        <link rel="preconnect" href="https://wisp.seymour.dev" />
        <link rel="preconnect" href="https://wispproxy.mcloud.work" />
        <link rel="preconnect" href="https://wisp.aluwiwovb.be" />
        <link rel="preconnect" href="https://wisp.mint.lavenderburrito.com" />
        <link rel="dns-prefetch" href="https://duckduckgo.com" />
        <link rel="dns-prefetch" href="https://google.com" />
        <link rel="dns-prefetch" href="https://suggestqueries.google.com" />
        <link rel="dns-prefetch" href="https://api.bing.com" />
        <link rel="dns-prefetch" href="https://search.brave.com" />
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
