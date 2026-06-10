'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Home, Calendar, BookOpen, MessageCircle, LogOut, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PushNotificationProvider } from '@/components/push-notification-provider'
import type { ClubFeatures } from '@/lib/get-club-features'

const allNavItems = [
  { href: '/coach', label: 'Inicio', icon: Home, exact: true, feature: null },
  { href: '/coach/classes', label: 'Mis Clases', icon: Calendar, exact: false, feature: null },
  { href: '/coach/materials', label: 'Material', icon: BookOpen, exact: false, feature: 'enable_materials' },
  { href: '/coach/chat', label: 'Chat soporte', icon: MessageCircle, exact: false, feature: 'enable_chat' },
]

export function CoachShell({ children, userName, clubName, features }: {
  children: React.ReactNode
  userName?: string
  clubName?: string
  features?: ClubFeatures
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
    : 'M'

  const navItems = allNavItems.filter(item => {
    if (!item.feature || !features) return true
    return features[item.feature as keyof ClubFeatures]
  })

  return (
    <div className="flex min-h-screen bg-court-50">
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 flex w-56 flex-col bg-court-900 transition-transform duration-200',
        'md:static md:translate-x-0 md:z-auto',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center gap-3 border-b border-court-700 px-4 py-[18px]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
            <span className="text-sm font-bold text-white">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{userName ?? 'Monitor'}</p>
            <p className="truncate text-xs text-court-300">{clubName ?? 'Padel School'}</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1 text-court-300 hover:bg-court-800 md:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-3 mt-3 rounded-xl bg-blue-500/15 px-4 py-2.5">
          <p className="text-xs font-semibold text-blue-400">Panel de Monitor</p>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  active ? 'bg-blue-500/15 text-blue-400' : 'text-court-200 hover:bg-court-800 hover:text-white'
                )}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-court-700 p-3">
          <button onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-court-300 transition hover:bg-court-800 hover:text-white">
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-14 items-center justify-between border-b border-gray-100 bg-white px-4 shadow-sm md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
              <span className="text-xs font-bold text-white">M</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">{clubName ?? 'Monitor'}</span>
          </div>
          <div className="w-10" />
        </header>

        <main className="flex-1 overflow-auto p-4 pb-24 md:p-8 md:pb-8">{children}</main>
        <PushNotificationProvider />

        <nav className="fixed bottom-0 left-0 right-0 z-10 flex border-t border-gray-100 bg-white shadow-[0_-1px_4px_rgba(0,0,0,0.06)] md:hidden">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link key={href} href={href}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors',
                  active ? 'text-blue-500' : 'text-gray-400'
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
