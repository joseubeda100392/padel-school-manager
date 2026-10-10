'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Search } from 'lucide-react'
import type { PlaytomicResource } from '@/lib/playtomic'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/feedback'
import { formatShortDay, formatClock } from '@/lib/format-date'
import { cn } from '@/lib/utils'

// localStorage, no sessionStorage: queremos que el resultado sobreviva a
// cerrar la pestaña/el navegador, para no tener que volver a llamar a
// Playtomic salvo que el admin pulse el botón a propósito.
const STORAGE_KEY = 'pv_slots'

type Level = { id: string; name: string }

function filterFutureSlots(resources: PlaytomicResource[]): PlaytomicResource[] {
  const now = new Date()
  return resources
    .map((r) => ({ ...r, slots: r.slots.filter((s) => new Date(s.start_time) > now) }))
    .filter((r) => r.slots.length > 0)
}

function loadFromStorage(): PlaytomicResource[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? filterFutureSlots(JSON.parse(raw)) : []
  } catch { return [] }
}

export default function SlotsPanel({ clubId }: { clubId: string }) {
  const router = useRouter()
  const [resources, setResources] = useState<PlaytomicResource[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [levels, setLevels] = useState<Level[]>([])
  const [creating, setCreating] = useState<string | null>(null)
  const [sent, setSent] = useState<Set<string>>(new Set())

  useEffect(() => {
    const cached = loadFromStorage()
    if (cached.length > 0) setResources(cached)
  }, [])

  async function fetchSlots() {
    setLoading(true)
    setError('')
    try {
      const [slotsRes, levelsRes] = await Promise.all([
        fetch('/api/admin/pista-viva/slots'),
        fetch('/api/admin/levels'),
      ])
      const slotsData = await slotsRes.json()
      if (!slotsRes.ok) { setError(slotsData.error ?? 'Error al consultar Playtomic'); return }
      const res = filterFutureSlots(slotsData.resources ?? [])
      setResources(res)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(res)) } catch { /* ignore */ }
      if (res.length === 0) setError('No hay pistas libres en las próximas 24h en Playtomic')

      if (levelsRes.ok) {
        const ld = await levelsRes.json()
        setLevels(ld.levels ?? [])
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  async function createCampaign(resource: PlaytomicResource, slot: PlaytomicResource['slots'][0]) {
    const key = `${resource.resource_id}_${slot.start_time}`
    setCreating(key)
    try {
      const res = await fetch('/api/admin/pista-viva/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courtName: resource.name,
          resourceId: resource.resource_id,
          slotDatetime: new Date(slot.start_time).toISOString(),
          durationMinutes: slot.duration,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSent((prev) => new Set([...prev, key]))
        if (data?.campaign?.id) router.push(`/dashboard/pista-viva/${data.campaign.id}`)
      }
    } finally {
      setCreating(null)
    }
  }

  const totalSlots = resources.reduce((acc, r) => acc + r.slots.length, 0)

  return (
    <Card>
      <CardHeader
        title="Pistas libres en Playtomic"
        description="Próximas 48 h. Se actualiza al pulsar el botón."
        action={
          <Button onClick={fetchSlots} loading={loading} className="w-full sm:w-auto">
            {!loading && <Search className="h-4 w-4" aria-hidden />}
            {loading ? 'Consultando…' : 'Buscar pistas libres'}
          </Button>
        }
      />

      <div className="space-y-4 p-4 pt-3 sm:p-5 sm:pt-3">
        {error && (
          <Notice tone="warn">
            {error.includes('tenant_id') || error.includes('Playtomic no configurado') ? (
              <>
                Primero debes configurar tus credenciales de Playtomic.{' '}
                <Link href="/dashboard/settings#playtomic" className="font-medium underline hover:no-underline">
                  Ir a ajustes de Playtomic
                </Link>
              </>
            ) : (
              <span>{error}</span>
            )}
          </Notice>
        )}

        {resources.length > 0 && (
          <div className="space-y-4">
            <p className="text-meta tabular-nums text-ink-3">{totalSlots} huecos libres en {resources.length} pistas</p>
            {resources.map((resource) => (
              <div key={resource.resource_id} className="rounded-control border border-line p-4">
                <p className="mb-3 text-label text-ink">{resource.name}</p>
                <div className="flex flex-wrap gap-2">
                  {resource.slots.map((slot) => {
                    const key = `${resource.resource_id}_${slot.start_time}`
                    const isSent = sent.has(key)
                    const day = formatShortDay(slot.start_time)
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={creating === key || isSent}
                        onClick={() => createCampaign(resource, slot)}
                        className={cn(
                          'inline-flex min-h-11 items-center gap-1.5 rounded-control border px-3 text-label tabular-nums transition-colors disabled:opacity-70',
                          isSent
                            ? 'border-accent-ink bg-accent-soft text-accent-ink'
                            : 'border-line-strong/60 bg-surface text-ink hover:bg-surface-2',
                        )}
                      >
                        {isSent && <Check className="h-4 w-4" aria-hidden />}
                        {day.weekday} {day.day} {formatClock(slot.start_time)} · {slot.duration} min
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && resources.length === 0 && (
          <p className="text-center text-body text-ink-2">
            Pulsa el botón para consultar las pistas libres en Playtomic.
          </p>
        )}
      </div>
    </Card>
  )
}
