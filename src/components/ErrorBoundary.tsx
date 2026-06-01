import React, { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "./ui/button";
import { Logo } from "./Logo";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    if (import.meta.env.VITE_SENTRY_DSN) {
      Sentry.captureException(error, { extra: { errorInfo } });
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-hero p-4">
          <Logo className="mb-8 h-10 w-auto" />
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="font-serif text-2xl font-semibold text-primary">Something went wrong</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We encountered an unexpected error. Our engineering team has been notified.
            </p>
            <div className="mt-4 rounded bg-muted/50 p-3 font-mono text-xs text-muted-foreground overflow-auto max-h-32">
              {this.state.error?.message || "Unknown error"}
            </div>
            <Button
              className="mt-6 w-full"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              <RefreshCcw className="mr-2 h-4 w-4" /> Reload application
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
