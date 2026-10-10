'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { List, ListRow } from '@/components/ui/list'
import { useConfirm } from '@/components/ui/confirm'
import { formatLongDate } from '@/lib/format-date'

interface Exclusion {
  id: string
  excluded_date: string
  reason: string | null
  student_name: string
}

interface Enrollment {
  id: string
  student: { id: string; name: string }
}

export default function ScheduleExclusions({ scheduleId, enrollments }: { scheduleId: string; enrollments: Enrollment[] }) {
  const confirm = useConfirm()
  const [exclusions, setExclusions] = useState<Exclusion[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ enrollmentId: '', date: '', reason: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [scheduleId])

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('schedule_exclusions')
      .select('id, excluded_date, reason, group_enrollment:group_enrollments(student:users(name))')
      .in('group_enrollment_id', enrollments.map((e) => e.id))
      .order('excluded_date', { ascending: false })
    setExclusions((data ?? []).map((e: any) => ({
      id: e.id,
      excluded_date: e.excluded_date,
      reason: e.reason,
      student_name: e.group_enrollment?.student?.name ?? '—',
    })))
  }

  async function handleAdd() {
    if (!form.enrollmentId || !form.date) { setError('Selecciona alumno y fecha'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/schedule-exclusions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group_enrollment_id: form.enrollmentId,
        excluded_date: form.date,
        reason: form.reason || null,
      }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error ?? 'Error'); return }
    setForm({ enrollmentId: '', date: '', reason: '' })
    setOpen(false)
    load()
    if (json.recoveryCapReached) {
      toast.warning('Falta registrada. Límite de recuperaciones alcanzado — no se añade clase a la bolsa.')
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirm({
      title: '¿Quitar esta falta?',
      description: 'La clase volverá a contar para el alumno ese día.',
      confirmLabel: 'Quitar falta',
      destructive: true,
    }))) return
    await fetch('/api/schedule-exclusions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setExclusions((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <Card>
      <CardHeader
        title="Clases puntuales canceladas"
        description="Faltas individuales sin dar de baja al alumno"
        action={
          <Button variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <Plus className="h-4 w-4" aria-hidden />
            Añadir falta
          </Button>
        }
      />

      {open && (
        <div className="mt-4 space-y-3 border-y border-line bg-surface-2 px-4 py-4 sm:px-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Alumno">
              <Select value={form.enrollmentId} onChange={(e) => setForm({ ...form, enrollmentId: e.target.value })}>
                <option value="">Selecciona un alumno</option>
                {enrollments.map((e) => (
                  <option key={e.id} value={e.id}>{e.student.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Fecha de la clase cancelada">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Motivo (opcional)" className="sm:col-span-2">
              <Input
                type="text"
                value={form.reason}
                placeholder="Por ejemplo, viaje o enfermedad"
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </Field>
          </div>
          {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => { setOpen(false); setError('') }}>Cancelar</Button>
            <Button onClick={handleAdd} loading={saving}>{saving ? 'Guardando…' : 'Registrar falta'}</Button>
          </div>
        </div>
      )}

      {exclusions.length === 0 ? (
        <p className="px-4 py-6 text-center text-body text-ink-3 sm:px-5">Sin cancelaciones puntuales registradas.</p>
      ) : (
        <List className="mt-3 border-t border-line">
          {exclusions.map((e) => (
            <ListRow
              key={e.id}
              title={e.student_name}
              subtitle={
                <>
                  {formatLongDate(e.excluded_date)}
                  {e.reason && ` · ${e.reason}`}
                </>
              }
              trailing={
                <Button variant="danger-ghost" size="sm" onClick={() => handleDelete(e.id)}>
                  Quitar
                </Button>
              }
            />
          ))}
        </List>
      )}
    </Card>
  )
}
