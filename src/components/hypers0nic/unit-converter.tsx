"use client";

import { useState, useMemo } from "react";
import { X, Ruler, Scale, Thermometer, ArrowRightLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Category = "length" | "weight" | "temperature";

interface Unit {
  id: string;
  label: string;

  toBase: (v: number) => number;
  fromBase: (v: number) => number;
}

const CATEGORIES: { id: Category; label: string; icon: React.ElementType }[] = [
  { id: "length", label: "Length", icon: Ruler },
  { id: "weight", label: "Weight", icon: Scale },
  { id: "temperature", label: "Temp", icon: Thermometer },
];

const UNITS: Record<Category, Unit[]> = {
  length: [
    { id: "m", label: "Meters", toBase: (v) => v, fromBase: (v) => v },
    { id: "km", label: "Kilometers", toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
    { id: "cm", label: "Centimeters", toBase: (v) => v / 100, fromBase: (v) => v * 100 },
    { id: "mm", label: "Millimeters", toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
    { id: "mi", label: "Miles", toBase: (v) => v * 1609.344, fromBase: (v) => v / 1609.344 },
    { id: "ft", label: "Feet", toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
    { id: "in", label: "Inches", toBase: (v) => v * 0.0254, fromBase: (v) => v / 0.0254 },
  ],
  weight: [
    { id: "kg", label: "Kilograms", toBase: (v) => v, fromBase: (v) => v },
    { id: "g", label: "Grams", toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
    { id: "mg", label: "Milligrams", toBase: (v) => v / 1_000_000, fromBase: (v) => v * 1_000_000 },
    { id: "lb", label: "Pounds", toBase: (v) => v * 0.453592, fromBase: (v) => v / 0.453592 },
    { id: "oz", label: "Ounces", toBase: (v) => v * 0.0283495, fromBase: (v) => v / 0.0283495 },
    { id: "t", label: "Tonnes", toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
  ],
  temperature: [
    { id: "c", label: "Celsius", toBase: (v) => v, fromBase: (v) => v },
    { id: "f", label: "Fahrenheit", toBase: (v) => (v - 32) * (5 / 9), fromBase: (v) => v * (9 / 5) + 32 },
    { id: "k", label: "Kelvin", toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
  ],
};

export function UnitConverter({ onClose }: { onClose?: () => void }) {
  const [category, setCategory] = useState<Category>("length");
  const [fromUnit, setFromUnit] = useState("m");
  const [toUnit, setToUnit] = useState("ft");
  const [inputValue, setInputValue] = useState("1");

  const units = UNITS[category];

  const result = useMemo(() => {
    const value = parseFloat(inputValue);
    if (isNaN(value)) return null;
    const from = units.find((u) => u.id === fromUnit);
    const to = units.find((u) => u.id === toUnit);
    if (!from || !to) return null;
    const base = from.toBase(value);
    return to.fromBase(base);
  }, [inputValue, fromUnit, toUnit, units]);

  const switchCategory = (cat: Category) => {
    setCategory(cat);
    const newUnits = UNITS[cat];
    setFromUnit(newUnits[0].id);
    setToUnit(newUnits[1]?.id || newUnits[0].id);
  };

  const swap = () => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
  };

  const copyResult = () => {
    if (result === null) return;
    const formatted = formatNumber(result);
    navigator.clipboard?.writeText(formatted);
    toast.success(`Copied ${formatted} to clipboard`);
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Unit Converter</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            aria-label="Close converter"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-muted/20 p-1">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => switchCategory(cat.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all",
                category === cat.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {cat.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">From</Label>
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            type="number"
            className="flex-1 text-sm tabular-nums"
            placeholder="0"
          />
          <Select value={fromUnit} onValueChange={setFromUnit}>
            <SelectTrigger className="w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id} className="text-xs">
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={swap}
          className="flex items-center gap-1.5 rounded-full border border-border/40 bg-card/30 px-3 py-1 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-card/60 hover:text-foreground active:scale-90"
        >
          <ArrowRightLeft className="size-3" />
          Swap
        </button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">To</Label>
        <div className="flex gap-2">
          <button
            onClick={copyResult}
            className="flex flex-1 items-center rounded-md border border-border/40 bg-card/40 px-3 py-2 text-left text-sm font-semibold tabular-nums text-foreground transition-colors hover:bg-card/70"
            title="Click to copy"
          >
            {result === null ? "—" : formatNumber(result)}
          </button>
          <Select value={toUnit} onValueChange={setToUnit}>
            <SelectTrigger className="w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id} className="text-xs">
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {result !== null && (
        <p className="text-center text-xs text-muted-foreground">
          {inputValue || "0"} {units.find((u) => u.id === fromUnit)?.label} ={" "}
          <span className="font-medium text-foreground">
            {formatNumber(result)}
          </span>{" "}
          {units.find((u) => u.id === toUnit)?.label}
        </p>
      )}
    </div>
  );
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000 || (Math.abs(n) < 0.001 && n !== 0)) {
    return n.toExponential(4);
  }

  const rounded = parseFloat(n.toPrecision(6));
  return rounded.toString();
}
