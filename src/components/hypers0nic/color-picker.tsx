"use client";

import { useState, useCallback } from "react";
import { X, Copy, Check, Pipette } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface RGB {
  r: number;
  g: number;
  b: number;
}

type Format = "hex" | "rgb" | "hsl";

export function ColorPicker({ onClose }: { onClose?: () => void }) {
  const [color, setColor] = useState("#7c3aed");
  const [copied, setCopied] = useState<Format | null>(null);

  const rgb = hexToRgb(color);
  const hsl = rgbToHsl(rgb);

  const copy = useCallback((value: string, format: Format) => {
    navigator.clipboard?.writeText(value);
    setCopied(format);
    toast.success(`Copied ${value}`);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  const formats: { format: Format; label: string; value: string }[] = [
    { format: "hex", label: "HEX", value: color.toUpperCase() },
    {
      format: "rgb",
      label: "RGB",
      value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    },
    {
      format: "hsl",
      label: "HSL",
      value: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
    },
  ];

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Color Picker</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            aria-label="Close color picker"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <label
          className="relative size-20 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border/40 shadow-lg"
          style={{ backgroundColor: color }}
        >
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label="Pick a color"
          />
          <Pipette className="absolute bottom-1.5 right-1.5 size-3.5 text-white/70 drop-shadow" />
        </label>
        <div className="flex-1 space-y-2">
          <div className="space-y-1">
            <Label htmlFor="hex-input" className="text-xs text-muted-foreground">
              HEX value
            </Label>
            <Input
              id="hex-input"
              value={color}
              onChange={(e) => {
                const v = e.target.value;
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setColor(v);
              }}
              className="font-mono text-sm uppercase"
              maxLength={7}
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {formats.map(({ format, label, value }) => (
          <button
            key={format}
            onClick={() => copy(value, format)}
            className="flex w-full items-center gap-3 rounded-lg border border-border/40 bg-card/30 px-3 py-2.5 text-left transition-all hover:bg-card/60"
          >
            <span
              className="size-8 shrink-0 rounded-md ring-1 ring-inset ring-white/10"
              style={{ backgroundColor: color }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              <p className="truncate font-mono text-sm text-foreground">{value}</p>
            </div>
            {copied === format ? (
              <Check className="size-4 shrink-0 text-emerald-400" />
            ) : (
              <Copy className="size-4 shrink-0 text-muted-foreground" />
            )}
          </button>
        ))}
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Quick palette
        </p>
        <div className="grid grid-cols-8 gap-1.5">
          {QUICK_PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn(
                "aspect-square rounded-md ring-1 ring-inset ring-white/10 transition-transform hover:scale-110",
                color.toLowerCase() === c.toLowerCase() && "ring-2 ring-foreground"
              )}
              style={{ backgroundColor: c }}
              aria-label={`Select ${c}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const QUICK_PALETTE = [
  "#7c3aed", "#a855f7", "#ec4899", "#ef4444",
  "#f59e0b", "#10b981", "#06b6d4", "#3b82f6",
  "#1f2937", "#4b5563", "#9ca3af", "#e5e7eb",
  "#000000", "#ffffff", "#fde047", "#8b5cf6",
];

function hexToRgb(hex: string): RGB {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(cleaned.slice(0, 2), 16) || 0,
    g: parseInt(cleaned.slice(2, 4), 16) || 0,
    b: parseInt(cleaned.slice(4, 6), 16) || 0,
  };
}

function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return {
    h,
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}
