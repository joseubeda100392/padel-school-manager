'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Clock, CircleCheck, CircleX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Field, Input, Select } from '@/components/ui/field'
import { List } from '@/components/ui/list'

interface Makeup {
  id: string
  student_name: string
  original_date: string | null
  makeup_date: string | null
  status: string
  notes: string | null
}

interface Student {
  id: string
  name: string
}

const statusLabel: Record<string, string> = {
  pending: 'Pendiente',
  completed: 'Realizada',
  cancelled: 'Cancelada',
}
const statusTone: Record<string, 'warn' | 'success' | 'neutral'> = {
  pending: 'warn',
  completed: 'success',
  cancelled: 'neutral',
}

export default function ScheduleMakeups({ scheduleId, students }: { scheduleId: string; students: Student[] }) {
  const [makeups, setMakeups] = useState<Makeup[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ studentId: '', originalDate: '', makeupDate: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [scheduleId])

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('makeups')
      .select('id, original_date, makeup_date, status, notes, student:users(name)')
      .eq('original_schedule_id', scheduleId)
      .order('created_at', { ascending: false })
    setMakeups((data ?? []).map((m: any) => ({ ...m, student_name: m.student?.name ?? '—' })))
  }

  async function handleAdd() {
    if (!form.studentId) { setError('Selecciona un alumno'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: userData } = await supabase.from('users').select('club_id').eq('id', user!.id).single()
    const clubId = userData?.club_id ?? null

    const { error: err } = await supabase.from('makeups').insert({
      student_id: form.studentId,
      club_id: clubId,
      original_schedule_id: scheduleId,
      original_date: form.originalDate || null,
      makeup_date: form.makeupDate || null,
      notes: form.notes || null,
      created_by: user?.id,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm({ studentId: '', originalDate: '', makeupDate: '', notes: '' })
    setOpen(false)
    load()
  }

  async function handleStatus(id: string, status: string) {
    const supabase = createClient()
    await supabase.from('makeups').update({ status }).eq('id', id)
    setMakeups((prev) => prev.map((m) => m.id === id ? { ...m, status } : m))
  }

  return (
    <Card>
      <CardHeader
        title="Recuperaciones"
        description={`${makeups.filter(m => m.status === 'pending').length} pendientes`}
        action={
          <Button variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <Plus className="h-4 w-4" aria-hidden />
            Nueva recuperación
          </Button>
        }
      />

      {open && (
        <div className="mt-4 space-y-3 border-y border-line bg-surface-2 px-4 py-4 sm:px-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Alumno">
              <Select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
                <option value="">Selecciona un alumno</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Fecha de la clase perdida">
              <Input type="date" value={form.originalDate} onChange={(e) => setForm({ ...form, originalDate: e.target.value })} />
            </Field>
            <Field label="Fecha de recuperación">
              <Input type="date" value={form.makeupDate} onChange={(e) => setForm({ ...form, makeupDate: e.target.value })} />
            </Field>
            <Field label="Notas (opcional)">
              <Input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => { setOpen(false); setError('') }}>Cancelar</Button>
            <Button onClick={handleAdd} loading={saving}>{saving ? 'Guardando…' : 'Guardar recuperación'}</Button>
          </div>
        </div>
      )}

      {makeups.length === 0 ? (
        <p className="px-4 py-8 text-center text-body text-ink-3 sm:px-5">Sin recuperaciones registradas.</p>
      ) : (
        <List className="mt-3 border-t border-line">
          {makeups.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-[0.9375rem] font-medium text-ink">{m.student_name}</p>
                <p className="text-meta text-ink-3">
                  {m.original_date ? `Faltó: ${new Date(m.original_date).toLocaleDateString('es-ES')}` : 'Sin fecha de origen'}
                  {m.makeup_date ? ` · Recupera: ${new Date(m.makeup_date).toLocaleDateString('es-ES')}` : ''}
                </p>
                {m.notes && <p className="text-meta text-ink-3">{m.notes}</p>}
              </div>
              <Badge tone={statusTone[m.status] ?? 'neutral'}>
                {m.status === 'pending' ? <Clock className="h-3.5 w-3.5" aria-hidden /> : m.status === 'completed' ? <CircleCheck className="h-3.5 w-3.5" aria-hidden /> : <CircleX className="h-3.5 w-3.5" aria-hidden />}
                {statusLabel[m.status]}
              </Badge>
              {m.status === 'pending' && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => handleStatus(m.id, 'completed')}>
                    Marcar como realizada
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleStatus(m.id, 'cancelled')}>
                    Cancelar
                  </Button>
                </div>
              )}
            </li>
          ))}
        </List>
      )}
    </Card>
  )
}
