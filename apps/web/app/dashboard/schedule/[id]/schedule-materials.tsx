'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Material {
  id: string
  title: string
  description: string | null
  file_url: string
  created_at: string
}

export default function ScheduleMaterials({ scheduleId }: { scheduleId: string }) {
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
    if (upErr) { setError(upErr.message); setUploading(false); return }

    const { data: { publicUrl } } = supabase.storage.from('materials').getPublicUrl(path)

    const { error: dbErr } = await supabase.from('materials').insert({
      title: title.trim(),
      file_url: publicUrl,
      schedule_id: scheduleId,
      club_id: clubId,
      uploaded_by: user?.id,
      is_published: true,
    })

    if (dbErr) { setError(dbErr.message); setUploading(false); return }

    setTitle('')
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setOpen(false)
    setUploading(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este material?')) return
    const supabase = createClient()
    await supabase.from('materials').delete().eq('id', id)
    load()
  }

  return (
    <div className="rounded-xl bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div>
          <h2 className="font-semibold text-gray-900">Material de clase</h2>
          <p className="text-xs text-gray-400">{materials.length} archivos</p>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
        >
          + Subir
        </button>
      </div>

      {open && (
        <div className="border-b border-gray-100 px-6 py-4 space-y-3 bg-gray-50">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Título *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Ejercicios de volea"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Archivo (PDF, imagen...) *</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.mp4,.mov"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-600"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setOpen(false); setError('') }}
              className="flex-1 rounded-lg border border-gray-200 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 rounded-lg bg-brand-500 py-2 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {uploading ? 'Subiendo...' : 'Subir archivo'}
            </button>
          </div>
        </div>
      )}

      {materials.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-gray-400">Sin material subido para esta clase.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {materials.map((m) => (
            <li key={m.id} className="flex items-center gap-4 px-6 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{m.title}</p>
                <p className="text-xs text-gray-400">{new Date(m.created_at).toLocaleDateString('es-ES')}</p>
              </div>
              <div className="flex items-center gap-3">
                <a href={m.file_url} target="_blank" rel="noreferrer"
                  className="text-xs font-medium text-brand-500 hover:underline">
                  Ver
                </a>
                <button onClick={() => handleDelete(m.id)}
                  className="text-xs text-red-400 hover:text-red-600">
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
