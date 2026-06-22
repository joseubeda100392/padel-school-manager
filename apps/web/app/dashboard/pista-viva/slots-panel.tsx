'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PlaytomicResource } from '@/lib/playtomic'

type Level = { id: string; name: string }

export default function SlotsPanel({ clubId }: { clubId: string }) {
  const router = useRouter()
  const [resources, setResources] = useState<PlaytomicResource[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [levels, setLevels] = useState<Level[]>([])
  const [creating, setCreating] = useState<string | null>(null)
  const [sent, setSent] = useState<Set<string>>(new Set())

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
      const res = slotsData.resources ?? []
      setResources(res)
      if (res.length === 0) setError('No hay pistas libres en las próximas 48h en Playtomic')

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
        setSent((prev) => new Set([...prev, key]))
        router.refresh()
      }
    } finally {
      setCreating(null)
    }
  }

  const totalSlots = resources.reduce((acc, r) => acc + r.slots.length, 0)

  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">Pistas libres en Playtomic</h2>
          <p className="text-sm text-gray-500">Próximas 24h · Se actualiza al pulsar el botón</p>
        </div>
        <button
          onClick={fetchSlots}
          disabled={loading}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {loading ? 'Consultando...' : '🔍 Buscar pistas libres'}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          {error.includes('tenant_id') || error.includes('Playtomic no configurado') ? (
            <>
              Primero debes configurar tus credenciales de Playtomic.{' '}
              <a href="/dashboard/settings#playtomic" className="font-medium underline hover:no-underline">
                Ir a Settings → Playtomic →
              </a>
            </>
          ) : (
            <span>⚠️ {error}</span>
          )}
        </div>
      )}

      {resources.length > 0 && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-gray-500">{totalSlots} slots libres en {resources.length} pistas</p>
          {resources.map((resource) => (
            <div key={resource.resource_id} className="rounded-lg bg-white p-4 shadow-sm">
              <p className="mb-3 font-medium text-gray-900">{resource.name}</p>
              <div className="flex flex-wrap gap-2">
                {resource.slots.map((slot) => {
                  const key = `${resource.resource_id}_${slot.start_time}`
                  const date = new Date(slot.start_time)
                  const isSent = sent.has(key)
                  return (
                    <button
                      key={key}
                      disabled={creating === key || isSent}
                      onClick={() => createCampaign(resource, slot)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        isSent
                          ? 'border-green-200 bg-green-50 text-green-600'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-brand-50'
                      } disabled:opacity-60`}
                    >
                      {isSent ? '✓ ' : ''}
                      {date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}
                      {' '}
                      {date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      {' · '}{slot.duration}min
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && resources.length === 0 && (
        <p className="mt-4 text-center text-sm text-gray-400">
          Pulsa el botón para consultar pistas libres en Playtomic
        </p>
      )}
    </div>
  )
}
