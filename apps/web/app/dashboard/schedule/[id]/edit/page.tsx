'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { createClient } from '@/lib/supabase/client'

export default function EditSchedulePage({ params }: { params: { id: string } }) {
  const [courts, setCourts] = useState<any[]>([])
  const [coaches, setCoaches] = useState<any[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [form, setForm] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('schedules').select('*').eq('id', params.id).single(),
      fetch('/api/admin/courts').then(r => r.json()),
      fetch('/api/admin/coaches').then(r => r.json()),
      fetch('/api/admin/levels').then(r => r.json()),
    ]).then(([{ data: s }, courtsData, coachesData, levelsData]) => {
      const c = courtsData.courts ?? []
      const u = coachesData.coaches ?? []
      const l = levelsData.levels ?? []

      if (s) {
        const start = new Date(s.start_time)
        const end = new Date(s.end_time)
        const diffMin = Math.round((end.getTime() - start.getTime()) / 60000)
        setForm({
          court_id: s.court_id ?? '',
          coach_id: s.coach_id ?? '',
          level_id: s.level_id ?? '',
          date: start.toISOString().split('T')[0],
          start_time: start.toTimeString().slice(0, 5),
          duration: diffMin === 90 ? 90 : 60,
          recurrence: s.recurrence ?? 'weekly',
          recurrence_end_date: s.recurrence_end_date ?? '',
          max_students: s.max_students ?? 4,
          is_active: s.is_active ?? true,
        })
      }
      if (c) setCourts(c)
      if (u) setCoaches(u)
      if (l) setLevels(l)
    })
  }, [params.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.court_id || !form.coach_id || !form.date) { setError('Rellena los campos obligatorios'); return }

    const startDateTime = new Date(`${form.date}T${form.start_time}:00`)
    const endDateTime = new Date(startDateTime.getTime() + form.duration * 60 * 1000)

    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/schedules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: params.id,
        court_id: form.court_id,
        coach_id: form.coach_id,
        level_id: form.level_id || null,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        recurrence: form.recurrence,
        recurrence_end_date: form.recurrence !== 'none' && form.recurrence_end_date ? form.recurrence_end_date : null,
        max_students: form.max_students,
        is_active: form.is_active,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { setError(json.error ?? 'Error al guardar'); setLoading(false); return }
    window.location.href = `/dashboard/schedule/${params.id}`
  }

  if (!form) return <PageSkeleton />

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader back={{ href: `/dashboard/schedule/${params.id}`, label: 'Clase' }} title="Editar clase" />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Pista">
              <Select value={form.court_id} onChange={(e) => setForm({ ...form, court_id: e.target.value })}>
                <option value="">Selecciona una pista</option>
                {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>

            <Field label="Monitor">
              <Select value={form.coach_id} onChange={(e) => setForm({ ...form, coach_id: e.target.value })}>
                <option value="">Selecciona un monitor</option>
                {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Nivel requerido">
            <Select value={form.level_id} onChange={(e) => setForm({ ...form, level_id: e.target.value })}>
              <option value="">Abierto a todos los niveles</option>
              {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </Field>

          <Field label="Fecha">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Hora de inicio">
              <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </Field>
            <Field label="Duración">
              <Select value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}>
                <option value={60}>1 hora</option>
                <option value={90}>1 hora 30 min</option>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Recurrencia">
              <Select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}>
                <option value="none">Clase única</option>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal</option>
              </Select>
            </Field>
            <Field label="Máximo de alumnos">
              <Input
                type="text"
                value={form.max_students}
                inputMode="numeric"
                onFocus={e => e.target.select()}
                onChange={(e) => setForm({ ...form, max_students: parseInt(e.target.value, 10) || 0 })}
              />
            </Field>
          </div>

          {form.recurrence !== 'none' && (
            <Field label="Fecha de fin de la recurrencia" hint="Opcional. Déjala vacía si la clase no tiene fecha de fin.">
              <Input
                type="date"
                value={form.recurrence_end_date}
                min={form.date}
                onChange={(e) => setForm({ ...form, recurrence_end_date: e.target.value })}
              />
            </Field>
          )}

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="h-5 w-5 rounded border-line-strong text-accent-ink focus:ring-accent-ink"
            />
            <label htmlFor="is_active" className="text-label text-ink">Clase activa (visible para los alumnos)</label>
          </div>

          {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Link href={`/dashboard/schedule/${params.id}`} className={buttonVariants({ variant: 'secondary', className: 'w-full sm:w-auto' })}>
              Cancelar
            </Link>
            <Button type="submit" variant="primary" loading={loading} className="w-full sm:w-auto">
              {loading ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
