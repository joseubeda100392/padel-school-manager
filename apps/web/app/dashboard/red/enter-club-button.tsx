'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { switchToClub } from '@/components/layout/club-switcher'

export function EnterClubButton({ clubId, isCurrent, asSuperAdmin = false, className }: { clubId: string; isCurrent: boolean; asSuperAdmin?: boolean; className?: string }) {
  const [busy, setBusy] = useState(false)

  async function enter() {
    if (isCurrent && asSuperAdmin) {
      window.location.assign('/dashboard')
      return
    }
    setBusy(true)
    if (asSuperAdmin) {
      // Igual que "Gestionar" en Clubes: entra en el club con "Salir del club".
      const res = await fetch('/api/superadmin/active-club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId }),
      }).catch(() => null)
      if (res?.ok) window.location.assign('/dashboard')
      else setBusy(false)
      return
    }
    if (!(await switchToClub(clubId))) setBusy(false)
  }

  return (
    <Button variant={isCurrent ? 'secondary' : 'primary'} size="sm" onClick={enter} loading={busy} className={className}>
      {isCurrent ? 'Ir a su panel' : 'Entrar a gestionar'}
    </Button>
  )
}
