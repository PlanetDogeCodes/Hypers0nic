"use client";

import { useState, useRef, useCallback } from "react";
import { X, Copy, Hash, Loader2, AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type HashAlgorithm = "SHA-1" | "SHA-256" | "SHA-512" | "MD5";

export function HashGenerator({ onClose }: { onClose?: () => void }) {
  const [input, setInput] = useState("");
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>("SHA-256");
  const [output, setOutput] = useState("");
  const [reverseInput, setReverseInput] = useState("");
  const [reverseResult, setReverseResult] = useState<string | null>(null);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const reverseCancelRef = useRef(false);

  const generate = useCallback(async () => {
    if (!input) {
      setOutput("");
      return;
    }
    try {
      if (algorithm === "MD5") {
        setOutput(md5(input));
      } else {
        const encoder = new TextEncoder();
        const data = encoder.encode(input);
        const hashBuffer = await crypto.subtle.digest(algorithm, data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        setOutput(hashArray.map((b) => b.toString(16).padStart(2, "0")).join(""));
      }
    } catch (err) {
      setOutput("Error: " + (err instanceof Error ? err.message : String(err)));
    }
  }, [input, algorithm]);

  const copy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      toast.success("Hash copied");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => toast.error("Failed to copy"));
  };

  const reverseHash = useCallback(async () => {
    if (!reverseInput.trim()) return;
    setReverseLoading(true);
    setReverseResult(null);
    reverseCancelRef.current = false;

    const target = reverseInput.trim().toLowerCase();

    // Step 1: Try rainbow table (common passwords and words)
    const rainbowResult = checkRainbowTable(target, algorithm);
    if (rainbowResult) {
      setReverseResult(rainbowResult);
      setReverseLoading(false);
      toast.success("Found in rainbow table!");
      return;
    }

    // Step 2: Brute-force short strings (1-4 chars, alphanumeric)
    // This is ethical and educational — only tries short strings.
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let found: string | null = null;

    for (let len = 1; len <= 4 && !found && !reverseCancelRef.current; len++) {
      found = await bruteForce(target, algorithm, charset, len, () => {
        setReverseResult(`Trying ${len}-char combinations...`);
      });
      // Yield to UI
      await new Promise((r) => setTimeout(r, 0));
    }

    if (reverseCancelRef.current) {
      setReverseResult("Cancelled");
    } else if (found) {
      setReverseResult(found);
      toast.success("Hash reversed via brute-force!");
    } else {
      setReverseResult("Not found (tried rainbow table + 1-4 char brute-force)");
    }
    setReverseLoading(false);
  }, [reverseInput, algorithm]);

  const cancelReverse = () => {
    reverseCancelRef.current = true;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Hash Generator & Reverser</span>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-3" />
            Close
          </button>
        )}
      </div>

      {/* Generate hash */}
      <div className="space-y-2">
        <label className="block text-[10px] uppercase tracking-wider text-muted-foreground">Generate Hash</label>
        <div className="flex gap-2">
          <select
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value as HashAlgorithm)}
            className="rounded border border-border/40 bg-card/50 px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
          >
            <option value="SHA-256">SHA-256</option>
            <option value="SHA-1">SHA-1</option>
            <option value="SHA-512">SHA-512</option>
            <option value="MD5">MD5</option>
          </select>
          <button
            onClick={generate}
            className="rounded border border-primary bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20"
          >
            Generate
          </button>
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter text to hash..."
          className="h-16 w-full resize-none rounded border border-border/40 bg-card/50 p-2 font-mono text-xs text-foreground outline-none focus:border-primary"
          spellCheck={false}
        />
        {output && (
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate rounded border border-border/40 bg-background/60 px-2 py-1.5 font-mono text-[11px] text-primary">
              {output}
            </div>
            <button
              onClick={copy}
              className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            </button>
          </div>
        )}
      </div>

      <div className="h-px bg-border/20" />

      {/* Reverse hash */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <AlertTriangle className="size-3 text-amber-500" />
          Reverse Hash (Rainbow Table + Brute-force)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={reverseInput}
            onChange={(e) => setReverseInput(e.target.value)}
            placeholder="Enter hash to reverse..."
            className="flex-1 rounded border border-border/40 bg-card/50 px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-primary"
            spellCheck={false}
          />
          {!reverseLoading ? (
            <button
              onClick={reverseHash}
              className="rounded border border-primary bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20"
            >
              Reverse
            </button>
          ) : (
            <button
              onClick={cancelReverse}
              className="rounded border border-destructive bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/20"
            >
              Cancel
            </button>
          )}
        </div>
        {reverseLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin text-primary" />
            <span>{reverseResult || "Working..."}</span>
          </div>
        )}
        {reverseResult && !reverseLoading && (
          <div className={cn(
            "rounded border px-2 py-1.5 font-mono text-[11px]",
            reverseResult.startsWith("Not found") || reverseResult === "Cancelled"
              ? "border-amber-500/30 bg-amber-500/5 text-amber-600"
              : "border-primary/30 bg-primary/5 text-primary"
          )}>
            {reverseResult}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          Tries rainbow table (common passwords) then brute-forces 1-4 character strings.
          For educational use only — complex passwords cannot be reversed.
        </p>
      </div>
    </div>
  );
}

