'use client'

import { useState } from 'react'
import { Search, TriangleAlert } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/feedback'
import { List, ListRow } from '@/components/ui/list'

type PendingMatch = {
  booking_id: string
  court_name: string | null
  start_label: string
  num_participantes: number
  faltan: number
  level_min: number | null
  level_max: number | null
}

export function PendingMatchesPanel() {
  const [matches, setMatches] = useState<PendingMatch[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function checkNow() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/pista-viva/pending-matches', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al consultar Playtomic'); return }
      setMatches(data.matches ?? [])
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Comprobar partidos pendientes ahora"
        description="Consulta en directo (próximos 14 días), sin esperar al siguiente escaneo automático."
        action={
          <Button onClick={checkNow} loading={loading} className="w-full sm:w-auto">
            {!loading && <Search className="h-4 w-4" aria-hidden />}
            {loading ? 'Consultando…' : 'Comprobar ahora'}
          </Button>
        }
      />

      <div className="p-4 pt-3 sm:p-5 sm:pt-3">
        {error && (
          <Notice tone="warn" icon={<TriangleAlert />}>
            {error}
          </Notice>
        )}

        {matches && matches.length === 0 && !error && (
          <p className="text-body text-ink-2">No hay partidos pendientes de jugadores ahora mismo.</p>
        )}

        {matches && matches.length > 0 && (
          <List className="rounded-control border border-line">
            {matches.map((m) => (
              <ListRow
                key={m.booking_id}
                title={`${m.court_name ?? 'Pista'} · ${m.start_label}`}
                subtitle={
                  <>
                    Faltan {m.faltan} jugador{m.faltan === 1 ? '' : 'es'}
                    {m.level_min != null && m.level_max != null && ` · Nivel estimado ${m.level_min.toFixed(2)} - ${m.level_max.toFixed(2)}`}
                  </>
                }
                trailing={
                  <a
                    href={`https://app.playtomic.io/matches/${m.booking_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center text-label text-accent-ink hover:underline"
                  >
                    Ver en Playtomic
                  </a>
                }
              />
            ))}
          </List>
        )}
      </div>
    </Card>
  )
}
