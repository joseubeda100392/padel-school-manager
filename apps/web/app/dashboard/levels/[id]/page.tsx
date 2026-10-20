'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Notice } from '@/components/ui/feedback'
import { useConfirm } from '@/components/ui/confirm'
import { createClient } from '@/lib/supabase/client'

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6b7280', '#1d4ed8']

export default function EditLevelPage({ params }: { params: { id: string } }) {
  const confirm = useConfirm()
  const [form, setForm] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('levels').select('*').eq('id', params.id).single().then(({ data }) => {
      if (data) setForm({ name: data.name, description: data.description ?? '', color: data.color, order: data.order })
    })
  }, [params.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('levels').update({
      name: form.name.trim(),
      description: form.description.trim() || null,
      color: form.color,
      order: Number(form.order),
    }).eq('id', params.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    window.location.href = '/dashboard/levels'
  }

  async function handleDelete() {
    if (!(await confirm({
      title: '¿Eliminar este nivel?',
      description: 'Los alumnos que lo tengan asignado quedarán sin nivel.',
      confirmLabel: 'Eliminar nivel',
      destructive: true,
    }))) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('users').update({ current_level_id: null }).eq('current_level_id', params.id)
    await supabase.from('levels').delete().eq('id', params.id)
    window.location.href = '/dashboard/levels'
  }

  if (!form) return <PageSkeleton />

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <PageHeader back={{ href: '/dashboard/levels', label: 'Niveles' }} title="Editar nivel" />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5 p-4 sm:p-6">
          <Field label="Nombre">
            <Input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>

          <Field label="Descripción (opcional)">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Qué sabe hacer un alumno de este nivel"
            />
          </Field>

          <div role="group" aria-labelledby="color-nivel" className="space-y-2">
            <p id="color-nivel" className="text-label text-ink">Color</p>
            <div className="flex flex-wrap items-center gap-3">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  aria-label={`Color ${c}`}
                  aria-pressed={form.color === c}
                  className={`h-11 w-11 rounded-full ring-1 ring-ink/10 transition-transform active:scale-95 ${form.color === c ? 'outline outline-[3px] outline-offset-2 outline-ink-2' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-11 w-11 cursor-pointer rounded-full border-0 p-0"
                title="Color personalizado"
                aria-label="Color personalizado"
              />
            </div>
            <p className="flex items-center gap-2 text-meta text-ink-3">
              <span className="h-3 w-3 rounded-full ring-1 ring-ink/10" style={{ backgroundColor: form.color }} aria-hidden />
              <span className="tabular-nums">{form.color}</span>
            </p>
          </div>

          <Field label="Orden (posición en la lista)" className="sm:w-40">
            <Input
              type="text"
              value={form.order}
              onChange={(e) => setForm({ ...form, order: e.target.value })}
              inputMode="numeric"
              onFocus={e => e.target.select()}
              className="tabular-nums"
            />
          </Field>

          {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Link href="/dashboard/levels" className={buttonVariants({ variant: 'secondary', className: 'w-full sm:w-auto' })}>
              Cancelar
            </Link>
            <Button type="submit" loading={saving} className="w-full sm:w-auto">
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </Card>

      <Notice
        tone="danger"
        icon={<TriangleAlert />}
        action={
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            {deleting ? 'Eliminando…' : 'Eliminar nivel'}
          </Button>
        }
      >
        <p className="font-medium">Eliminar este nivel</p>
        <p className="mt-0.5 text-meta">Los alumnos con este nivel quedarán sin nivel asignado.</p>
      </Notice>
    </div>
  )
}
