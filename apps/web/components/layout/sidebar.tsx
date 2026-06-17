'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  CreditCard,
  MessageSquare,
  BookOpen,
  BarChart3,
  Settings,
  Trophy,
  Medal,
  Building2,
  Bell,
  X,
  LogOut,
} from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { staggerContainer, fadeUp } from '@/lib/motion-variants'
import type { ClubFeatures } from '@/lib/get-club-features'

const baseNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, feature: null },
  { href: '/dashboard/students', label: 'Usuarios', icon: Users, feature: null },
  { href: '/dashboard/levels', label: 'Niveles', icon: Trophy, feature: null },
  { href: '/dashboard/schedule', label: 'Clases', icon: CalendarDays, feature: null },
  { href: '/dashboard/tournaments', label: 'Torneos', icon: Medal, feature: 'enable_tournaments' },
  { href: '/dashboard/payments', label: 'Pagos', icon: CreditCard, feature: 'enable_payments' },
  { href: '/dashboard/chat', label: 'Chat Soporte', icon: MessageSquare, feature: 'enable_chat' },
  { href: '/dashboard/materials', label: 'Materiales', icon: BookOpen, feature: 'enable_materials' },
  { href: '/dashboard/notifications', label: 'Notificaciones', icon: Bell, feature: null },
  { href: '/dashboard/settings', label: 'Configuración', icon: Settings, feature: null },
]

const superAdminItems = [
  { href: '/dashboard/clubs', label: 'Clubes', icon: Building2 },
]

export function Sidebar({ clubName, role, userName, features, saActiveClub, onClose }: {
  clubName?: string
  role?: string
  userName?: string
  features?: ClubFeatures
  saActiveClub?: string
  onClose?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const isSuperAdmin = role === 'super_admin'
  const initials = userName
    ? userName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'P'

  const navItems = baseNavItems.filter(item => {
    if (!item.feature || !features) return true
    return features[item.feature as keyof ClubFeatures]
  })

  async function handleExitClub() {
    await fetch('/api/superadmin/active-club', { method: 'DELETE' })
    router.push('/dashboard/clubs')
    router.refresh()
  }

  return (
    <aside className="flex h-screen w-64 flex-col bg-court-900">
      <div className="flex items-center gap-3 border-b border-court-700 px-5 py-[18px]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-blue-500">
          <span className="text-sm font-bold text-white">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {isSuperAdmin ? 'Super Admin' : (clubName ?? 'Padel Manager')}
          </p>
          <p className="truncate text-xs text-court-300">
            {userName ?? (isSuperAdmin ? 'Todos los clubes' : 'Panel admin')}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-auto rounded-lg p-1 text-court-300 hover:bg-court-800 md:hidden">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Banner club activo (solo super admin gestionando un club) */}
      {isSuperAdmin && saActiveClub && clubName && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-400">Gestionando</p>
            <p className="truncate text-sm font-semibold text-white">{clubName}</p>
          </div>
          <button
            onClick={handleExitClub}
            title="Salir del club"
            className="shrink-0 rounded-lg p-1 text-brand-400 transition hover:bg-brand-500/20 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}

      <motion.nav
        className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {isSuperAdmin && (
          <>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-court-400">
              Super Admin
            </p>
            {superAdminItems.map(({ href, label, icon: Icon }) => (
              <motion.div key={href} variants={fadeUp}>
                <Link
                  href={href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    pathname.startsWith(href)
                      ? 'bg-brand-500/15 text-brand-400'
                      : 'text-court-200 hover:bg-court-800 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              </motion.div>
            ))}
            <div className="my-3 border-t border-court-700" />
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-court-400">
              Panel
            </p>
          </>
        )}
        {navItems.map(({ href, label, icon: Icon }) => (
          <motion.div key={href} variants={fadeUp}>
            <Link
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                (href === '/dashboard' ? pathname === href : pathname.startsWith(href))
                  ? 'bg-brand-500/15 text-brand-400'
                  : 'text-court-200 hover:bg-court-800 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          </motion.div>
        ))}
      </motion.nav>
    </aside>
  )
}
