/**
 * File: src/components/error/ErrorPage.tsx
 * Router-level error element (errorElement). React Router renders this when a
 * route throws — loader/action failures, render errors within a route, and
 * unmatched URLs (404). Distinguishes HTTP-style route errors (404 etc.) from
 * thrown JS errors and shows the shared ErrorState for both.
 */

import React from "react";
import { useRouteError, isRouteErrorResponse } from "react-router-dom";
import { ErrorState } from "./ErrorState";

export const ErrorPage: React.FC = () => {
  const error = useRouteError();

  let title = "Something went wrong";
  let message =
    "An unexpected error occurred. You can try again, or head back to the dashboard.";
  let detail: string | undefined;
  let is404 = false;

  const notFound = () => {
    is404 = true;
    title = "404";
    message =
      "We couldn't find the page you're looking for. It may have been moved or removed.";
  };

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      notFound();
    } else {
      title = `${error.status}`;
      message = error.statusText || message;
    }
    detail = typeof error.data === "string" ? error.data : undefined;
  } else if (error instanceof Error) {
    detail = import.meta.env.DEV
      ? `${error.message}\n\n${error.stack ?? ""}`
      : undefined;
  } else if (!error) {
    // Rendered as the catch-all `element` for unmatched URLs (no thrown error).
    notFound();
  }

  return (
    <ErrorState
      title={title}
      message={message}
      detail={detail}
      onRetry={is404 ? undefined : () => window.location.reload()}
      retryLabel="Reload page"
    />
  );
};

export default ErrorPage;
