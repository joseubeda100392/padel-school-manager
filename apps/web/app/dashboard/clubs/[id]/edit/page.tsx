'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/feedback'
import { useConfirm } from '@/components/ui/confirm'

export default function EditClubPage({ params }: { params: { id: string } }) {
  const confirm = useConfirm()
  const [form, setForm] = useState<any>(null)
  const [existingFeatures, setExistingFeatures] = useState<Record<string, boolean>>({})
  const [wasActive, setWasActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('clubs').select('*').eq('id', params.id).single().then(({ data }) => {
      if (data) {
        const features = data.features ?? {}
        setExistingFeatures(features)
        setWasActive(data.is_active)
        setForm({
          name: data.name,
          slug: data.slug,
          plan: data.plan,
          is_active: data.is_active,
          enable_pista_viva: features.enable_pista_viva ?? false,
        })
      }
    })
  }, [params.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const mergedFeatures = { ...existingFeatures, enable_pista_viva: form.enable_pista_viva }
    const { error: err } = await supabase.from('clubs').update({
      name: form.name.trim(),
      slug: form.slug.trim(),
      plan: form.plan,
      is_active: form.is_active,
      features: mergedFeatures,
    }).eq('id', params.id)
    if (!err && !wasActive && form.is_active) {
      // Se acaba de reactivar: levantar el bloqueo de acceso de sus usuarios (requiere service role)
      await fetch(`/api/admin/clubs/${params.id}/reactivate`, { method: 'POST' }).catch(() => {})
    }
    if (err) { setError(err.message); setLoading(false); return }
    window.location.href = '/dashboard/clubs'
  }

  async function handleDelete() {
    if (
      !(await confirm({
        title: 'Eliminar este club',
        description:
          'Se borrarán de forma permanente el club y todos sus datos (alumnos, clases, pagos, etc.). No se puede deshacer. Si solo quieres bloquear el acceso sin borrar nada, desmarca "Club activo" y guarda.',
        confirmLabel: 'Eliminar club',
        destructive: true,
      }))
    )
      return
    setDeleting(true)
    const res = await fetch(`/api/admin/clubs/${params.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Error al eliminar el club')
      setDeleting(false)
      return
    }
    window.location.href = '/dashboard/clubs'
  }

  if (!form) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-6" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <PageHeader title="Editar club" back={{ href: '/dashboard/clubs', label: 'Clubes' }} />

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Nombre del club">
              <Input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>

            <Field label="Slug (URL)">
              <Input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                autoCapitalize="none"
                className="font-mono"
              />
            </Field>

            <Field label="Plan">
              <Select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                <option value="trial">Trial</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
              </Select>
            </Field>

            <label htmlFor="is_active" className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="h-5 w-5 rounded accent-accent-ink"
              />
              <span className="text-label text-ink">Club activo</span>
            </label>

            <fieldset className="border-t border-line pt-4">
              <legend className="text-label text-ink-2">Módulos premium</legend>
              <label htmlFor="enable_pista_viva" className="mt-2 flex min-h-11 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  id="enable_pista_viva"
                  checked={form.enable_pista_viva}
                  onChange={(e) => setForm({ ...form, enable_pista_viva: e.target.checked })}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded accent-accent-ink"
                />
                <span>
                  <span className="block text-label text-ink">Pista Viva</span>
                  <span className="block text-meta text-ink-3">Detección de partidos abiertos con jugadores pendientes.</span>
                </span>
              </label>
            </fieldset>

            {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Link href="/dashboard/clubs" className={buttonVariants({ variant: 'secondary', className: 'w-full sm:w-auto' })}>
                Cancelar
              </Link>
              <Button type="submit" loading={loading} className="w-full sm:w-auto">
                {loading ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card className="border-danger-ink/20">
        <CardHeader title="Eliminar club" description="Borra el club y todos sus datos de forma permanente." />
        <CardBody>
          <Button variant="danger" onClick={handleDelete} loading={deleting} className="w-full sm:w-auto">
            {deleting ? 'Eliminando…' : 'Eliminar club'}
          </Button>
        </CardBody>
      </Card>
    </div>
  )
}
