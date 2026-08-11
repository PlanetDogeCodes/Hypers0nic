"use client";

import { useState, useRef } from "react";
import { X, Download, QrCode } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * QR code generator.
 *
 * Uses the free api.qrserver.com endpoint (no API key required) to render a QR
 * image from arbitrary text or a URL. The generated image can be downloaded as
 * PNG. Entirely client-side beyond the image fetch.
 */
export function QrGenerator({ onClose }: { onClose?: () => void }) {
  const [text, setText] = useState("https://");
  const [size, setSize] = useState(256);
  const [imgError, setImgError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Clear the error flag whenever the input or size changes. Using an onChange
  // handler (not an effect) keeps the setState out of the effect body, which
  // satisfies React 19's set-state-in-effect lint rule.
  const handleTextChange = (value: string) => {
    setText(value);
    setImgError(false);
  };
  const handleSizeChange = (s: number) => {
    setSize(s);
    setImgError(false);
  };

  const trimmed = text.trim();
  const hasContent = trimmed.length > 0 && trimmed !== "https://";
  const src = hasContent
    ? `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
        trimmed
      )}&margin=8&qzone=2&color=1a1428&bgcolor=ffffff`
    : "";

  const download = () => {
    if (!hasContent || !imgRef.current) return;
    // Fetch the image as a blob and trigger a download.
    fetch(src)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `hypers0nic-qr-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(() => {
        /* ignore download errors */
      });
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">QR Code Generator</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            aria-label="Close QR generator"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="qr-input" className="text-xs">
          URL or text
        </Label>
        <Input
          id="qr-input"
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="https://example.com or any text"
          className="text-sm"
          spellCheck={false}
        />
      </div>

      {/* QR preview */}
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border/40 bg-card/30 p-4">
        {hasContent && !imgError ? (
          <>
            <div className="rounded-lg bg-white p-2 shadow-sm">
              <img
                ref={imgRef}
                src={src}
                alt="Generated QR code"
                className="size-48"
                onError={() => setImgError(true)}
              />
            </div>
            <button
              onClick={download}
              className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/40 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-card/70"
            >
              <Download className="size-3.5" />
              Download PNG
            </button>
          </>
        ) : imgError ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <QrCode className="size-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              Couldn&apos;t generate QR code. Check your connection and try again.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <QrCode className="size-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              Enter text or a URL above to generate a QR code.
            </p>
          </div>
        )}
      </div>

      {/* Size selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Size:</span>
        {[128, 256, 384].map((s) => (
          <button
            key={s}
            onClick={() => handleSizeChange(s)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              size === s
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            )}
          >
            {s}px
          </button>
        ))}
      </div>
    </div>
  );
}
