'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Button, buttonVariants } from '@/components/ui/button'
import { LevelTag } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Level {
  id: string
  name: string
  color: string
}

export default function NewMaterialPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [levels, setLevels] = useState<Level[]>([])
  const [selectedLevels, setSelectedLevels] = useState<string[]>([])
  const [isPublished, setIsPublished] = useState(true)
  const [clubId, setClubId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: userData } = await supabase.from('users').select('club_id, role').eq('id', user.id).single()
      const cid = userData?.club_id ?? null
      setClubId(cid)
      setUserRole((userData as any)?.role ?? null)
      const query = supabase.from('levels').select('id, name, color').order('order')
      const { data } = await (cid ? query.eq('club_id', cid) : query)
      if (data) setLevels(data)
    })
  }, [])

  function toggleLevel(id: string) {
    setSelectedLevels((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setError('Selecciona un archivo PDF'); return }
    if (!title.trim()) { setError('El título es obligatorio'); return }

    setUploading(true)
    setError('')
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('No autenticado'); setUploading(false); return }

    if (!['admin', 'super_admin', 'coach'].includes(userRole ?? '')) {
      setError('Sin permisos para subir materias')
      setUploading(false)
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('El archivo no puede superar los 10 MB')
      setUploading(false)
      return
    }

    const firstBytes = await file.slice(0, 5).arrayBuffer()
    const magic = new Uint8Array(firstBytes)
    if (magic[0] !== 0x25 || magic[1] !== 0x50 || magic[2] !== 0x44 || magic[3] !== 0x46) {
      setError('Solo se permiten archivos PDF válidos')
      setUploading(false)
      return
    }

    const ext = file.name.split('.').pop()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('materials')
      .upload(path, file, { contentType: file.type })

    if (uploadError) {
      setError('Error al subir el archivo. Inténtalo de nuevo.')
      setUploading(false)
      return
    }

    const { data: material, error: insertError } = await supabase
      .from('materials')
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        file_url: path,
        uploaded_by: user.id,
        is_published: isPublished,
        club_id: clubId,
      })
      .select('id')
      .single()

    if (insertError || !material) {
      setError('Error al guardar la materia. Inténtalo de nuevo.')
      setUploading(false)
      return
    }

    if (selectedLevels.length > 0) {
      await supabase.from('material_levels').insert(
        selectedLevels.map((level_id) => ({ material_id: material.id, level_id }))
      )
    }

    window.location.href = '/dashboard/materials'
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader title="Subir materia" back={{ href: '/dashboard/materials', label: 'Materias' }} />

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Título">
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Técnica de globo, nivel intermedio"
              />
            </Field>

            <Field label="Descripción">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Breve descripción del contenido"
              />
            </Field>

            <Field label="Archivo PDF" hint={file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)` : 'Máximo 10 MB.'}>
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="h-auto py-2 text-ink-2 file:mr-3 file:rounded-control file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-label file:font-medium file:text-ink"
              />
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
              <span className="text-label text-ink">Publicar inmediatamente</span>
            </button>

            {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Link href="/dashboard/materials" className={buttonVariants({ variant: 'secondary', className: 'w-full sm:w-auto' })}>
                Cancelar
              </Link>
              <Button type="submit" loading={uploading} className="w-full sm:w-auto">
                {uploading ? 'Subiendo…' : 'Subir materia'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
