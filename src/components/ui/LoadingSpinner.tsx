/**
 * File: src/components/ui/LoadingSpinner.tsx
 * TypeScript Loading spinner component
 */

import React from "react";

type SpinnerSize = "xs" | "sm" | "md" | "lg";
type SpinnerColor =
  | "primary"
  | "secondary"
  | "accent"
  | "success"
  | "warning"
  | "error"
  | "info";

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  color?: SpinnerColor;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  color = "primary",
  className = "",
}) => {
  const sizeClasses: Record<SpinnerSize, string> = {
    xs: "loading-xs",
    sm: "loading-sm",
    md: "loading-md",
    lg: "loading-lg",
  };

  const colorClasses: Record<SpinnerColor, string> = {
    primary: "text-primary",
    secondary: "text-secondary",
    accent: "text-accent",
    success: "text-success",
    warning: "text-warning",
    error: "text-error",
    info: "text-info",
  };

  return (
    <span
      className={`loading loading-spinner ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
    />
  );
};

interface LoadingOverlayProps {
  loading: boolean;
  children: React.ReactNode;
  spinnerSize?: SpinnerSize;
  spinnerColor?: SpinnerColor;
  className?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  loading,
  children,
  spinnerSize = "lg",
  spinnerColor = "primary",
  className = "",
}) => {
  return (
    <div className={`relative ${className}`}>
      {children}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-base-100 bg-opacity-75 rounded-lg z-10">
          <LoadingSpinner size={spinnerSize} color={spinnerColor} />
        </div>
      )}
    </div>
  );
};

interface FullPageLoadingProps {
  size?: SpinnerSize;
  color?: SpinnerColor;
  message?: string;
}

export const FullPageLoading: React.FC<FullPageLoadingProps> = ({
  size = "lg",
  color = "primary",
  message,
}) => {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-base-100 z-50">
      <LoadingSpinner size={size} color={color} />
      {message && (
        <p className="mt-4 text-base-content opacity-60">{message}</p>
      )}
    </div>
  );
};
