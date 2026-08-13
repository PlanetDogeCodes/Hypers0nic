import { AppShell } from "@/components/hypers0nic/app-shell";
import { ErrorBoundary } from "@/components/hypers0nic/error-boundary";

export default function Home() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
