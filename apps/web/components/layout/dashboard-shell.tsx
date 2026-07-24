'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { InstallBanner } from '@/components/install-banner'
import type { ClubFeatures } from '@/lib/get-club-features'

interface DashboardShellProps {
  children: React.ReactNode
  clubName?: string
  role?: string
  userName?: string
  features?: ClubFeatures
  saActiveClub?: string
}

export function DashboardShell({ children, clubName, role, userName, features, saActiveClub }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    document.body.classList.toggle('overflow-hidden', sidebarOpen)
    return () => document.body.classList.remove('overflow-hidden')
  }, [sidebarOpen])

  return (
    <div className="flex min-h-dvh bg-court-50">
      {/* Overlay móvil — siempre en DOM para evitar flash de un frame */}
      <div
        className={`fixed inset-0 z-20 bg-black/40 md:hidden transition-opacity duration-200 ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <div className={`fixed top-0 left-0 z-30 h-dvh transition-transform duration-200 md:static md:h-auto md:translate-x-0 md:z-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar clubName={clubName} role={role} userName={userName} features={features} saActiveClub={saActiveClub} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Contenido */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <InstallBanner />
        <main ref={mainRef} className="flex-1 overflow-auto p-4 md:p-8">
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
