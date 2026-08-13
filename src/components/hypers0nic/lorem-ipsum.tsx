"use client";

import { useState } from "react";
import { X, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
  "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
  "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud",
  "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo",
  "consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate",
  "velit", "esse", "cillum", "eu", "fugiat", "nulla", "pariatur", "excepteur",
  "sint", "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui",
  "officia", "deserunt", "mollit", "anim", "id", "est", "laborum", "at",
  "vero", "eos", "accusamus", "iusto", "odio", "dignissimos", "ducimus",
  "blanditiis", "praesentium", "voluptatum", "deleniti", "atque", "corrupti",
];

export function LoremIpsumGenerator({ onClose }: { onClose?: () => void }) {
  const [paragraphs, setParagraphs] = useState(3);
  const [wordsPerParagraph, setWordsPerParagraph] = useState(50);
  const [startWithLorem, setStartWithLorem] = useState(true);
  const [output, setOutput] = useState("");

  const generate = () => {
    const result: string[] = [];
    for (let p = 0; p < paragraphs; p++) {
      const words: string[] = [];
      const count = wordsPerParagraph;
      for (let i = 0; i < count; i++) {
        words.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
      }
      let text = words.join(" ");
      if (p === 0 && startWithLorem) {
        text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. " + text;
      }
      // Capitalize first letter and add period
      text = text.charAt(0).toUpperCase() + text.slice(1);
      if (!text.endsWith(".")) text += ".";
      // Add random punctuation
      text = text.replace(/(\w+)\s/g, (match, word) => {
        if (Math.random() < 0.15) return word + ". ";
        if (Math.random() < 0.08) return word + ", ";
        return match;
      });
      result.push(text);
    }
    setOutput(result.join("\n\n"));
  };

  const copy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
      toast.success("Copied to clipboard");
    }).catch(() => toast.error("Failed to copy"));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Lorem Ipsum Generator</span>
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

      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Paragraphs</span>
          <input
            type="number"
            min="1"
            max="20"
            value={paragraphs}
            onChange={(e) => setParagraphs(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            className="rounded border border-border/40 bg-card/50 px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Words/para</span>
          <input
            type="number"
            min="10"
            max="200"
            value={wordsPerParagraph}
            onChange={(e) => setWordsPerParagraph(Math.max(10, Math.min(200, parseInt(e.target.value) || 50)))}
            className="rounded border border-border/40 bg-card/50 px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="flex items-end gap-1.5 pb-1">
          <input
            type="checkbox"
            checked={startWithLorem}
            onChange={(e) => setStartWithLorem(e.target.checked)}
            className="size-3 accent-primary"
          />
          <span className="text-[10px] text-muted-foreground">Start with "Lorem ipsum"</span>
        </label>
      </div>

      <div className="flex gap-2">
        <button
          onClick={generate}
          className="flex items-center gap-1.5 rounded border border-primary bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20"
        >
          <RefreshCw className="size-3" />
          Generate
        </button>
        {output && (
          <button
            onClick={copy}
            className="flex items-center gap-1.5 rounded border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Copy className="size-3" />
            Copy
          </button>
        )}
      </div>

      {output && (
        <div className="max-h-48 overflow-y-auto rounded border border-border/40 bg-card/50 p-3 text-xs text-foreground">
          {output.split("\n\n").map((para, i) => (
            <p key={i} className={i > 0 ? "mt-2" : ""}>{para}</p>
          ))}
        </div>
      )}
    </div>
  );
}
