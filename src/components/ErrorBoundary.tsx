"use client";

import React, { Component, ErrorInfo } from "react";
import { Button } from "./ui/Button";
import { logger } from "@/lib/logger"; // <--- Import Logger

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{
    error: Error | null;
    resetError: () => void;
  }>;
  context?: string; // <--- Useful for knowing WHERE it crashed (e.g., "Feed", "Profile")
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // <--- Report to Logger instead of console
    logger.error(
      `React Error Boundary Caught: ${this.props.context || "Unknown"}`,
      error,
      {
        componentStack: errorInfo.componentStack,
      }
    );
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error}
            resetError={this.resetError}
          />
        );
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          resetError={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({
  error,
  resetError,
}: {
  error: Error | null;
  resetError: () => void;
}) {
  return (
    <div className="min-h-[400px] flex items-center justify-center px-4 py-12 bg-gray-50 rounded-lg border border-gray-100">
      <div className="text-center max-w-md">
        <div className="text-4xl mb-4">😵</div>
        <h3 className="text-lg font-bold text-jet-dark mb-2">
          Something went wrong
        </h3>
        <p className="text-sm text-gray-muted mb-6">
          The application encountered an unexpected error.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="primary" onClick={resetError} size="sm">
            Try Again
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            size="sm"
          >
            Reload Page
          </Button>
        </div>
      </div>
    </div>
  );
}
