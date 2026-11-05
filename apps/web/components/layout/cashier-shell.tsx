'use client'

import { InstallBanner } from '@/components/install-banner'
import { AppShell } from './app-shell'
import { cashierNav } from './nav-config'

export function CashierShell({ children, userName, clubName }: { children: React.ReactNode; userName?: string; clubName?: string }) {
  const club = clubName ?? 'ePadel School'
  return (
    <AppShell
      nav={cashierNav()}
      clubName={club}
      identity={{ name: userName ?? 'Cobrador', subtitle: `Caja · ${club}` }}
      overlays={<InstallBanner />}
    >
      {children}
    </AppShell>
  )
}
