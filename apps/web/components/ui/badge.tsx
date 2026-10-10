import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-meta font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-ink/[0.06] text-ink-2',
        success: 'bg-accent-soft text-accent-ink',
        warn: 'bg-warn-soft text-warn-ink',
        danger: 'bg-danger-soft text-danger-ink',
        outline: 'border border-line text-ink-2',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

// Nivel del alumno: punto con el color que el club eligió para ese nivel y el
// nombre en tinta, así el color nunca es la única pista ni compite con la acción.
export function LevelTag({ name, color, className }: { name: string; color?: string | null; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-meta font-medium text-ink-2', className)}>
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full ring-1 ring-ink/10"
        style={{ backgroundColor: color ?? 'rgb(var(--ink-3))' }}
      />
      {name}
    </span>
  )
}
