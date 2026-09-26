/**
 * File: src/components/ui/Card.tsx
 * TypeScript Card component for content containers
 */

import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  bordered?: boolean;
  compact?: boolean;
  side?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  bordered = true,
  compact = false,
  side = false,
}) => {
  const classes = [
    "card bg-base-100 shadow-xl",
    bordered ? "border border-base-300" : "",
    compact ? "card-compact" : "",
    side ? "card-side" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classes}>{children}</div>;
};

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const CardBody: React.FC<CardBodyProps> = ({
  children,
  className = "",
}) => {
  return <div className={`card-body ${className}`}>{children}</div>;
};

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const CardTitle: React.FC<CardTitleProps> = ({
  children,
  className = "",
}) => {
  return <h2 className={`card-title ${className}`}>{children}</h2>;
};

interface CardActionsProps {
  children: React.ReactNode;
  className?: string;
  justify?: "start" | "center" | "end";
}

export const CardActions: React.FC<CardActionsProps> = ({
  children,
  className = "",
  justify = "end",
}) => {
  const justifyClasses = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
  };

  return (
    <div className={`card-actions ${justifyClasses[justify]} ${className}`}>
      {children}
    </div>
  );
};
