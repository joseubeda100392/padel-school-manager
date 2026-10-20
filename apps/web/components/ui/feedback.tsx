import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-control bg-ink/[0.07]', className)} />
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      {icon && (
        <div aria-hidden className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ink/[0.05] text-ink-3 [&_svg]:h-6 [&_svg]:w-6">
          {icon}
        </div>
      )}
      <p className="text-heading text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-body text-ink-2">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Notice({
  tone = 'neutral',
  icon,
  children,
  action,
  className,
}: {
  tone?: 'neutral' | 'success' | 'warn' | 'danger'
  icon?: React.ReactNode
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  const tones = {
    neutral: 'border-line bg-surface-2 text-ink-2',
    success: 'border-accent/30 bg-accent-soft text-accent-ink',
    warn: 'border-warn-ink/20 bg-warn-soft text-warn-ink',
    danger: 'border-danger-ink/20 bg-danger-soft text-danger-ink',
  }
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-control border px-3.5 py-3 text-body', tones[tone], className)}
    >
      {icon && <span aria-hidden className="mt-0.5 shrink-0 [&_svg]:h-[18px] [&_svg]:w-[18px]">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
