'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, useSpring, useTransform } from 'motion/react'
import { createClient } from '@/lib/supabase/client'
import { Home, Calendar, Zap, Package, BookOpen, LogOut, Menu, X, Bell, MessageCircle, Target, Medal, Flame, Receipt, ScrollText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { staggerContainer, fadeUp } from '@/lib/motion-variants'
import { PushNotificationProvider } from '@/components/push-notification-provider'
import { InstallBanner } from '@/components/install-banner'
import type { ClubFeatures } from '@/lib/get-club-features'

function AnimatedNumber({ target }: { target: number }) {
  const spring = useSpring(0, { stiffness: 300, damping: 30 })
  const rounded = useTransform(spring, Math.round)

  useEffect(() => {
    spring.set(target)
  }, [target, spring])

  return <motion.span>{rounded}</motion.span>
}

const allNavItems = [
  { href: '/student', label: 'Inicio', icon: Home, exact: true, feature: null },
  { href: '/student/schedule', label: 'Mis Clases', icon: Calendar, exact: false, feature: null },
  { href: '/student/progress', label: 'Mi Progreso', icon: Target, exact: false, feature: 'enable_objectives' },
  { href: '/student/spots', label: 'Huecos', icon: Zap, exact: false, feature: 'enable_spots' },
  { href: '/student/intensivos', label: 'Intensivos', icon: Flame, exact: false, feature: 'enable_intensivos' },
  { href: '/student/tournaments', label: 'Torneos', icon: Medal, exact: false, feature: 'enable_tournaments' },
  { href: '/student/bag', label: 'Bolsa', icon: Package, exact: false, feature: 'enable_bag' },
  { href: '/student/materials', label: 'Material', icon: BookOpen, exact: false, feature: 'enable_materials' },
  { href: '/student/tarifas', label: 'Tarifas', icon: Receipt, exact: false, feature: null },
  { href: '/student/normas', label: 'Normas', icon: ScrollText, exact: false, feature: null },
  { href: '/student/notifications', label: 'Notificaciones', icon: Bell, exact: false, feature: null },
  { href: '/student/chat', label: 'Chat soporte', icon: MessageCircle, exact: false, feature: 'enable_chat' },
]

export function StudentShell({ children, userName, clubName, bagBalance, unreadCount = 0, features }: {
  children: React.ReactNode
  userName?: string
  clubName?: string
  bagBalance?: number
  unreadCount?: number
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
    : 'A'

  const navItems = allNavItems.filter(item => {
    if (!item.feature || !features) return true
    return features[item.feature as keyof ClubFeatures]
  })

  const showBag = !features || features.enable_bag

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
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-blue-500">
            <span className="text-sm font-bold text-white">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{userName ?? 'Alumno'}</p>
            <p className="truncate text-xs text-court-300">{clubName ?? 'ePadel School'}</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1 text-court-300 hover:bg-court-800 md:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        {showBag && bagBalance !== undefined && (
          <div className="mx-3 mt-3 overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 px-4 py-3">
            <p className="text-xs font-medium text-brand-100">Clases disponibles</p>
            <p className="mt-0.5 font-display text-3xl font-bold text-white">
              <AnimatedNumber target={bagBalance} />
            </p>
          </div>
        )}

        <motion.nav
          className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            const isNotif = href === '/student/notifications'
            return (
              <motion.div key={href} variants={fadeUp}>
                <Link href={href} onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    active ? 'bg-brand-500/15 text-brand-400' : 'text-court-200 hover:bg-court-800 hover:text-white'
                  )}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{label}</span>
                  {isNotif && unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
              </motion.div>
            )
          })}
        </motion.nav>

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
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-blue-500">
              <span className="text-xs font-bold text-white">P</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">{clubName ?? 'ePadel School'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/student/notifications" className="relative rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            {showBag && bagBalance !== undefined && (
              <span className="rounded-full bg-brand-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                {bagBalance} clase{bagBalance !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 pb-24 md:p-8 md:pb-8">{children}</main>
        <PushNotificationProvider />
        <InstallBanner />

        <nav className="fixed bottom-0 left-0 right-0 z-10 flex border-t border-gray-100 bg-white shadow-[0_-1px_4px_rgba(0,0,0,0.06)] md:hidden">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link key={href} href={href}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors',
                  active ? 'text-brand-500' : 'text-gray-400'
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
