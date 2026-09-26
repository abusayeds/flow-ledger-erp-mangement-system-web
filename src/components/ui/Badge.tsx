/**
 * File: src/components/ui/Badge.tsx
 * TypeScript Badge component for status indicators
 */

import React from "react";

type BadgeColor =
  | "primary"
  | "secondary"
  | "accent"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "ghost";
type BadgeSize = "sm" | "md" | "lg";

interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
  size?: BadgeSize;
  outline?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  color = "primary",
  size = "md",
  outline = false,
  className = "",
}) => {
  const colorClasses: Record<BadgeColor, string> = {
    primary: "badge-primary",
    secondary: "badge-secondary",
    accent: "badge-accent",
    success: "badge-success",
    warning: "badge-warning",
    error: "badge-error",
    info: "badge-info",
    ghost: "badge-ghost",
  };

  const sizeClasses: Record<BadgeSize, string> = {
    sm: "badge-sm",
    md: "badge-md",
    lg: "badge-lg",
  };

  const classes = [
    "badge",
    colorClasses[color],
    sizeClasses[size],
    outline ? "badge-outline" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classes}>{children}</div>;
};

// Status-specific badge for common document statuses
type DocumentStatus =
  | "draft"
  | "sent"
  | "approved"
  | "pending"
  | "overdue"
  | "paid"
  | "canceled"
  | "void"
  | "on_hold"
  | "disputed"
  | "declined"
  | "closed"
  | "received"
  | "not_billed"
  | "unused";

interface StatusBadgeProps {
  status: DocumentStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className,
}) => {
  const statusConfig: Record<
    DocumentStatus,
    { color: BadgeColor; label: string }
  > = {
    draft: { color: "info", label: "Draft" },
    sent: { color: "info", label: "Sent" },
    approved: { color: "success", label: "Approved" },
    pending: { color: "warning", label: "Pending" },
    overdue: { color: "error", label: "Overdue" },
    paid: { color: "success", label: "Paid" },
    canceled: { color: "error", label: "Canceled" },
    void: { color: "ghost", label: "Void" },
    on_hold: { color: "warning", label: "On Hold" },
    disputed: { color: "error", label: "Disputed" },
    declined: { color: "error", label: "Declined" },
    closed: { color: "ghost", label: "Closed" },
    received: { color: "success", label: "Received" },
    not_billed: { color: "warning", label: "Not Billed" },
    unused: { color: "ghost", label: "Unused" },
  };

  const config = statusConfig[status];

  return (
    <Badge color={config.color} className={className}>
      {config.label}
    </Badge>
  );
};
