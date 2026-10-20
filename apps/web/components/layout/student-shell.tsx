'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import { PushNotificationProvider } from '@/components/push-notification-provider'
import { InstallBanner } from '@/components/install-banner'
import type { ClubFeatures } from '@/lib/get-club-features'
import { AppShell } from './app-shell'
import { studentNav } from './nav-config'

export function StudentShell({ children, userName, clubName, bagBalance, unreadCount = 0, features, isAlsoCoach, hideSpots = false, clubSlug = null }: {
  children: React.ReactNode
  userName?: string
  clubName?: string
  bagBalance?: number
  unreadCount?: number
  features?: ClubFeatures
  isAlsoCoach?: boolean
  hideSpots?: boolean
  clubSlug?: string | null
}) {
  const showBag = (!features || features.enable_bag) && bagBalance !== undefined
  const club = clubName ?? 'ePadel School'
  const balanceLabel = `${bagBalance} clase${bagBalance !== 1 ? 's' : ''}`

  return (
    <AppShell
      nav={studentNav({ features, hideSpots, unreadCount })}
      clubName={club}
      identity={{ name: userName ?? 'Alumno', subtitle: club }}
      roleSwitch={isAlsoCoach ? { href: '/coach', label: 'Ir al panel de monitor' } : undefined}
      legalLinks={clubSlug ? [{ href: `/legal/${clubSlug}/aviso-legal`, label: 'Aviso legal', external: true }] : []}
      headerActions={
        <>
          {showBag && (
            <Link
              href="/student/bag"
              className="mr-1 inline-flex h-8 items-center rounded-full bg-accent-soft px-3 text-meta font-semibold tabular-nums text-accent-ink"
              aria-label={`Tienes ${balanceLabel} en la bolsa`}
            >
              {balanceLabel}
            </Link>
          )}
          <Link
            href="/student/notifications"
            aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:bg-ink/5"
          >
            <Bell className="h-[22px] w-[22px]" aria-hidden />
            {unreadCount > 0 && <span aria-hidden className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-danger-ink" />}
          </Link>
        </>
      }
      sidebarExtra={
        showBag ? (
          <Link href="/student/bag" className="flex items-center justify-between rounded-control bg-chrome-2 px-3 py-2.5 hover:bg-chrome-2/70">
            <span className="text-meta text-chrome-ink-2">Clases en la bolsa</span>
            <span className="font-display text-heading tabular-nums text-accent">{bagBalance}</span>
          </Link>
        ) : undefined
      }
      overlays={
        <>
          <PushNotificationProvider />
          <InstallBanner />
        </>
      }
    >
      {children}
    </AppShell>
  )
}
