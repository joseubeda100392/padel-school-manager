'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'

interface DashboardShellProps {
  children: React.ReactNode
  clubName?: string
  role?: string
  userName?: string
}

export function DashboardShell({ children, clubName, role, userName }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 transition-transform duration-200 md:static md:translate-x-0 md:z-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar clubName={clubName} role={role} userName={userName} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Contenido */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
