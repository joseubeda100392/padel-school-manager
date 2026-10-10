'use client'

import { PushNotificationProvider } from '@/components/push-notification-provider'
import { InstallBanner } from '@/components/install-banner'
import type { ClubFeatures } from '@/lib/get-club-features'
import { AppShell } from './app-shell'
import { coachNav } from './nav-config'

export function CoachShell({ children, userName, clubName, features, alsoStudent }: {
  children: React.ReactNode
  userName?: string
  clubName?: string
  features?: ClubFeatures
  alsoStudent?: boolean
}) {
  const club = clubName ?? 'ePadel School'
  return (
    <AppShell
      nav={coachNav({ features })}
      clubName={club}
      identity={{ name: userName ?? 'Monitor', subtitle: `Monitor · ${club}` }}
      roleSwitch={alsoStudent ? { href: '/student', label: 'Ver como alumno' } : undefined}
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
