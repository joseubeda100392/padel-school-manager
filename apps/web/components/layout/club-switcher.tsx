'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

export interface SwitcherNetwork {
  name: string
  clubs: { id: string; name: string }[]
}

// Pasa a gestionar otra sede de la red y recarga la página entera: así no
// queda nada en pantalla (ni en la caché del navegador) de la sede anterior.
// Devuelve false si no se ha podido (y ya ha avisado al usuario).
export async function switchToClub(clubId: string): Promise<boolean> {
  const res = await fetch('/api/admin/switch-club', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clubId }),
  }).catch(() => null)
  if (!res?.ok) {
    const json = await res?.json().catch(() => ({}))
    toast.error(json?.error ?? 'No se ha podido cambiar de sede')
    return false
  }
  window.location.assign('/dashboard')
  return true
}

// Selector de sede del coordinador de una red.
export function ClubSwitcher({ network, currentClubId, variant }: { network: SwitcherNetwork; currentClubId?: string; variant: 'sidebar' | 'header' }) {
  const [busy, setBusy] = useState(false)

  async function change(clubId: string) {
    if (!clubId || clubId === currentClubId) return
    setBusy(true)
    if (!(await switchToClub(clubId))) setBusy(false)
  }

  const select = (
    <select
      aria-label={`Sede de la red ${network.name}`}
      value={currentClubId ?? ''}
      disabled={busy}
      onChange={e => change(e.target.value)}
      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
    >
      {network.clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  )
  const current = network.clubs.find(c => c.id === currentClubId)?.name ?? 'Elige sede'

  if (variant === 'header') {
    return (
      <span className="relative inline-flex h-9 items-center gap-1 rounded-full border border-line px-3 text-meta font-medium text-ink-2">
        <span className="max-w-[9rem] truncate">{busy ? 'Cambiando…' : current}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {select}
      </span>
    )
  }

  return (
    <span className="relative flex w-full items-center justify-between gap-2 rounded-control bg-chrome-2 px-3 py-2.5 text-left hover:bg-chrome-2/70">
      <span className="min-w-0">
        <span className="block text-[0.75rem] text-chrome-ink-2">Sede · Red {network.name}</span>
        <span className="block truncate text-label text-white">{busy ? 'Cambiando…' : current}</span>
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 text-chrome-ink-2" aria-hidden />
      {select}
    </span>
  )
}
