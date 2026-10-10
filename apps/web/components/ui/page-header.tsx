import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

// Cabecera de pantalla: título, explicación opcional y acciones. En pantallas
// de detalle, `back` añade el enlace para volver (la app no tiene botón atrás
// propio cuando está instalada).
export function PageHeader({
  title,
  description,
  actions,
  back,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  back?: { href: string; label: string }
  className?: string
}) {
  return (
    <header className={cn('space-y-3', className)}>
      {back && (
        <Link
          href={back.href}
          className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-control px-2 text-label text-ink-2 hover:bg-ink/5 hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-title text-ink sm:text-display">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-body text-ink-2">{description}</p>}
        </div>
        {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>}
      </div>
    </header>
  )
}
