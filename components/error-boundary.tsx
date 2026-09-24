"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  message?: string;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="mx-auto max-w-lg rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="mt-2 text-sm opacity-80">
            {this.state.message ?? "An unexpected error occurred."}
          </p>
          <button
            type="button"
            className="mt-4 rounded-md bg-red-900 px-3 py-1.5 text-sm text-white"
            onClick={() => this.setState({ hasError: false, message: undefined })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
