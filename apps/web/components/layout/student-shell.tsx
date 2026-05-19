'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Home, Calendar, Package, BookOpen, LogOut, Menu, X, Bell, MessageCircle, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PushNotificationProvider } from '@/components/push-notification-provider'

const navItems = [
  { href: '/student', label: 'Inicio', icon: Home, exact: true },
  { href: '/student/schedule', label: 'Mis Clases', icon: Calendar, exact: false },
  { href: '/student/spots', label: 'Sesiones', icon: Zap, exact: false },
  { href: '/student/bag', label: 'Bolsa', icon: Package, exact: false },
  { href: '/student/materials', label: 'Material', icon: BookOpen, exact: false },
  { href: '/student/notifications', label: 'Notifs', icon: Bell, exact: false },
  { href: '/student/chat', label: 'Chat', icon: MessageCircle, exact: false },
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
    <div className="flex min-h-screen bg-[#f8f9ff]">
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 flex w-[264px] flex-col border-r border-gray-200/60 bg-white/70 backdrop-blur-xl transition-transform duration-200',
        'md:static md:translate-x-0 md:z-auto',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between px-6 py-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#006b2c]">
                <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7.05 13.406l3.534 3.536-1.413 1.414-1.06-1.063-1.062 1.063-1.413-1.415 1.06-1.06-1.056-1.057 1.41-1.418zm9.9-9.9l1.414 1.414-.354.354 1.413 1.413-1.06 1.06-1.413-1.41-.355.352-1.414-1.413zm-7.07.706a7 7 0 0 1 9.9 9.9l-9.9-9.9zm7.78 8.486l-1.413 1.415-4.244-4.244 1.413-1.414z" />
                </svg>
              </div>
              <span className="text-[17px] font-extrabold text-gray-900 tracking-tight">Padel Pro</span>
            </div>
            <p className="text-[10px] font-bold tracking-[0.12em] text-gray-400 uppercase pl-10">Mi área</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 md:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        {bagBalance !== undefined && (
          <div className="mx-4 mb-4 rounded-2xl border border-[#006b2c]/20 bg-[#006b2c]/5 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#006b2c]/70">Clases disponibles</p>
            <p className={`text-4xl font-extrabold mt-1 ${bagBalance > 0 ? 'text-[#006b2c]' : 'text-gray-300'}`}>{bagBalance}</p>
            <Link href="/student/bag" className="mt-1 text-[12px] font-bold text-[#006b2c] hover:underline block">
              {bagBalance === 0 ? 'Comprar bono →' : 'Ver historial →'}
            </Link>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            const isNotif = href === '/student/notifications'
            return (
              <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all group',
                  active ? 'bg-[#006b2c]/10 text-[#006b2c]' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                )}>
                <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
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

        <div className="border-t border-gray-100 px-4 pb-6 pt-3">
          <button onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all">
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-gray-200/60 bg-white/80 backdrop-blur-md px-4 md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#006b2c]">
              <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7.05 13.406l3.534 3.536-1.413 1.414-1.06-1.063-1.062 1.063-1.413-1.415 1.06-1.06-1.056-1.057 1.41-1.418zm9.9-9.9l1.414 1.414-.354.354 1.413 1.413-1.06 1.06-1.413-1.41-.355.352-1.414-1.413zm-7.07.706a7 7 0 0 1 9.9 9.9l-9.9-9.9zm7.78 8.486l-1.413 1.415-4.244-4.244 1.413-1.414z" />
              </svg>
            </div>
            <span className="text-[14px] font-bold text-gray-900">{clubName ?? 'Padel Pro'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/student/notifications" className="relative rounded-xl p-2 text-gray-500 hover:bg-gray-100">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            {bagBalance !== undefined && bagBalance > 0 && (
              <span className="rounded-full bg-[#006b2c]/10 px-2.5 py-1 text-[11px] font-bold text-[#006b2c]">
                {bagBalance} clase{bagBalance !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 pb-24 md:p-6 md:pb-8 w-full">{children}</main>
        <PushNotificationProvider />

        <nav className="fixed bottom-0 left-0 right-0 z-10 flex border-t border-gray-200/60 bg-white/90 backdrop-blur-md md:hidden">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link key={href} href={href}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors',
                  active ? 'text-[#006b2c]' : 'text-gray-400'
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
