'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TabItem = {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
  badge?: number
}

export function isActivePath(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

// Cabecera fija de app. Con `backHref` es una pantalla de detalle.
export function AppBar({
  title,
  backHref,
  backLabel = 'Volver',
  actions,
  className,
}: {
  title: React.ReactNode
  backHref?: string
  backLabel?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header
      className={cn('sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md md:hidden', className)}
      style={{ paddingTop: 'var(--safe-top)' }}
    >
      <div className="flex h-14 items-center gap-1 px-2">
        {backHref ? (
          <Link
            href={backHref}
            aria-label={backLabel}
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-ink/5"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
        ) : (
          <span className="w-2" />
        )}
        <h1 className="min-w-0 flex-1 truncate text-heading text-ink">{title}</h1>
        {actions && <div className="flex items-center">{actions}</div>}
      </div>
    </header>
  )
}

// Barra de pestañas inferior (solo móvil). Máximo 5 elementos.
export function TabBar({ items, ariaLabel = 'Navegación principal' }: { items: TabItem[]; ariaLabel?: string }) {
  const pathname = usePathname()
  return (
    <nav
      aria-label={ariaLabel}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <ul className="mx-auto grid h-tabbar max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ href, label, icon: Icon, exact, badge }) => {
          const active = isActivePath(pathname, href, exact)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors duration-150',
                  active ? 'text-accent-ink' : 'text-ink-3 hover:text-ink-2',
                )}
              >
                {/* Línea de pista sobre la pestaña activa */}
                <span
                  aria-hidden
                  className={cn('absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-accent transition-opacity duration-150', active ? 'opacity-100' : 'opacity-0')}
                />
                <span className="relative">
                  <Icon className="h-6 w-6" strokeWidth={active ? 2.1 : 1.75} aria-hidden />
                  {!!badge && (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-ink px-1 text-[0.625rem] font-semibold leading-none text-white">
                      {badge > 9 ? '9+' : badge}
                      <span className="sr-only"> pendientes</span>
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// Acción principal fija abajo, por encima de la barra de pestañas en móvil.
export function StickyAction({ children, withTabBar = true }: { children: React.ReactNode; withTabBar?: boolean }) {
  return (
    <div
      className="fixed inset-x-0 z-20 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md md:static md:mt-6 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
      style={{ bottom: withTabBar ? 'calc(var(--tabbar-h) + var(--safe-bottom))' : 'var(--safe-bottom)' }}
    >
      <div className="mx-auto flex max-w-lg gap-2 md:mx-0 md:max-w-none md:justify-end">{children}</div>
    </div>
  )
}
