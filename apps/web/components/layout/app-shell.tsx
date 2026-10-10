'use client'

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Repeat } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { TabBar, isActivePath } from '@/components/ui/app-chrome'
import { ConfirmProvider } from '@/components/ui/confirm'
import type { AppNav } from './nav-config'

export type ShellLink = { href: string; label: string; external?: boolean }

type ShellContextValue = {
  nav: AppNav
  identity: { name: string; subtitle: string }
  roleSwitch?: ShellLink
  legalLinks: ShellLink[]
  logout: () => Promise<void>
}

const ShellContext = createContext<ShellContextValue | null>(null)

export function useShell() {
  const ctx = useContext(ShellContext)
  if (!ctx) throw new Error('useShell solo funciona dentro de <AppShell>')
  return ctx
}

export function AppShell({
  nav,
  clubName,
  identity,
  headerActions,
  sidebarExtra,
  roleSwitch,
  legalLinks = [],
  overlays,
  children,
}: {
  nav: AppNav
  clubName: string
  identity: { name: string; subtitle: string }
  headerActions?: ReactNode
  sidebarExtra?: ReactNode
  roleSwitch?: ShellLink
  legalLinks?: ShellLink[]
  overlays?: ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const mainRef = useRef<HTMLElement>(null)

  // <main> tiene su propio scroll y Next.js solo resetea el de window.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [pathname])

  async function logout() {
    await createClient().auth.signOut()
    window.location.replace('/login')
  }

  return (
    <ShellContext.Provider value={{ nav, identity, roleSwitch, legalLinks, logout }}>
      <ConfirmProvider>
        <div className="flex h-dvh overflow-hidden bg-canvas text-ink">
          <a
            href="#contenido"
            className="fixed left-3 top-3 z-50 -translate-y-20 rounded-control bg-surface px-4 py-2.5 text-label text-ink shadow-overlay focus:translate-y-0"
          >
            Saltar al contenido
          </a>
          <Sidebar nav={nav} clubName={clubName} identity={identity} extra={sidebarExtra} roleSwitch={roleSwitch} legalLinks={legalLinks} onLogout={logout} />

          <div className="flex min-w-0 flex-1 flex-col">
            <MobileHeader clubName={clubName} actions={headerActions} />
            <main
              ref={mainRef}
              id="contenido"
              tabIndex={-1}
              className="flex flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-[calc(var(--tabbar-h)+var(--safe-bottom)+1.5rem)] pt-5 md:px-8 md:pb-10 md:pt-8"
            >
              <div key={pathname} className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col animate-in fade-in-0 duration-150">
                {/* Hay dos versiones de los tipos de React en el monorepo; el
                    `children` de los layouts usa la global. */}
                {children as ReactNode}
              </div>
            </main>
          </div>

          <TabBar items={nav.tabs.map((t) => (t.href === nav.moreHref ? { ...t, exact: true } : t))} />
          {overlays}
        </div>
      </ConfirmProvider>
    </ShellContext.Provider>
  )
}

function MobileHeader({ clubName, actions }: { clubName: string; actions?: ReactNode }) {
  return (
    <header className="shrink-0 border-b border-line bg-surface md:hidden" style={{ paddingTop: 'var(--safe-top)' }}>
      <div className="flex h-14 items-center gap-2.5 pl-4 pr-2">
        <img src="/icon.svg" alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-lg" />
        <p className="min-w-0 flex-1 truncate text-heading text-ink">{clubName}</p>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
    </header>
  )
}

function Sidebar({
  nav,
  clubName,
  identity,
  extra,
  roleSwitch,
  legalLinks,
  onLogout,
}: {
  nav: AppNav
  clubName: string
  identity: { name: string; subtitle: string }
  extra?: ReactNode
  roleSwitch?: ShellLink
  legalLinks: ShellLink[]
  onLogout: () => Promise<void>
}) {
  const pathname = usePathname()

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col bg-chrome text-chrome-ink md:flex">
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <img src="/icon.svg" alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-lg" />
        <div className="min-w-0">
          <p className="truncate text-label font-semibold text-white">{clubName}</p>
          <p className="truncate text-meta text-chrome-ink-2">{identity.name}</p>
        </div>
      </div>

      {extra && <div className="px-3 pb-2">{extra}</div>}

      <nav aria-label="Menú principal" className="flex-1 overflow-y-auto px-3 pb-4">
        {nav.groups.map((group) => (
          <div key={group.title} className="pt-3">
            <p className="px-3 pb-1.5 text-[0.75rem] font-medium text-chrome-ink-2">{group.title}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon, exact, badge }) => {
                const active = isActivePath(pathname, href, exact)
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex h-9 items-center gap-3 rounded-control px-3 text-label transition-colors duration-150',
                        active ? 'bg-chrome-2 text-white' : 'text-chrome-ink/80 hover:bg-chrome-2/60 hover:text-white',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn('absolute -left-3 top-2 bottom-2 w-0.5 rounded-r-full bg-accent transition-opacity', active ? 'opacity-100' : 'opacity-0')}
                      />
                      <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-accent' : 'text-chrome-ink-2')} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      {!!badge && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-ink px-1.5 text-[0.6875rem] font-semibold text-white">
                          {badge > 9 ? '9+' : badge}
                          <span className="sr-only"> sin leer</span>
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-chrome-line p-3">
        {roleSwitch && (
          <Link href={roleSwitch.href} className="flex h-10 items-center gap-3 rounded-control px-3 text-label text-chrome-ink/80 hover:bg-chrome-2/60 hover:text-white">
            <Repeat className="h-[18px] w-[18px] text-chrome-ink-2" aria-hidden />
            {roleSwitch.label}
          </Link>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="flex h-10 w-full items-center gap-3 rounded-control px-3 text-label text-chrome-ink/80 hover:bg-chrome-2/60 hover:text-white"
        >
          <LogOut className="h-[18px] w-[18px] text-chrome-ink-2" aria-hidden />
          Cerrar sesión
        </button>
        {legalLinks.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 pt-2">
            {legalLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                target={l.external ? '_blank' : undefined}
                className="text-meta text-chrome-ink-2 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
