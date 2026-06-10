'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  Building2,
  Bell,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClubFeatures } from '@/lib/get-club-features'

const baseNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, feature: null },
  { href: '/dashboard/students', label: 'Alumnos', icon: Users, feature: null },
  { href: '/dashboard/levels', label: 'Niveles', icon: Trophy, feature: null },
  { href: '/dashboard/schedule', label: 'Clases', icon: CalendarDays, feature: null },
  { href: '/dashboard/payments', label: 'Pagos', icon: CreditCard, feature: 'enable_payments' },
  { href: '/dashboard/chat', label: 'Chat Soporte', icon: MessageSquare, feature: 'enable_chat' },
  { href: '/dashboard/materials', label: 'Materiales', icon: BookOpen, feature: 'enable_materials' },
  { href: '/dashboard/analytics', label: 'Estadísticas', icon: BarChart3, feature: null },
  { href: '/dashboard/notifications', label: 'Notificaciones', icon: Bell, feature: null },
  { href: '/dashboard/settings', label: 'Configuración', icon: Settings, feature: null },
]

const superAdminItems = [
  { href: '/dashboard/clubs', label: 'Clubes', icon: Building2 },
]

export function Sidebar({ clubName, role, userName, features, onClose }: {
  clubName?: string
  role?: string
  userName?: string
  features?: ClubFeatures
  onClose?: () => void
}) {
  const pathname = usePathname()
  const isSuperAdmin = role === 'super_admin'
  const initials = userName
    ? userName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'P'

  const navItems = baseNavItems.filter(item => {
    if (!item.feature || !features) return true
    return features[item.feature as keyof ClubFeatures]
  })

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

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {isSuperAdmin && (
          <>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-court-400">
              Super Admin
            </p>
            {superAdminItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
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
            ))}
            <div className="my-3 border-t border-court-700" />
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-court-400">
              Panel
            </p>
          </>
        )}
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
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
        ))}
      </nav>
    </aside>
  )
}
