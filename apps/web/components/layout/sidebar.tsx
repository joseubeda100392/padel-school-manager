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

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/students', label: 'Alumnos', icon: Users },
  { href: '/dashboard/levels', label: 'Niveles', icon: Trophy },
  { href: '/dashboard/schedule', label: 'Horarios', icon: CalendarDays },
  { href: '/dashboard/payments', label: 'Pagos', icon: CreditCard },
  { href: '/dashboard/chat', label: 'Chat Soporte', icon: MessageSquare },
  { href: '/dashboard/materials', label: 'Materiales', icon: BookOpen },
  { href: '/dashboard/analytics', label: 'Estadísticas', icon: BarChart3 },
  { href: '/dashboard/notifications', label: 'Notificaciones', icon: Bell },
  { href: '/dashboard/settings', label: 'Configuración', icon: Settings },
]

const superAdminItems = [
  { href: '/dashboard/clubs', label: 'Clubes', icon: Building2 },
]

export function Sidebar({ clubName, role, onClose }: { clubName?: string; role?: string; onClose?: () => void }) {
  const pathname = usePathname()
  const isSuperAdmin = role === 'super_admin'

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-3 border-b border-gray-200 p-4 md:p-6">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-600">
          <span className="text-sm font-bold text-white">P</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">
            {isSuperAdmin ? 'Super Admin' : (clubName ?? 'Padel Manager')}
          </p>
          <p className="text-xs text-gray-400">
            {isSuperAdmin ? 'Todos los clubes' : 'Panel admin'}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-auto rounded-lg p-1 text-gray-400 hover:bg-gray-100 md:hidden">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {isSuperAdmin && (
          <>
            <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wide text-gray-400">Super Admin</p>
            {superAdminItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  pathname.startsWith(href)
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
            <div className="my-2 border-t border-gray-100" />
            <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wide text-gray-400">Panel</p>
          </>
        )}
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              (href === '/dashboard' ? pathname === href : pathname.startsWith(href))
                ? 'bg-green-50 text-green-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
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
