'use client'

import { useRouter } from 'next/navigation'
import { LogOut, Menu, Bell, MessageSquare, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function Header({ onMenuClick, userName, role }: { onMenuClick?: () => void; userName?: string; role?: string }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = userName
    ? userName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'A'

  const roleLabel: Record<string, string> = {
    admin: 'Admin',
    super_admin: 'Super Admin',
    coach: 'Monitor',
    student: 'Alumno',
  }

  return (
    <header className="flex h-20 items-center justify-between border-b border-gray-200/60 bg-white/80 backdrop-blur-md px-6 md:px-12">
      {/* Mobile menu + search */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <button
          onClick={onMenuClick}
          className="flex items-center justify-center rounded-xl p-2 text-gray-500 hover:bg-gray-100 md:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="relative hidden md:block w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar alumnos, horarios, pagos..."
            className="w-full pl-11 pr-4 py-2.5 border border-gray-200/60 rounded-xl bg-gray-50/50 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#006b2c]/20 focus:border-[#006b2c] transition-all placeholder-gray-400"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        <button className="relative flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 transition-all group">
          <Bell className="h-5 w-5 group-hover:scale-110 transition-transform" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        </button>
        <button className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 transition-all group">
          <MessageSquare className="h-5 w-5 group-hover:scale-110 transition-transform" />
        </button>

        <div className="h-8 w-px bg-gray-200 mx-1" />

        <div className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-1.5 rounded-xl transition-all group">
          <div className="hidden sm:block text-right">
            <p className="text-[13px] font-bold text-gray-900 leading-tight">{userName ?? 'Admin'}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{roleLabel[role ?? ''] ?? role}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#006b2c] text-white text-[13px] font-bold shadow-sm shrink-0">
            {initials}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden lg:inline">Salir</span>
        </button>
      </div>
    </header>
  )
}
