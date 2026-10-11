import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  /**
   * Shows a red asterisk after the label. Opt-in rather than driven by
   * `required`, so existing forms keep their exact label text.
   */
  requiredMarker?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, requiredMarker, id, className = '', ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="overflow-hidden">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-foreground dark:text-foreground mb-1">
            {label}{requiredMarker && <span className="text-red-500" aria-hidden="true"> *</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`block w-full min-w-0 rounded-[0.625rem] border px-3 py-1.5 text-sm shadow-xs bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring dark:bg-card dark:border-input dark:text-foreground dark:placeholder-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed ${
            error ? 'border-red-300 text-red-900' : 'border-input text-foreground dark:border-input dark:text-foreground'
          } ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'