function checkRainbowTable(target: string, algorithm: HashAlgorithm): string | null {
  const commonWords = [
    "password", "123456", "admin", "hello", "world", "test", "foo", "bar",
    "abc", "123", "qwerty", "letmein", "welcome", "monkey", "dragon",
    "master", "login", "princess", "football", "shadow", "sunshine",
    "trustno1", "iloveyou", "batman", "access", "hello", "charlie",
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
    "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
    "ab", "cd", "ef", "gh", "ij", "kl", "mn", "op", "qr", "st", "uv", "wx", "yz",
    "yes", "no", "ok", "cat", "dog", "red", "blue", "green", "black", "white",
  ];

  for (const word of commonWords) {
    let hash: string;
    if (algorithm === "MD5") {
      hash = md5(word).toLowerCase();
    } else {
      // Sync crypto.subtle isn't available, so we can only check MD5 synchronously
      // For SHA algorithms, we'd need async — skip in rainbow table for now
      continue;
    }
    if (hash === target) return word;
  }
  return null;
}

async function bruteForce(
  target: string,
  algorithm: HashAlgorithm,
  charset: string,
  length: number,
  onProgress: () => void
): Promise<string | null> {
  const total = Math.pow(charset.length, length);
  const indices = new Array(length).fill(0);

  for (let i = 0; i < total; i++) {
    // Build string from indices
    let candidate = "";
    for (let j = 0; j < length; j++) {
      candidate += charset[indices[j]];
    }

    // Hash the candidate
    let hash: string;
    if (algorithm === "MD5") {
      hash = md5(candidate).toLowerCase();
    } else {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(candidate);
        const hashBuffer = await crypto.subtle.digest(algorithm, data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      } catch {
        return null;
      }
    }

    if (hash === target) return candidate;

    // Increment indices
    for (let j = length - 1; j >= 0; j--) {
      indices[j]++;
      if (indices[j] < charset.length) break;
      indices[j] = 0;
    }

    // Yield to UI every 1000 iterations
    if (i % 1000 === 0) {
      onProgress();
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  return null;
}

// MD5 implementation (compact, synchronous)
function md5(input: string): string {
  function toBytes(str: string): Uint8Array {
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      if (c < 128) bytes.push(c);
      else if (c < 2048) {
        bytes.push(192 | (c >> 6), 128 | (c & 63));
      } else {
        bytes.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
      }
    }
    return new Uint8Array(bytes);
  }

  function rotateLeft(x: number, c: number): number {
    return (x << c) | (x >>> (32 - c));
  }

  function addUnsigned(x: number, y: number): number {
    return (x + y) >>> 0;
  }

  function F(x: number, y: number, z: number): number { return (x & y) | (~x & z); }
  function G(x: number, y: number, z: number): number { return (x & z) | (y & ~z); }
  function H(x: number, y: number, z: number): number { return x ^ y ^ z; }
  function I(x: number, y: number, z: number): number { return y ^ (x | ~z); }

  function FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function binlMD5(x: number[], len: number): number[] {
    let a = 0x67452301;
    let b = 0xEFCDAB89;
    let c = 0x98BADCFE;
    let d = 0x10325476;

    for (let i = 0; i < x.length; i += 16) {
      const olda = a;
      const oldb = b;
      const oldc = c;
      const oldd = d;

      a = FF(a, b, c, d, x[i], 7, 0xD76AA478);
      d = FF(d, a, b, c, x[i + 1], 12, 0xE8C7B756);
      c = FF(c, d, a, b, x[i + 2], 17, 0x242070DB);
      b = FF(b, c, d, a, x[i + 3], 22, 0xC1BDCEEE);
      a = FF(a, b, c, d, x[i + 4], 7, 0xF57C0FAF);
      d = FF(d, a, b, c, x[i + 5], 12, 0x4787C62A);
      c = FF(c, d, a, b, x[i + 6], 17, 0xA8304613);
      b = FF(b, c, d, a, x[i + 7], 22, 0xFD469501);
      a = FF(a, b, c, d, x[i + 8], 7, 0x698098D8);
      d = FF(d, a, b, c, x[i + 9], 12, 0x8B44F7AF);
      c = FF(c, d, a, b, x[i + 10], 17, 0xFFFF5BB1);
      b = FF(b, c, d, a, x[i + 11], 22, 0x895CD7BE);
      a = FF(a, b, c, d, x[i + 12], 7, 0x6B901122);
      d = FF(d, a, b, c, x[i + 13], 12, 0xFD987193);
      c = FF(c, d, a, b, x[i + 14], 17, 0xA679438E);
      b = FF(b, c, d, a, x[i + 15], 22, 0x49B40821);

      a = GG(a, b, c, d, x[i + 1], 5, 0xF61E2562);
      d = GG(d, a, b, c, x[i + 6], 9, 0xC040B340);
      c = GG(c, d, a, b, x[i + 11], 14, 0x265E5A51);
      b = GG(b, c, d, a, x[i], 20, 0xE9B6C7AA);
      a = GG(a, b, c, d, x[i + 5], 5, 0xD62F105D);
      d = GG(d, a, b, c, x[i + 10], 9, 0x2441453);
      c = GG(c, d, a, b, x[i + 15], 14, 0xD8A1E681);
      b = GG(b, c, d, a, x[i + 4], 20, 0xE7D3FBC8);
      a = GG(a, b, c, d, x[i + 9], 5, 0x21E1CDE6);
      d = GG(d, a, b, c, x[i + 14], 9, 0xC33707D6);
      c = GG(c, d, a, b, x[i + 3], 14, 0xF4D50D87);
      b = GG(b, c, d, a, x[i + 8], 20, 0x455A14ED);
      a = GG(a, b, c, d, x[i + 13], 5, 0xA9E3E905);
      d = GG(d, a, b, c, x[i + 2], 9, 0xFCEFA3F8);
      c = GG(c, d, a, b, x[i + 7], 14, 0x676F02D9);
      b = GG(b, c, d, a, x[i + 12], 20, 0x8D2A4C8A);

      a = HH(a, b, c, d, x[i + 5], 4, 0xFFFA3942);
      d = HH(d, a, b, c, x[i + 8], 11, 0x8771F681);
      c = HH(c, d, a, b, x[i + 11], 16, 0x6D9D6122);
      b = HH(b, c, d, a, x[i + 14], 23, 0xFDE5380C);
      a = HH(a, b, c, d, x[i + 1], 4, 0xA4BEEA44);
      d = HH(d, a, b, c, x[i + 4], 11, 0x4BDECFA9);
      c = HH(c, d, a, b, x[i + 7], 16, 0xF6BB4B60);
      b = HH(b, c, d, a, x[i + 10], 23, 0xBEBFBC70);
      a = HH(a, b, c, d, x[i + 13], 4, 0x289B7EC6);
      d = HH(d, a, b, c, x[i], 11, 0xEAA127FA);
      c = HH(c, d, a, b, x[i + 3], 16, 0xD4EF3085);
      b = HH(b, c, d, a, x[i + 6], 23, 0x4881D05);
      a = HH(a, b, c, d, x[i + 9], 4, 0xD9D4D039);
      d = HH(d, a, b, c, x[i + 12], 11, 0xE6DB99E5);
      c = HH(c, d, a, b, x[i + 15], 16, 0x1FA27CF8);
      b = HH(b, c, d, a, x[i + 2], 23, 0xC4AC5665);

      a = II(a, b, c, d, x[i], 6, 0xF4292244);
      d = II(d, a, b, c, x[i + 7], 10, 0x432AFF97);
      c = II(c, d, a, b, x[i + 14], 15, 0xAB9423A7);
      b = II(b, c, d, a, x[i + 5], 21, 0xFC93A039);
      a = II(a, b, c, d, x[i + 12], 6, 0x655B59C3);
      d = II(d, a, b, c, x[i + 3], 10, 0x8F0CCC92);
      c = II(c, d, a, b, x[i + 10], 15, 0xFFEFF47D);
      b = II(b, c, d, a, x[i + 1], 21, 0x85845DD1);
      a = II(a, b, c, d, x[i + 8], 6, 0x6FA87E4F);
      d = II(d, a, b, c, x[i + 15], 10, 0xFE2CE6E0);
      c = II(c, d, a, b, x[i + 6], 15, 0xA3014314);
      b = II(b, c, d, a, x[i + 13], 21, 0x4E0811A1);
      a = II(a, b, c, d, x[i + 4], 6, 0xF7537E82);
      d = II(d, a, b, c, x[i + 11], 10, 0xBD3AF235);
      c = II(c, d, a, b, x[i + 2], 15, 0x2AD7D2BB);
      b = II(b, c, d, a, x[i + 9], 21, 0xEB86D391);

      a = addUnsigned(a, olda);
      b = addUnsigned(b, oldb);
      c = addUnsigned(c, oldc);
      d = addUnsigned(d, oldd);
    }
    return [a, b, c, d];
  }

  function binl2hex(binarray: number[]): string {
    const hexTab = "0123456789abcdef";
    let str = "";
    for (let i = 0; i < binarray.length * 4; i++) {
      str +=
        hexTab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xf) +
        hexTab.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0xf);
    }
    return str;
  }

  const bytes = toBytes(input);
  const len = bytes.length;

  // Create a properly-sized array filled with 0 (undefined values would
  // break the bitwise OR operations in the MD5 rounds).
  const numberOfWords = Math.ceil((len + 8) / 64) * 16;
  const x: number[] = new Array(numberOfWords).fill(0);

  // Fill in the bytes (little-endian)
  for (let i = 0; i < len; i++) {
    x[i >> 2] |= bytes[i] << ((i % 4) * 8);
  }

  // Add padding: 0x80 after the message, then the bit length at the end.
  x[len >> 2] |= 0x80 << ((len % 4) * 8);
  x[numberOfWords - 2] = len * 8;

  const result = binlMD5(x, len * 8);
  return binl2hex(result);
}
