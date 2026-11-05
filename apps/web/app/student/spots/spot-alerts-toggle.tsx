'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Bell, BellOff } from 'lucide-react'

// Interruptor de los avisos de huecos libres: encendido cuando el alumno busca
// hueco y apagado cuando ya lo ha cubierto. Los avisos de su lista de espera
// le siguen llegando.
export function SpotAlertsToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    const next = !enabled
    setSaving(true)
    setEnabled(next)
    const res = await fetch('/api/student/spot-alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: next }),
    }).catch(() => null)
    setSaving(false)
    if (!res?.ok) {
      setEnabled(!next)
      toast.error('No se ha podido guardar. Vuelve a probar.')
      return
    }
    toast.success(next ? 'Te avisaremos cuando haya huecos libres' : 'Ya no te avisaremos de huecos libres')
  }

  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3">
      <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${enabled ? 'bg-accent-soft text-accent-ink' : 'bg-ink/[0.05] text-ink-3'}`}>
        {enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p id="spot-alerts-label" className="text-label text-ink">Avisarme de huecos libres</p>
        <p className="text-meta text-ink-3">{enabled ? 'Te llega un aviso cuando se libera una plaza de tu nivel.' : 'Apagado: no te llegan avisos de huecos.'}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-labelledby="spot-alerts-label"
        disabled={saving}
        onClick={toggle}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${enabled ? 'bg-accent' : 'bg-ink/20'}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}
