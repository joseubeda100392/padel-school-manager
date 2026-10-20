'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, FileText } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { EmptyState } from '@/components/ui/feedback'
import { List, ListRow } from '@/components/ui/list'
import { useConfirm } from '@/components/ui/confirm'

interface Material {
  id: string
  title: string
  description: string | null
  file_url: string
  created_at: string
}

export default function ScheduleMaterials({ scheduleId }: { scheduleId: string }) {
  const confirm = useConfirm()
  const [materials, setMaterials] = useState<Material[]>([])
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    load()
  }, [scheduleId])

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('materials')
      .select('id, title, description, file_url, created_at')
      .eq('schedule_id', scheduleId)
      .order('created_at', { ascending: false })
    setMaterials(data ?? [])
  }

  async function handleUpload() {
    if (!title.trim()) { setError('El título es obligatorio'); return }
    if (!file) { setError('Selecciona un archivo'); return }
    setUploading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: userData } = await supabase.from('users').select('club_id').eq('id', user!.id).single()
    const clubId = userData?.club_id ?? null

    const ext = file.name.split('.').pop()
    const path = `${clubId ?? 'global'}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('materials').upload(path, file)
    if (upErr) { setError('Error al subir el archivo. Inténtalo de nuevo.'); setUploading(false); return }

    const { error: dbErr } = await supabase.from('materials').insert({
      title: title.trim(),
      file_url: path,
      schedule_id: scheduleId,
      club_id: clubId,
      uploaded_by: user?.id,
      is_published: true,
    })

    if (dbErr) { setError('Error al guardar la materia. Inténtalo de nuevo.'); setUploading(false); return }

    setTitle('')
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setOpen(false)
    setUploading(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!(await confirm({
      title: '¿Eliminar esta materia?',
      description: 'El archivo dejará de estar disponible para la clase.',
      confirmLabel: 'Eliminar materia',
      destructive: true,
    }))) return
    const supabase = createClient()
    await supabase.from('materials').delete().eq('id', id)
    load()
  }

  return (
    <Card>
      <CardHeader
        title="Materia de clase"
        description={`${materials.length} archivos`}
        action={
          <Button variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <Upload className="h-4 w-4" aria-hidden />
            Subir archivo
          </Button>
        }
      />

      {open && (
        <div className="mt-4 space-y-3 border-y border-line bg-surface-2 px-4 py-4 sm:px-5">
          <Field label="Título">
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Por ejemplo, ejercicios de volea"
            />
          </Field>
          <Field label="Archivo (PDF, imagen o vídeo)">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.mp4,.mov"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-body text-ink-2 file:mr-3 file:h-11 file:rounded-control file:border file:border-line-strong/60 file:bg-surface file:px-4 file:text-label file:text-ink hover:file:bg-surface-2"
            />
          </Field>
          {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => { setOpen(false); setError('') }}>Cancelar</Button>
            <Button onClick={handleUpload} loading={uploading}>{uploading ? 'Subiendo…' : 'Subir archivo'}</Button>
          </div>
        </div>
      )}

      {materials.length === 0 ? (
        <EmptyState icon={<FileText />} title="Sin materia para esta clase" description="Sube un PDF, una imagen o un vídeo para que lo vea el grupo." />
      ) : (
        <List className="mt-3 border-t border-line">
          {materials.map((m) => (
            <ListRow
              key={m.id}
              leading={
                <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-control bg-surface-2 text-ink-3">
                  <FileText className="h-5 w-5" />
                </span>
              }
              title={m.title}
              subtitle={new Date(m.created_at).toLocaleDateString('es-ES')}
              trailing={
                <div className="flex items-center gap-1">
                  <a href={`/api/pdf/material/${m.id}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                    Ver
                  </a>
                  <Button variant="danger-ghost" size="sm" onClick={() => handleDelete(m.id)}>
                    Eliminar
                  </Button>
                </div>
              }
            />
          ))}
        </List>
      )}
    </Card>
  )
}
