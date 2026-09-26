/**
 * File: src/components/ui/EmptyState.tsx
 * TypeScript EmptyState component for no data scenarios
 */

import React from "react";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
    >
      {Icon && (
        <div className="mb-4 p-4 rounded-full bg-base-200">
          <Icon className="w-12 h-12 text-base-content opacity-40" />
        </div>
      )}

      <h3 className="text-lg font-semibold text-base-content mb-2">{title}</h3>

      {description && (
        <p className="text-sm text-base-content opacity-60 max-w-md mb-6">
          {description}
        </p>
      )}

      {(action || (actionLabel && onAction)) && (
        <div>
          {action || (
            <button className="btn btn-primary" onClick={onAction}>
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
