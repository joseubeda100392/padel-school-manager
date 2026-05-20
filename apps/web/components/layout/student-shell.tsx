'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Home, Calendar, Package, BookOpen, LogOut, Menu, X, Bell, MessageCircle, Zap, CreditCard, MoreHorizontal, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PushNotificationProvider } from '@/components/push-notification-provider'

// Bottom nav: max 5 items (skill rule: bottom-nav-limit)
const primaryNav = [
  { href: '/student', label: 'Inicio', icon: Home, exact: true },
  { href: '/student/schedule', label: 'Clases', icon: Calendar, exact: false },
  { href: '/student/fees', label: 'Cuotas', icon: CreditCard, exact: false },
  { href: '/student/spots', label: 'Sesiones', icon: Zap, exact: false },
]

const moreNav = [
  { href: '/student/bag', label: 'Bolsa de clases', icon: Package },
  { href: '/student/materials', label: 'Material didáctico', icon: BookOpen },
  { href: '/student/notifications', label: 'Notificaciones', icon: Bell },
  { href: '/student/chat', label: 'Chat de soporte', icon: MessageCircle },
]

// All nav for sidebar (shows everything)
const allNavItems = [
  ...primaryNav,
  ...moreNav.map(i => ({ ...i, exact: false })),
]

export function StudentShell({ children, userName, clubName, bagBalance, unreadCount = 0 }: {
  children: React.ReactNode
  userName?: string
  clubName?: string
  bagBalance?: number
  unreadCount?: number
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [moreSheetOpen, setMoreSheetOpen] = useState(false)
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = userName
    ? userName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'A'

  const isMoreActive = moreNav.some(item => pathname.startsWith(item.href))

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          style={{ background: 'rgba(11,28,48,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* More sheet overlay */}
      {moreSheetOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(11,28,48,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={() => setMoreSheetOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 flex w-[272px] flex-col border-r transition-transform duration-[var(--duration-slow)]',
        'md:static md:translate-x-0 md:z-auto',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )} style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)' }}>

        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-7">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--color-primary)' }}
            >
              <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7.05 13.406l3.534 3.536-1.413 1.414-1.06-1.063-1.062 1.063-1.413-1.415 1.06-1.06-1.056-1.057 1.41-1.418zm9.9-9.9l1.414 1.414-.354.354 1.413 1.413-1.06 1.06-1.413-1.41-.355.352-1.414-1.413zm-7.07.706a7 7 0 0 1 9.9 9.9l-9.9-9.9zm7.78 8.486l-1.413 1.415-4.244-4.244 1.413-1.414z" />
              </svg>
            </div>
            <div>
              <p className="text-[15px] font-bold leading-tight tracking-tight font-heading" style={{ color: 'var(--color-on-surface)' }}>
                {clubName ?? 'Padel Pro'}
              </p>
              <p className="text-[10px] font-semibold tracking-[0.1em] uppercase" style={{ color: 'var(--color-placeholder)' }}>Mi área</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 transition-colors hover:bg-gray-100 md:hidden"
            style={{ color: 'var(--color-placeholder)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Bag balance pill */}
        {bagBalance !== undefined && (
          <div className="mx-4 mb-4 rounded-2xl px-4 py-3.5" style={{ background: 'var(--color-primary-light)', border: '1px solid rgba(0,107,44,0.15)' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--color-primary)' }}>Clases disponibles</p>
            <p className="mt-1 text-[38px] font-extrabold leading-none font-heading" style={{ color: bagBalance > 0 ? 'var(--color-primary)' : 'var(--color-outline)' }}>
              {bagBalance}
            </p>
            <Link
              href="/student/bag"
              className="mt-1.5 block text-[12px] font-bold transition-opacity hover:opacity-70"
              style={{ color: 'var(--color-primary)' }}
            >
              {bagBalance === 0 ? 'Comprar bono →' : 'Ver historial →'}
            </Link>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
          {allNavItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            const isNotif = href === '/student/notifications'
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-[var(--duration-base)] group',
                  active
                    ? 'text-[var(--color-primary)]'
                    : 'hover:bg-gray-50'
                )}
                style={active
                  ? { background: 'var(--color-primary-light)', color: 'var(--color-primary)' }
                  : { color: 'var(--color-on-surface-variant)' }
                }
              >
                {active && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                    style={{ background: 'var(--color-primary)' }}
                  />
                )}
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {isNotif && unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-6 pt-2" style={{ borderTop: '1px solid var(--color-outline-variant)' }}>
          <div className="pt-3">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-[var(--duration-base)] hover:bg-red-50"
              style={{ color: 'var(--color-on-surface-variant)' }}
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">

        {/* Mobile top bar */}
        <header
          className="flex h-14 items-center justify-between px-4 md:hidden"
          style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--color-outline-variant)',
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-xl p-2 transition-colors hover:bg-gray-100"
            style={{ color: 'var(--color-on-surface-variant)' }}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: 'var(--color-primary)' }}
            >
              <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7.05 13.406l3.534 3.536-1.413 1.414-1.06-1.063-1.062 1.063-1.413-1.415 1.06-1.06-1.056-1.057 1.41-1.418zm9.9-9.9l1.414 1.414-.354.354 1.413 1.413-1.06 1.06-1.413-1.41-.355.352-1.414-1.413zm-7.07.706a7 7 0 0 1 9.9 9.9l-9.9-9.9zm7.78 8.486l-1.413 1.415-4.244-4.244 1.413-1.414z" />
              </svg>
            </div>
            <span className="text-[14px] font-bold font-heading" style={{ color: 'var(--color-on-surface)' }}>
              {clubName ?? 'Padel Pro'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href="/student/notifications"
              className="relative rounded-xl p-2 transition-colors hover:bg-gray-100"
              style={{ color: 'var(--color-on-surface-variant)' }}
              aria-label="Notificaciones"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            {bagBalance !== undefined && bagBalance > 0 && (
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
              >
                {bagBalance}
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 pb-24 md:p-6 md:pb-8 w-full">
          {children}
        </main>
        <PushNotificationProvider />

        {/* Bottom nav — max 5 items */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-10 flex md:hidden"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(16px)',
            borderTop: '1px solid var(--color-outline-variant)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {primaryNav.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-1 flex-col items-center justify-center gap-[3px] py-2.5 text-[10px] font-semibold transition-colors duration-[var(--duration-base)]"
                style={{ color: active ? 'var(--color-primary)' : 'var(--color-placeholder)' }}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-lg transition-all duration-[var(--duration-base)]"
                  style={active ? { background: 'var(--color-primary-light)' } : {}}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                {label}
              </Link>
            )
          })}

          {/* Más button */}
          <button
            onClick={() => setMoreSheetOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-[3px] py-2.5 text-[10px] font-semibold transition-colors duration-[var(--duration-base)]"
            style={{ color: isMoreActive ? 'var(--color-primary)' : 'var(--color-placeholder)' }}
            aria-label="Más opciones"
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-lg transition-all duration-[var(--duration-base)]"
              style={isMoreActive ? { background: 'var(--color-primary-light)' } : {}}
            >
              <MoreHorizontal className="h-[18px] w-[18px]" />
            </span>
            Más
          </button>
        </nav>
      </div>

      {/* "Más" bottom sheet */}
      {moreSheetOpen && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 md:hidden rounded-t-2xl overflow-hidden"
          style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-lg)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-2" style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
            <p className="text-[14px] font-bold font-heading" style={{ color: 'var(--color-on-surface)' }}>Más opciones</p>
            <button
              onClick={() => setMoreSheetOpen(false)}
              className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors"
              style={{ color: 'var(--color-placeholder)' }}
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-3 space-y-0.5">
            {moreNav.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href)
              const isNotif = href === '/student/notifications'
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreSheetOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-semibold transition-all duration-[var(--duration-base)]"
                  style={active
                    ? { background: 'var(--color-primary-light)', color: 'var(--color-primary)' }
                    : { color: 'var(--color-on-surface)', background: 'transparent' }
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1">{label}</span>
                  {isNotif && unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 opacity-30" />
                </Link>
              )
            })}
          </div>
          <div className="px-3 pb-3 pt-1" style={{ borderTop: '1px solid var(--color-outline-variant)' }}>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-semibold transition-colors hover:bg-red-50"
              style={{ color: '#dc2626' }}
            >
              <LogOut className="h-5 w-5" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

