import { Wordmark } from "./logo";
import { Github, Zap, MessageCircle } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/30 px-4 py-3 text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 sm:flex-row">
        <p className="flex items-center gap-1.5">
          <Zap className="size-3 text-primary" />
          <Wordmark className="text-xs" />
          <span className="text-border/40">·</span>
          <span>Scramjet interception proxy</span>
        </p>
        <div className="flex items-center gap-3">
          <a
            href="https://discord.gg/FPhHyut3S7"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <MessageCircle className="size-3.5" />
            Join Discord
          </a>
          <a
            href="https://github.com/PlanetDogeCodes/Hypers0nic"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <Github className="size-3.5" />
            Hypers0nic
          </a>
        </div>
      </div>
    </footer>
  );
}
