"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: string;
}

/**
 * Error boundary that catches render errors in the proxy frame.
 * Instead of showing a blank white screen, it shows a recoverable error
 * message with a retry button.
 */
export class ProxyErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error: error.message || String(error),
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[hypers0nic] Proxy frame error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <div className="max-w-md text-center">
            <p className="mb-2 font-semibold text-foreground">
              Proxy frame encountered an error
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              {this.state.error}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="rounded border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary hover:bg-primary/20"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
