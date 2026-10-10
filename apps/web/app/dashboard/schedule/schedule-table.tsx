'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { formatTime, getDayOfWeek } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge, LevelTag } from '@/components/ui/badge'
import { Input, Select } from '@/components/ui/field'
import { useConfirm } from '@/components/ui/confirm'

const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function dayName(dateStr: string) {
  return days[getDayOfWeek(dateStr)]
}

function timeOnly(dateStr: string) {
  return formatTime(dateStr)
}

const TH = 'px-4 py-3 text-left text-meta font-medium text-ink-3'
const CHECKBOX = 'h-5 w-5 rounded border-line-strong text-accent-ink focus:ring-accent-ink'

export default function ScheduleTable({ schedules }: { schedules: any[] }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [q, setQ] = useState('')
  const [day, setDay] = useState('')
  const [type, setType] = useState('')
  const [onlyFree, setOnlyFree] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    const qLower = q.toLowerCase()
    return schedules.filter((s) => {
      const matchQ = !q ||
        (s.court?.name ?? '').toLowerCase().includes(qLower) ||
        (s.coach?.name ?? '').toLowerCase().includes(qLower) ||
        (s.level?.name ?? '').toLowerCase().includes(qLower)
      const matchDay = !day || String(getDayOfWeek(s.start_time)) === day
      const matchType = !type || (s.type ?? 'regular') === type
      const matchFree = !onlyFree || (s.max_students > 0 && (s.group_size ?? 0) < s.max_students)
      return matchQ && matchDay && matchType && matchFree
    })
  }, [schedules, q, day, type, onlyFree])

  const allFilteredSelected = filtered.length > 0 && filtered.every(s => selected.has(s.id))

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allFilteredSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(s => next.delete(s.id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(s => next.add(s.id))
        return next
      })
    }
  }

  async function handleDeleteSelected() {
    const ids = [...selected]
    if (!(await confirm({
      title: `¿Eliminar ${ids.length} clase${ids.length > 1 ? 's' : ''}?`,
      description: 'Se eliminarán también sus reservas e inscripciones. No se puede deshacer.',
      confirmLabel: `Eliminar ${ids.length > 1 ? 'clases' : 'clase'}`,
      destructive: true,
    }))) return
    setDeleting(true)

    const res = await fetch('/api/admin/schedules/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleIds: ids }),
    })

    setSelected(new Set())
    setDeleting(false)
    if (res.ok) {
      window.location.reload()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          aria-label="Buscar por pista, monitor o nivel"
          placeholder="Buscar por pista, monitor o nivel"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-0 flex-1 sm:min-w-[220px]"
        />
        <Select aria-label="Día" value={day} onChange={(e) => setDay(e.target.value)} className="w-full sm:w-auto">
          <option value="">Todos los días</option>
          <option value="1">Lunes</option>
          <option value="2">Martes</option>
          <option value="3">Miércoles</option>
          <option value="4">Jueves</option>
          <option value="5">Viernes</option>
          <option value="6">Sábado</option>
          <option value="0">Domingo</option>
        </Select>
        <Select aria-label="Tipo de clase" value={type} onChange={(e) => setType(e.target.value)} className="w-full sm:w-auto">
          <option value="">Todos los tipos</option>
          <option value="regular">Regular</option>
          <option value="intensivo">Intensivo</option>
        </Select>
        <label
          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line-strong/70 bg-surface px-3.5 text-label text-ink hover:border-line-strong"
          title="Grupos con menos alumnos fijos activos que plazas"
        >
          <input
            type="checkbox"
            checked={onlyFree}
            onChange={(e) => setOnlyFree(e.target.checked)}
            className={CHECKBOX}
          />
          Solo con plazas libres
        </label>
        {(q || day || type || onlyFree) && (
          <Button variant="ghost" onClick={() => { setQ(''); setDay(''); setType(''); setOnlyFree(false) }}>
            Limpiar filtros
          </Button>
        )}
        {selected.size > 0 && (
          <Button variant="danger" onClick={handleDeleteSelected} loading={deleting}>
            {deleting ? 'Eliminando…' : `Eliminar ${selected.size} seleccionada${selected.size > 1 ? 's' : ''}`}
          </Button>
        )}
      </div>

      {(q || day || type || onlyFree) && (
        <p className="text-meta tabular-nums text-ink-3">{filtered.length} de {schedules.length} clases</p>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-line bg-surface-2">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todas las clases"
                    checked={allFilteredSelected}
                    onChange={toggleAll}
                    className={CHECKBOX}
                  />
                </th>
                <th className={TH}>Día</th>
                <th className={TH}>Horario</th>
                <th className={TH}>Pista</th>
                <th className={TH}>Monitor</th>
                <th className={TH}>Nivel</th>
                <th className={TH}>Recurrencia</th>
                <th className={TH}>Ocupación</th>
                <th className={TH}>Revisión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!filtered.length && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-body text-ink-3">
                    {q || day || type ? 'Sin resultados para esa búsqueda. Prueba con otros filtros.' : 'No hay clases programadas. Crea la primera con "Nueva clase".'}
                  </td>
                </tr>
              )}
              {filtered.map((s: any) => {
                const level = Array.isArray(s.level) ? s.level[0] : s.level
                const ratio = s.max_students > 0 ? s.bookings_count / s.max_students : 0
                return (
                <tr
                  key={s.id}
                  className={`cursor-pointer hover:bg-ink/[0.03] ${selected.has(s.id) ? 'bg-accent-soft' : ''}`}
                  onClick={() => router.push(`/dashboard/schedule/${s.id}${s.reference_date ? `?date=${s.reference_date}` : ''}`)}
                >
                  <td
                    className="px-4 py-3"
                    onClick={(e) => { e.stopPropagation(); toggleOne(s.id) }}
                  >
                    <div className="flex h-full w-full cursor-pointer items-center">
                      <input
                        type="checkbox"
                        aria-label="Seleccionar clase"
                        checked={selected.has(s.id)}
                        onChange={() => toggleOne(s.id)}
                        onClick={(e) => e.stopPropagation()}
                        className={CHECKBOX}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-label text-ink">{dayName(s.start_time)}</td>
                  <td className="px-4 py-3 text-body tabular-nums text-ink">
                    {timeOnly(s.start_time)} — {timeOnly(s.end_time)}
                  </td>
                  <td className="px-4 py-3 text-body text-ink-2">{s.court?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-body text-ink-2">{s.coach?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {level ? (
                      <LevelTag name={level.name} color={level.color} />
                    ) : (
                      <span className="text-meta text-ink-3">Todos</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Badge tone="neutral">
                        {s.recurrence === 'weekly' ? 'Semanal' : s.recurrence === 'biweekly' ? 'Quincenal' : 'Única'}
                      </Badge>
                      {s.is_fixed_group && <Badge tone="outline">Grupo fijo</Badge>}
                      {(s.type === 'intensivo') && <Badge tone="outline">Intensivo</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {s.max_students > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink/[0.06]">
                          <div
                            className={`h-1.5 rounded-full ${ratio >= 1 ? 'bg-danger-ink' : ratio >= 0.7 ? 'bg-warn-ink' : 'bg-accent-ink'}`}
                            style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-meta tabular-nums text-ink-2">{s.bookings_count ?? 0}/{s.max_students}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.review ? (
                      <div className="flex items-start gap-1.5">
                        <span
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-danger-ink"
                          role="img"
                          aria-label="Requiere revisión: hay faltas registradas"
                          title="Requiere revisión: hay faltas registradas"
                        />
                        <div className="flex flex-col gap-0.5">
                          {s.review.substituteNames.map((name: string, i: number) => (
                            <span key={i} className="text-meta font-medium text-ink-2">{name}</span>
                          ))}
                          {s.review.uncoveredCount > 0 && (
                            <span className="text-meta font-medium text-danger-ink">
                              {s.review.uncoveredCount} plaza{s.review.uncoveredCount > 1 ? 's' : ''} por cubrir
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-meta text-ink-3">—</span>
                    )}
                  </td>
                </tr>
              )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
