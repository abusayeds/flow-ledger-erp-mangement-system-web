/**
 * File: src/components/ui/Select.tsx
 * TypeScript Select/Dropdown component
 */

import React from "react";

interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  options?: SelectOption[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      className = "",
      containerClassName = "",
      disabled = false,
      required = false,
      placeholder = "Select an option",
      id,
      name,
      options = [],
      ...props
    },
    ref,
  ) => {
    const inputId = id || name;

    const selectClasses = [
      "keep-box ua-field select select-bordered w-full",
      error ? "select-error" : "",
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

        <select
          ref={ref}
          id={inputId}
          name={name}
          disabled={disabled}
          className={selectClasses}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>

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

Select.displayName = "Select";
