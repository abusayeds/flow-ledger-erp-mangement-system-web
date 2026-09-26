/**
 * File: src/components/ui/Textarea.tsx
 * TypeScript Textarea component for multi-line input
 */

import React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      className = "",
      containerClassName = "",
      disabled = false,
      required = false,
      id,
      name,
      rows = 4,
      ...props
    },
    ref,
  ) => {
    const inputId = id || name;

    const textareaClasses = [
      "textarea textarea-bordered w-full",
      error ? "textarea-error" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={`form-control w-full ${containerClassName}`}>
        {label && (
          <label className="label" htmlFor={inputId}>
            <span className="label-text">
              {label}
              {required && <span className="text-error ml-1">*</span>}
            </span>
          </label>
        )}

        <textarea
          ref={ref}
          id={inputId}
          name={name}
          disabled={disabled}
          rows={rows}
          className={textareaClasses}
          {...props}
        />

        {error && (
          <label className="label">
            <span className="label-text-alt text-error">{error}</span>
          </label>
        )}

        {!error && helperText && (
          <label className="label">
            <span className="label-text-alt">{helperText}</span>
          </label>
        )}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
