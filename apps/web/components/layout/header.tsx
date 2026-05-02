'use client'

import { useRouter } from 'next/navigation'
import { LogOut, Menu } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 md:px-8">
      <button
        onClick={onMenuClick}
        className="flex items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100 md:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden md:block" />

      <button
        onClick={handleLogout}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Cerrar sesión</span>
      </button>
    </header>
  )
}
