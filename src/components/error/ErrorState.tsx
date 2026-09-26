/**
 * File: src/components/error/ErrorState.tsx
 * Shared, friendly error UI. Used by both the render-time ErrorBoundary and the
 * router-level ErrorPage so every failure in the app looks the same instead of
 * dumping a raw stack trace / white screen.
 */

import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface ErrorStateProps {
  /** Big heading, e.g. "Something went wrong" or "404". */
  title?: string;
  /** One-line human explanation shown under the title. */
  message?: string;
  /** Optional technical detail (stack / message) — hidden behind a toggle. */
  detail?: string;
  /** Called by the "Try again" button. Omit to hide the button. */
  onRetry?: () => void;
  /** Label for the primary action. */
  retryLabel?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  message = "An unexpected error occurred. You can try again, or head back to the dashboard.",
  detail,
  onRetry,
  retryLabel = "Try again",
}) => {
  const [showDetail, setShowDetail] = React.useState(false);
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-white">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-red-500" strokeWidth={2} />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed">{message}</p>

        <div className="mt-6 flex items-center justify-center gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> {retryLabel}
            </button>
          )}
          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Home className="w-4 h-4" /> Go to Dashboard
          </a>
        </div>

        {detail && (
          <div className="mt-6 text-left">
            <button
              onClick={() => setShowDetail((s) => !s)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showDetail ? "Hide" : "Show"} technical details
            </button>
            {showDetail && (
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-gray-100 p-3 text-[11px] leading-relaxed text-gray-600">
                {detail}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorState;
