"use client";

import { useState, useMemo } from "react";
import { X, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export function MarkdownPreviewer({ onClose }: { onClose?: () => void }) {
  const [input, setInput] = useState(
    "# Hello Hypers0nic\n\nType **markdown** here and see the *preview* below.\n\n- List item 1\n- List item 2\n\n[Link](https://example.com)\n\n```\ncode block\n```"
  );
  const [copied, setCopied] = useState(false);

  const html = useMemo(() => renderMarkdown(input), [input]);

  const copy = () => {
    navigator.clipboard.writeText(input).then(() => {
      setCopied(true);
      toast.success("Markdown copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => toast.error("Failed to copy"));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Markdown → HTML Preview</span>
        <div className="ml-auto flex gap-1">
          <button
            onClick={copy}
            className="flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            Copy
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="size-3" />
              Close
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">Input</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="h-64 w-full resize-none rounded border border-border/40 bg-card/50 p-3 font-mono text-xs text-foreground outline-none focus:border-primary"
            spellCheck={false}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">Preview</label>
          <div
            className="h-64 w-full overflow-y-auto rounded border border-border/40 bg-card/50 p-3 text-xs text-foreground prose-sm"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderMarkdown(md: string): string {
  let html = escapeHtml(md);

  // Code blocks (```...```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _lang, code) => {
    return `<pre class="rounded bg-background/60 p-2 overflow-x-auto text-[11px] font-mono text-muted-foreground"><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="rounded bg-background/60 px-1 py-0.5 text-[11px] font-mono text-primary">$1</code>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mt-2 mb-1">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-base font-semibold mt-2 mb-1">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold mt-2 mb-1">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer" class="text-primary underline">$1</a>'
  );

  // Lists
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
  html = html.replace(/(<li[^>]*>.*?<\/li>\n?)+/g, (m) => `<ul class="space-y-0.5 my-1">${m}</ul>`);

  // Line breaks
  html = html.replace(/\n/g, "<br/>");

  return html;
}
