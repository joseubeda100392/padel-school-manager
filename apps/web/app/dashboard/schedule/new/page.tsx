'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CircleAlert } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { Notice } from '@/components/ui/feedback'
import { createClient } from '@/lib/supabase/client'

export default function NewSchedulePage() {
  const [courts, setCourts] = useState<any[]>([])
  const [coaches, setCoaches] = useState<any[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [form, setForm] = useState({
    court_id: '',
    coach_id: '',
    level_id: '',
    date: '',
    start_time: '09:00',
    duration: 60,
    recurrence: 'weekly',
    recurrence_end_date: '',
    max_students: 4,
    type: 'regular' as 'regular' | 'intensivo',
    price_cents: 0,
    is_private: false,
  })
  const [intensivoDays, setIntensivoDays] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [enableIntensivos, setEnableIntensivos] = useState(true)
  const [enablePrivateLessons, setEnablePrivateLessons] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/courts').then(r => r.json()),
      fetch('/api/admin/coaches').then(r => r.json()),
      fetch('/api/admin/levels').then(r => r.json()),
      fetch('/api/admin/club-features').then(r => r.json()).catch(() => ({})),
    ]).then(([courtsData, coachesData, levelsData, featData]) => {
      if (courtsData.courts) setCourts(courtsData.courts)
      if (coachesData.coaches) setCoaches(coachesData.coaches)
      if (levelsData.levels) setLevels(levelsData.levels)
      if (featData?.features?.enable_intensivos === false) setEnableIntensivos(false)
      if (featData?.features?.enable_private_lessons) setEnablePrivateLessons(true)
    })
  }, [])

  const canBePrivate = enablePrivateLessons && form.type === 'regular' && form.recurrence === 'none'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.court_id) { setError('Selecciona una pista'); return }
    if (!form.coach_id) { setError('Selecciona un monitor'); return }
    if (!form.date) { setError('Selecciona una fecha'); return }
    if (form.type === 'intensivo' && intensivoDays.length === 0) { setError('Selecciona al menos un día del intensivo'); return }

    setLoading(true)
    setError('')

    const intensivoGroupId = form.type === 'intensivo' ? crypto.randomUUID() : null

    // For intensivos: create one schedule per selected day in the same week
    const datesToCreate: string[] = form.type === 'intensivo' ? (() => {
      const base = new Date(form.date + 'T12:00:00Z')
      const baseDow = base.getUTCDay() // 0=Sun,1=Mon...
      const mondayOffset = baseDow === 0 ? -6 : 1 - baseDow
      const monday = new Date(base)
      monday.setUTCDate(base.getUTCDate() + mondayOffset)
      // intensivoDays: 0=Mon,1=Tue,...,6=Sun
      return intensivoDays.map(d => {
        const day = new Date(monday)
        day.setUTCDate(monday.getUTCDate() + d)
        return day.toISOString().split('T')[0]
      })
    })() : [form.date]

    for (const date of datesToCreate) {
      const startDateTime = new Date(`${date}T${form.start_time}:00`)
      const endDateTime = new Date(startDateTime.getTime() + form.duration * 60 * 1000)
      const res = await fetch('/api/admin/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          court_id: form.court_id,
          coach_id: form.coach_id,
          level_id: form.level_id || null,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          recurrence: form.type === 'intensivo' ? 'none' : form.recurrence,
          recurrence_end_date: form.type !== 'intensivo' && form.recurrence !== 'none' && form.recurrence_end_date ? form.recurrence_end_date : null,
          max_students: canBePrivate && form.is_private ? 1 : form.max_students,

          type: form.type,
          price_cents: form.price_cents > 0 ? form.price_cents : null,
          intensivo_group_id: intensivoGroupId,
          is_private: canBePrivate && form.is_private,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Error al crear la clase')
        setLoading(false)
        return
      }
    }

    window.location.href = '/dashboard/schedule'
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader back={{ href: '/dashboard/schedule', label: 'Horarios' }} title="Nueva clase" />

      {courts.length === 0 && (
        <Notice tone="warn" icon={<CircleAlert />}>
          No hay pistas activas. <Link href="/dashboard/settings" className="font-medium underline">Crea una pista en Configuración</Link> para poder programar la clase.
        </Notice>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Pista">
              <Select value={form.court_id} onChange={(e) => setForm({ ...form, court_id: e.target.value })}>
                <option value="">Selecciona una pista</option>
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>

            <Field label="Monitor">
              <Select value={form.coach_id} onChange={(e) => setForm({ ...form, coach_id: e.target.value })}>
                <option value="">Selecciona un monitor</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Nivel requerido" hint="Solo verán esta clase los alumnos con ese nivel asignado.">
            <Select value={form.level_id} onChange={(e) => setForm({ ...form, level_id: e.target.value })}>
              <option value="">Abierto a todos los niveles</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
          </Field>

          <Field label={form.type === 'intensivo' ? 'Semana del intensivo (elige cualquier día)' : 'Fecha de inicio'}>
            <Input
              type="date"
              value={form.date}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
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
            {form.type !== 'intensivo' && (
              <Field label="Recurrencia">
                <Select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}>
                  <option value="none">Clase única</option>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quincenal</option>
                </Select>
              </Field>
            )}
            <Field label="Máximo de alumnos">
              <Input
                type="text"
                inputMode="numeric"
                onFocus={e => e.target.select()}
                min={1}
                max={20}
                disabled={canBePrivate && form.is_private}
                value={canBePrivate && form.is_private ? 1 : form.max_students}
                onChange={(e) => setForm({ ...form, max_students: Number(e.target.value) })}
              />
            </Field>
          </div>

          {canBePrivate && (
            <div className="flex items-start gap-3 rounded-control bg-surface-2 px-4 py-3">
              <input type="checkbox" id="is_private" checked={form.is_private}
                onChange={(e) => setForm({ ...form, is_private: e.target.checked })}
                className="mt-0.5 h-5 w-5 rounded border-line-strong text-accent-ink focus:ring-accent-ink" />
              <label htmlFor="is_private" className="text-label text-ink">
                Es clase particular <span className="font-normal text-ink-3">(1 a 1: el máximo de alumnos pasa a 1 y se cobra con las tarifas de particular)</span>
              </label>
            </div>
          )}

          <div role="group" aria-labelledby="tipo-clase" className="space-y-2">
            <p id="tipo-clase" className="text-label text-ink">Tipo de clase</p>
            <div className="flex flex-wrap gap-2">
              {[{ value: 'regular', label: 'Regular' }, ...(enableIntensivos ? [{ value: 'intensivo', label: 'Intensivo (verano)' }] : [])].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={form.type === opt.value}
                  onClick={() => { setForm({ ...form, type: opt.value as any }); setIntensivoDays([]) }}
                  className={`min-h-11 rounded-full px-4 text-label transition-colors ${
                    form.type === opt.value ? 'bg-accent-soft text-accent-ink ring-1 ring-accent-ink' : 'border border-line-strong/60 text-ink-2 hover:bg-surface-2'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {form.type === 'intensivo' && (
            <>
              <div role="group" aria-labelledby="dias-intensivo" className="space-y-2">
                <p id="dias-intensivo" className="text-label text-ink">Días del intensivo</p>
                <p className="text-meta text-ink-3">Selecciona los días de la semana. Se creará un horario por cada día.</p>
                <div className="flex flex-wrap gap-2">
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((label, idx) => (
                    <button
                      key={idx}
                      type="button"
                      aria-pressed={intensivoDays.includes(idx)}
                      onClick={() => setIntensivoDays(prev =>
                        prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx].sort()
                      )}
                      className={`min-h-11 min-w-11 rounded-full px-3 text-label transition-colors ${
                        intensivoDays.includes(idx) ? 'bg-accent-soft text-accent-ink ring-1 ring-accent-ink' : 'border border-line-strong/60 text-ink-2 hover:bg-surface-2'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <Field label="Precio por clase (€)" hint="Deja el campo vacío para usar el precio general del club.">
                <Input
                  type="text"
                  inputMode="numeric"
                  onFocus={e => e.target.select()}
                  min={0}
                  step={0.5}
                  value={form.price_cents === 0 ? '' : form.price_cents / 100}
                  onChange={e => setForm({ ...form, price_cents: Math.round(Number(e.target.value) * 100) })}
                  placeholder="Precio general del club"
                  className="tabular-nums"
                />
              </Field>
            </>
          )}

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

          {error && (
            <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>
          )}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Link href="/dashboard/schedule" className={buttonVariants({ variant: 'secondary', className: 'w-full sm:w-auto' })}>
              Cancelar
            </Link>
            <Button type="submit" variant="primary" loading={loading} className="w-full sm:w-auto">
              {loading ? 'Creando clase…' : 'Crear clase'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
