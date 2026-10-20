'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Button, buttonVariants } from '@/components/ui/button'
import { LevelTag } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/feedback'
import { useConfirm } from '@/components/ui/confirm'
import { cn } from '@/lib/utils'

interface Level {
  id: string
  name: string
  color: string
}

export default function EditMaterialPage({ params }: { params: { id: string } }) {
  const confirm = useConfirm()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublished, setIsPublished] = useState(true)
  const [levels, setLevels] = useState<Level[]>([])
  const [selectedLevels, setSelectedLevels] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: userData } = await supabase.from('users').select('club_id').eq('id', user.id).single()
      const clubId = userData?.club_id ?? null
      const [{ data: material }, { data: lvls }] = await Promise.all([
        supabase
          .from('materials')
          .select('*, material_levels(level_id)')
          .eq('id', params.id)
          .single(),
        clubId
          ? supabase.from('levels').select('id, name, color').eq('club_id', clubId).order('order')
          : supabase.from('levels').select('id, name, color').order('order'),
      ])
      if (material) {
        setTitle(material.title)
        setDescription(material.description ?? '')
        setIsPublished(material.is_published)
        setSelectedLevels(material.material_levels?.map((ml: any) => ml.level_id) ?? [])
      }
      if (lvls) setLevels(lvls)
      setLoaded(true)
    })
  }, [params.id])

  function toggleLevel(id: string) {
    setSelectedLevels((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('El título es obligatorio'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('materials')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        is_published: isPublished,
      })
      .eq('id', params.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    await supabase.from('material_levels').delete().eq('material_id', params.id)
    if (selectedLevels.length > 0) {
      await supabase.from('material_levels').insert(
        selectedLevels.map((level_id) => ({ material_id: params.id, level_id }))
      )
    }

    window.location.href = '/dashboard/materials'
  }

  async function handleDelete() {
    if (
      !(await confirm({
        title: 'Eliminar esta materia',
        description: 'Esta acción no se puede deshacer.',
        confirmLabel: 'Eliminar materia',
        destructive: true,
      }))
    )
      return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('material_levels').delete().eq('material_id', params.id)
    await supabase.from('materials').delete().eq('id', params.id)
    window.location.href = '/dashboard/materials'
  }

  if (!loaded) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader title="Editar materia" back={{ href: '/dashboard/materials', label: 'Materias' }} />

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Título">
              <Input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </Field>

            <Field label="Descripción">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </Field>

            <fieldset>
              <legend className="text-label text-ink">Niveles</legend>
              <p className="mt-0.5 text-meta text-ink-3">Si no eliges ninguno, lo verán todos los niveles.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {levels.map((level) => {
                  const selected = selectedLevels.includes(level.id)
                  return (
                    <button
                      key={level.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleLevel(level.id)}
                      className={cn(
                        'min-h-11 rounded-full border px-4 transition-colors',
                        selected ? 'border-accent-ink bg-accent-soft' : 'border-line-strong/60 bg-surface hover:bg-surface-2',
                      )}
                    >
                      <LevelTag name={level.name} color={level.color} />
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <button
              type="button"
              role="switch"
              aria-checked={isPublished}
              onClick={() => setIsPublished(!isPublished)}
              className="flex min-h-11 items-center gap-3 text-left"
            >
              <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', isPublished ? 'bg-accent-ink' : 'bg-line-strong')}>
                <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-card transition-transform', isPublished ? 'translate-x-5' : 'translate-x-0.5')} />
              </span>
              <span className="text-label text-ink">Publicado</span>
            </button>

            {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Link href="/dashboard/materials" className={buttonVariants({ variant: 'secondary', className: 'w-full sm:w-auto' })}>
                Cancelar
              </Link>
              <Button type="submit" loading={saving} className="w-full sm:w-auto">
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card className="border-danger-ink/20">
        <CardHeader
          title="Eliminar materia"
          description="Se eliminará la materia y sus asignaciones de nivel. El archivo en Storage no se borra automáticamente."
        />
        <CardBody>
          <Button variant="danger" onClick={handleDelete} loading={deleting} className="w-full sm:w-auto">
            {deleting ? 'Eliminando…' : 'Eliminar materia'}
          </Button>
        </CardBody>
      </Card>
    </div>
  )
}
