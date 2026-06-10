'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import { Header } from './header'
import type { ClubFeatures } from '@/lib/get-club-features'

interface DashboardShellProps {
  children: React.ReactNode
  clubName?: string
  role?: string
  userName?: string
  features?: ClubFeatures
}

export function DashboardShell({ children, clubName, role, userName, features }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen bg-court-50">
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 transition-transform duration-200 md:static md:translate-x-0 md:z-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar clubName={clubName} role={role} userName={userName} features={features} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Contenido */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  )
}
