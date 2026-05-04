'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Level {
  id: string
  name: string
  color: string
}

export default function EditMaterialPage({ params }: { params: { id: string } }) {
  const router = useRouter()
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
      const clubId = user?.user_metadata?.club_id ?? null
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

    router.refresh()
    router.push('/dashboard/materials')
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar este material? Esta acción no se puede deshacer.')) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('material_levels').delete().eq('material_id', params.id)
    await supabase.from('materials').delete().eq('id', params.id)
    router.refresh()
    router.push('/dashboard/materials')
  }

  if (!loaded) return <div className="p-8 text-center text-gray-400">Cargando...</div>

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <a href="/dashboard/materials" className="text-sm text-gray-500 hover:text-gray-700">
          ← Materiales
        </a>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Editar material</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Título *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
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
            className={`relative h-6 w-11 rounded-full transition ${isPublished ? 'bg-green-600' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isPublished ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
          <span className="text-sm text-gray-700">Publicado</span>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <a
            href="/dashboard/materials"
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </a>
        </div>
      </form>

      <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4">
        <p className="mb-1 text-sm font-medium text-red-700">Zona peligrosa</p>
        <p className="mb-3 text-xs text-red-500">Se eliminará el material y sus asignaciones de nivel. El archivo en Storage no se borra automáticamente.</p>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {deleting ? 'Eliminando...' : 'Eliminar material'}
        </button>
      </div>
    </div>
  )
}
