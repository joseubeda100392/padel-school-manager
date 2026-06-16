'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

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

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: userData } = await supabase.from('users').select('club_id').eq('id', user.id).single()
      const cid = userData?.club_id ?? null
      setClubId(cid)
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

    const ext = file.name.split('.').pop()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('materials')
      .upload(path, file, { contentType: file.type })

    if (uploadError) {
      setError(`Error al subir: ${uploadError.message}`)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('materials').getPublicUrl(path)

    const { data: material, error: insertError } = await supabase
      .from('materials')
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        file_url: urlData.publicUrl,
        uploaded_by: user.id,
        is_published: isPublished,
        club_id: clubId,
      })
      .select('id')
      .single()

    if (insertError || !material) {
      setError(`Error al guardar: ${insertError?.message}`)
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
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <a href="/dashboard/materials" className="text-sm text-gray-500 hover:text-gray-700">
          ← Materiales
        </a>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Subir material</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Título *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="Técnica de globo — Nivel intermedio"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="Breve descripción del contenido..."
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Archivo PDF *</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-brand-500 file:px-3 file:py-1 file:text-xs file:font-medium file:text-white hover:file:bg-green-700"
          />
          {file && (
            <p className="mt-1 text-xs text-gray-500">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Niveles (vacío = todos los niveles)
          </label>
          <div className="flex flex-wrap gap-2">
            {levels.map((level) => (
              <button
                key={level.id}
                type="button"
                onClick={() => toggleLevel(level.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  selectedLevels.includes(level.id)
                    ? 'text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={selectedLevels.includes(level.id) ? { backgroundColor: level.color } : undefined}
              >
                {level.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={isPublished}
            onClick={() => setIsPublished(!isPublished)}
            className={`relative h-6 w-11 rounded-full transition ${isPublished ? 'bg-brand-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isPublished ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
          <span className="text-sm text-gray-700">Publicar inmediatamente</span>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={uploading}
            className="flex-1 rounded-lg bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {uploading ? 'Subiendo...' : 'Subir material'}
          </button>
          <a
            href="/dashboard/materials"
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </a>
        </div>
      </form>
    </div>
  )
}
