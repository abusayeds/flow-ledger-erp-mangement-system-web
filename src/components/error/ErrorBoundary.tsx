/**
 * File: src/components/error/ErrorBoundary.tsx
 * App-wide React error boundary. Catches render/lifecycle errors anywhere in
 * the tree (which the router's errorElement does NOT catch) and shows the
 * friendly ErrorState instead of a blank/broken screen.
 */

import React from "react";
import { ErrorState } from "./ErrorState";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Central place to hook logging/telemetry later.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="min-h-screen">
          <ErrorState
            title="Something went wrong"
            message="The app hit an unexpected error. Try again, or return to the dashboard."
            detail={
              import.meta.env.DEV
                ? `${error.message}\n\n${error.stack ?? ""}`
                : undefined
            }
            onRetry={this.handleReset}
          />
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
