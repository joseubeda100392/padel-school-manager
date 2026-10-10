import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// Lista con separadores finos (no una tarjeta por elemento).
export function List({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn('divide-y divide-line', className)} {...props} />
}

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  href,
  onClick,
  className,
}: {
  leading?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  trailing?: React.ReactNode
  href?: string
  onClick?: () => void
  className?: string
}) {
  const interactive = !!(href || onClick)
  const content = (
    <>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.9375rem] font-medium text-ink">{title}</div>
        {subtitle && <div className="mt-0.5 text-meta text-ink-3">{subtitle}</div>}
      </div>
      {trailing && <div className="shrink-0 text-right">{trailing}</div>}
      {href && <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink-3" />}
    </>
  )
  const rowClass = cn(
    'flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left',
    interactive && 'transition-colors duration-150 hover:bg-ink/[0.03] active:bg-ink/[0.05]',
    className,
  )

  return (
    <li>
      {href ? (
        <Link href={href} className={rowClass}>{content}</Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={rowClass}>{content}</button>
      ) : (
        <div className={rowClass}>{content}</div>
      )}
    </li>
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span
      aria-hidden
      className={cn('inline-flex h-10 w-10 items-center justify-center rounded-full bg-chrome text-label text-chrome-ink', className)}
    >
      {initials || '?'}
    </span>
  )
}

// Fecha compacta para listas de clases: día de la semana encima del número.
export function DateTile({ weekday, day, muted = false }: { weekday: string; day: number | string; muted?: boolean }) {
  return (
    <span
      className={cn(
        'flex h-11 w-11 flex-col items-center justify-center rounded-control border leading-none',
        muted ? 'border-line text-ink-3' : 'border-line-strong/40 bg-surface text-ink',
      )}
    >
      <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-ink-3">{weekday}</span>
      <span className="mt-0.5 font-display text-heading tabular-nums">{day}</span>
    </span>
  )
}

export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-meta text-ink-3">{label}</p>
      <p className="mt-1 font-display text-title tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-meta text-ink-3">{hint}</p>}
    </div>
  )
}
