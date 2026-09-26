/**
 * File: src/components/ui/Button.tsx
 * TypeScript Button component with variants
 */

import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "ghost"
    | "danger"
    | "success";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = "",
      variant = "primary",
      size = "md",
      disabled = false,
      loading = false,
      fullWidth = false,
      type = "button",
      ...props
    },
    ref,
  ) => {
    // Base classes using DaisyUI
    const baseClass = "btn";

    // Variant classes
    const variantClasses: Record<string, string> = {
      primary: "btn-primary",
      secondary: "btn-secondary",
      outline: "btn-outline",
      ghost: "btn-ghost",
      danger: "btn-error",
      success: "btn-success",
    };

    // Size classes
    const sizeClasses: Record<string, string> = {
      sm: "btn-sm",
      md: "btn-md",
      lg: "btn-lg",
    };

    const classes = [
      baseClass,
      variantClasses[variant],
      sizeClasses[size],
      fullWidth ? "btn-block" : "",
      loading ? "loading" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={classes}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
