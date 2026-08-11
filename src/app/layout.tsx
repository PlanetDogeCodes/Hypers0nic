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
      >
        {/* Preload critical proxy assets for faster first navigation */}
        <link rel="preload" href="/scramjet/scramjet.v2.js" as="script" />
        <link rel="preload" href="/scramjet/scramjet.all.js" as="script" />
        <link rel="preload" href="/baremux/worker.js" as="script" />
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
