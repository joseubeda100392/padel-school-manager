'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { InstallBanner } from '@/components/install-banner'
import type { ClubFeatures } from '@/lib/get-club-features'
import { AppShell } from './app-shell'
import { adminNav } from './nav-config'

interface DashboardShellProps {
  children: React.ReactNode
  clubName?: string
  role?: string
  userName?: string
  features?: ClubFeatures
  saActiveClub?: string
}

export function DashboardShell({ children, clubName, role, userName, features, saActiveClub }: DashboardShellProps) {
  const router = useRouter()
  const isSuperAdmin = role === 'super_admin'
  const managingClub = isSuperAdmin && !!saActiveClub && !!clubName
  const title = isSuperAdmin && !managingClub ? 'Super admin' : (clubName ?? 'ePadel School')

  async function exitClub() {
    await fetch('/api/superadmin/active-club', { method: 'DELETE' })
    router.push('/dashboard/clubs')
    router.refresh()
  }

  const exitClubButton = managingClub ? (
    <button
      type="button"
      onClick={exitClub}
      className="flex w-full items-center justify-between gap-2 rounded-control bg-chrome-2 px-3 py-2.5 text-left hover:bg-chrome-2/70"
    >
      <span className="min-w-0">
        <span className="block text-[0.75rem] text-chrome-ink-2">Gestionando</span>
        <span className="block truncate text-label text-white">{clubName}</span>
      </span>
      <LogOut className="h-4 w-4 shrink-0 text-chrome-ink-2" aria-label="Salir del club" />
    </button>
  ) : undefined

  return (
    <AppShell
      nav={adminNav({ features, isSuperAdmin })}
      clubName={title}
      identity={{ name: userName ?? 'Administrador', subtitle: isSuperAdmin ? 'Super admin' : `Admin · ${clubName ?? ''}` }}
      sidebarExtra={exitClubButton}
      headerActions={
        managingClub ? (
          <button type="button" onClick={exitClub} className="h-9 rounded-full border border-line px-3 text-meta font-medium text-ink-2 hover:bg-ink/5">
            Salir del club
          </button>
        ) : undefined
      }
      overlays={<InstallBanner />}
    >
      {children}
    </AppShell>
  )
}
