import { cn } from '@/lib/utils'

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-card border border-line bg-surface shadow-card', className)} {...props} />
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-2 px-4 pt-4 sm:px-5 sm:pt-5', className)}>
      <div className="min-w-0">
        <h2 className="text-heading text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-meta text-ink-3">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />
}

// Separador de sección con título: las "líneas de pista" del sistema.
export function SectionTitle({
  children,
  action,
  className,
}: {
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-end justify-between gap-2 border-b border-line pb-2', className)}>
      <h2 className="text-label text-ink-2">{children}</h2>
      {action}
    </div>
  )
}
