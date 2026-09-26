/**
 * File: src/components/ui/Input.tsx
 * TypeScript Input component with label and error handling
 */

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      className = '',
      containerClassName = '',
      type = 'text',
      disabled = false,
      required = false,
      leftIcon,
      rightIcon,
      id,
      name,
      ...props
    },
    ref
  ) => {
    const inputId = id || name;
    
    const inputClasses = [
      'input input-bordered w-full',
      error ? 'input-error' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

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
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {leftIcon}
            </div>
          )}
          
          <input
            ref={ref}
            type={type}
            id={inputId}
            name={name}
            disabled={disabled}
            className={inputClasses}
            style={{
              paddingLeft: leftIcon ? '2.5rem' : undefined,
              paddingRight: rightIcon ? '2.5rem' : undefined,
            }}
            {...props}
          />
          
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>
        
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
  }
);

Input.displayName = 'Input';