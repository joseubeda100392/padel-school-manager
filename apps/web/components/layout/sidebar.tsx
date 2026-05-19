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
  PlusCircle,
  HelpCircle,
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
]

const superAdminItems = [
  { href: '/dashboard/clubs', label: 'Clubes', icon: Building2 },
]

export function Sidebar({ clubName, role, userName, onClose }: { clubName?: string; role?: string; userName?: string; onClose?: () => void }) {
  const pathname = usePathname()
  const isSuperAdmin = role === 'super_admin'

  return (
    <aside className="flex h-screen w-[280px] flex-col border-r border-gray-200/60 bg-white/70 backdrop-blur-xl">
      {/* Logo */}
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
          <p className="text-[10px] font-bold tracking-[0.12em] text-gray-400 uppercase pl-10">Administration Console</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 md:hidden">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-4 space-y-0.5">
        {isSuperAdmin && (
          <>
            <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Super Admin</p>
            {superAdminItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all group',
                  pathname.startsWith(href)
                    ? 'bg-[#006b2c]/10 text-[#006b2c]'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
                )}
              >
                <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                {label}
              </Link>
            ))}
            <div className="my-3 border-t border-gray-100" />
          </>
        )}
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all group',
              (href === '/dashboard' ? pathname === href : pathname.startsWith(href))
                ? 'bg-[#006b2c]/10 text-[#006b2c]'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
            )}
          >
            <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-4 pb-6 space-y-1">
        <Link
          href="/dashboard/schedule/new"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#006b2c] px-4 py-3 text-[13px] font-bold text-white shadow-lg shadow-[#006b2c]/20 hover:bg-[#005320] active:scale-[0.98] transition-all mb-3"
        >
          <PlusCircle className="h-4 w-4" />
          Nueva clase
        </Link>
        <Link href="/dashboard/settings" onClick={onClose} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all">
          <Settings className="h-4 w-4" />
          Configuración
        </Link>
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all">
          <HelpCircle className="h-4 w-4" />
          Soporte
        </button>
      </div>
    </aside>
  )
}
