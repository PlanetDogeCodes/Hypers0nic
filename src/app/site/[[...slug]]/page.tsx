import { AppShell } from "@/components/hypers0nic/app-shell";
import { ErrorBoundary } from "@/components/hypers0nic/error-boundary";

// Catch-all route for /site/<domain> permalinks.
// This renders the same app shell as the home page. The store's hydrate()
// detects the /site/ prefix in the URL and auto-navigates to the target.
export default function SitePage() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
