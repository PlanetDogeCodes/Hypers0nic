import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = 40,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <img
      src="/icon.png"
      width={size}
      height={size}
      alt="Hypers0nic"
      className={cn("shrink-0", className)}
      style={{ borderRadius: "20%" }}
    />
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-mono font-bold tracking-tight", className)}>
      <span className="text-foreground">Hyper</span>
      <span className="text-primary">s0nic</span>
    </span>
  );
}
