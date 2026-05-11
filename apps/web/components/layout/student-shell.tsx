'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Home, Calendar, Zap, Package, BookOpen, LogOut, Menu, X, Bell, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PushNotificationProvider } from '@/components/push-notification-provider'

const navItems = [
  { href: '/student', label: 'Inicio', icon: Home, exact: true },
  { href: '/student/schedule', label: 'Mis Clases', icon: Calendar, exact: false },
  { href: '/student/spots', label: 'Huecos', icon: Zap, exact: false },
  { href: '/student/bag', label: 'Bolsa', icon: Package, exact: false },
  { href: '/student/materials', label: 'Material', icon: BookOpen, exact: false },
  { href: '/student/notifications', label: 'Notificaciones', icon: Bell, exact: false },
  { href: '/student/chat', label: 'Chat soporte', icon: MessageCircle, exact: false },
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
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = userName
    ? userName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'A'

  return (
    <div className="flex min-h-screen bg-gray-50">
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 flex w-56 flex-col border-r border-gray-200 bg-white transition-transform duration-200',
        'md:static md:translate-x-0 md:z-auto',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center gap-3 border-b border-gray-200 p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-600">
            <span className="text-sm font-bold text-white">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{userName ?? 'Alumno'}</p>
            <p className="truncate text-xs text-gray-400">{clubName ?? 'Padel School'}</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 md:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        {bagBalance !== undefined && (
          <div className="mx-3 mt-3 rounded-lg bg-green-50 px-3 py-2.5">
            <p className="text-xs text-green-600">Clases disponibles</p>
            <p className="text-3xl font-bold text-green-700">{bagBalance}</p>
          </div>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            const isNotif = href === '/student/notifications'
            return (
              <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {isNotif && unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <button onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900">
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header móvil */}
        <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-green-600">
              <span className="text-xs font-bold text-white">P</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">{clubName ?? 'Padel School'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/student/notifications" className="relative rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            {bagBalance !== undefined && (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                {bagBalance} clase{bagBalance !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 pb-24 md:p-8 md:pb-8">{children}</main>
        <PushNotificationProvider />

        {/* Bottom nav móvil */}
        <nav className="fixed bottom-0 left-0 right-0 z-10 flex border-t border-gray-200 bg-white md:hidden">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link key={href} href={href}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors',
                  active ? 'text-green-600' : 'text-gray-400'
                )}>
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
