import React, { type InputHTMLAttributes } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

/**
 * Convenience wrapper: label + input + optional error / hint.
 */
export function FormField({
  label,
  error,
  hint,
  id,
  name,
  className = '',
  ...inputProps
}: FormFieldProps) {
  const fieldId = id ?? name;

  return (
    <div className="w-full">
      <label
        htmlFor={fieldId}
        className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
        {inputProps.required && (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <input
        id={fieldId}
        name={name}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
        }
        className={[
          'input-base',
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-400'
            : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...inputProps}
      />

      {error && (
        <p
          id={`${fieldId}-error`}
          role="alert"
          className="mt-1 text-xs text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}

      {!error && hint && (
        <p
          id={`${fieldId}-hint`}
          className="mt-1 text-xs text-gray-500 dark:text-gray-400"
        >
          {hint}
        </p>
      )}
    </div>
  );
}
