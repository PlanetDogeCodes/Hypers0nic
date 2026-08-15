"use client";

import { useState, useCallback, useMemo } from "react";
import { X, Copy, Check, RefreshCw, Shield, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CHAR_SETS = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  numbers: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
};

export function PasswordGenerator({ onClose }: { onClose?: () => void }) {
  const [length, setLength] = useState(16);
  const [useLower, setUseLower] = useState(true);
  const [useUpper, setUseUpper] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(false);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = useCallback(() => {
    const pools = [
      useLower ? CHAR_SETS.lowercase : "",
      useUpper ? CHAR_SETS.uppercase : "",
      useNumbers ? CHAR_SETS.numbers : "",
      useSymbols ? CHAR_SETS.symbols : "",
    ].filter(Boolean);

    if (pools.length === 0) {
      setPassword("");
      return;
    }

    const allChars = pools.join("");

    const guaranteed = pools.map((pool) => pool[Math.floor(Math.random() * pool.length)]);
    const remaining: string[] = [];
    for (let i = 0; i < length - guaranteed.length; i++) {
      remaining.push(allChars[Math.floor(Math.random() * allChars.length)]);
    }

    const result = [...guaranteed, ...remaining];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    setPassword(result.join(""));
  }, [length, useLower, useUpper, useNumbers, useSymbols]);

  useMemo(() => {
    if (!password) generate();
  }, []);

  const copy = () => {
    if (!password) return;
    navigator.clipboard?.writeText(password);
    setCopied(true);
    toast.success("Password copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  const strength = useMemo(() => {
    if (!password) return { score: 0, label: "—", color: "text-muted-foreground" };
    const poolSize =
      (useLower ? 26 : 0) +
      (useUpper ? 26 : 0) +
      (useNumbers ? 10 : 0) +
      (useSymbols ? 24 : 0);
    const entropy = length * Math.log2(poolSize || 1);
    if (entropy < 40) return { score: 1, label: "Weak", color: "text-destructive" };
    if (entropy < 60) return { score: 2, label: "Fair", color: "text-amber-400" };
    if (entropy < 80) return { score: 3, label: "Strong", color: "text-emerald-400" };
    return { score: 4, label: "Very strong", color: "text-emerald-400" };
  }, [password, length, useLower, useUpper, useNumbers, useSymbols]);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Password Generator</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            aria-label="Close password generator"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-lg border border-border/40 bg-card/40 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <code className="font-mono text-sm text-foreground break-all">
              {password || "—"}
            </code>
          </div>
        </div>
        <button
          onClick={copy}
          disabled={!password}
          className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-card/40 text-muted-foreground transition-colors hover:bg-card/70 hover:text-foreground disabled:opacity-40"
          aria-label="Copy password"
        >
          {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
        </button>
        <button
          onClick={generate}
          className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-card/40 text-muted-foreground transition-colors hover:bg-card/70 hover:text-foreground"
          aria-label="Regenerate password"
        >
          <RefreshCw className="size-4" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        {strength.score >= 3 ? (
          <ShieldCheck className={cn("size-4", strength.color)} />
        ) : (
          <Shield className={cn("size-4", strength.color)} />
        )}
        <div className="flex flex-1 gap-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= strength.score
                  ? strength.score === 1
                    ? "bg-destructive"
                    : strength.score === 2
                      ? "bg-amber-400"
                      : "bg-emerald-400"
                  : "bg-muted/40"
              )}
            />
          ))}
        </div>
        <span className={cn("text-xs font-medium", strength.color)}>{strength.label}</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Length</Label>
          <span className="font-mono text-sm font-semibold text-foreground">{length}</span>
        </div>
        <Slider
          value={[length]}
          onValueChange={(v) => setLength(v[0])}
          min={4}
          max={64}
          step={1}
          className="py-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ToggleRow label="Lowercase (a-z)" checked={useLower} onChange={setUseLower} />
        <ToggleRow label="Uppercase (A-Z)" checked={useUpper} onChange={setUseUpper} />
        <ToggleRow label="Numbers (0-9)" checked={useNumbers} onChange={setUseNumbers} />
        <ToggleRow label="Symbols (!@#)" checked={useSymbols} onChange={setUseSymbols} />
      </div>

      <Button onClick={generate} size="sm" className="w-full gap-2">
        <RefreshCw className="size-4" />
        Generate new password
      </Button>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border/30 bg-card/20 px-2.5 py-2 transition-colors hover:bg-card/40">
      <span className="text-xs text-foreground/80">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
