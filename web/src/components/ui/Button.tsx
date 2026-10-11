import type { ButtonHTMLAttributes } from 'react'

const variants = {
  primary: 'bg-primary text-primary-foreground border-primary hover:bg-primary/90 shadow-sm',
  secondary: 'bg-card text-foreground border-input hover:bg-accent shadow-xs',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  ghost: 'text-foreground border-transparent hover:bg-accent',
} as const

const sizes = {
  sm: 'h-8 sm:h-7 px-2.5 text-xs gap-1.5',
  md: 'h-9 sm:h-8 px-3 text-sm gap-2',
  lg: 'h-10 sm:h-9 px-3.5 text-base sm:text-sm gap-2',
} as const

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      data-slot="button"
      className={`relative inline-flex shrink-0 items-center justify-center font-medium rounded-[0.625rem] border whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...props}
    />
  )
}
