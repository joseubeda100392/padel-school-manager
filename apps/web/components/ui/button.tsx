import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  [
    'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium',
    'transition-[transform,background-color,border-color,color] duration-150 ease-out',
    'active:scale-[0.97] disabled:pointer-events-none',
    // Desactivado se ve neutro (no un verde desvaído que parece un fallo); cargando conserva su color.
    '[&:disabled:not([aria-busy])]:border-transparent [&:disabled:not([aria-busy])]:bg-ink/[0.07] [&:disabled:not([aria-busy])]:text-ink-3',
    'touch-manipulation',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-on hover:bg-accent-hover',
        secondary: 'border border-line-strong/60 bg-surface text-ink hover:bg-surface-2',
        ghost: 'text-ink-2 hover:bg-ink/5 hover:text-ink',
        danger: 'bg-danger-ink text-white hover:bg-danger-ink/90',
        'danger-ghost': 'text-danger-ink hover:bg-danger-soft',
        link: 'h-auto px-0 text-accent-ink underline-offset-4 hover:underline active:scale-100',
      },
      size: {
        sm: 'h-9 px-3 text-label',
        md: 'h-11 px-4 text-[0.9375rem]',
        lg: 'h-12 px-5 text-[0.9375rem]',
        icon: 'h-11 w-11',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, loading = false, disabled, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})
