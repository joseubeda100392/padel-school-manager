'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6b7280', '#1d4ed8']

export default function EditLevelPage({ params }: { params: { id: string } }) {
  const router = useRouter()
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
    router.refresh()
    router.push('/dashboard/levels')
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar este nivel? Los alumnos que lo tengan asignado quedarán sin nivel.')) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('users').update({ current_level_id: null }).eq('current_level_id', params.id)
    await supabase.from('levels').delete().eq('id', params.id)
    router.refresh()
    router.push('/dashboard/levels')
  }

  if (!form) return <div className="p-8 text-center text-gray-400">Cargando...</div>

  return (
    <div className="max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <a href="/dashboard/levels" className="text-sm text-gray-500 hover:text-gray-700">← Niveles</a>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Editar nivel</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre *</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none" />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Descripción</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3} placeholder="Opcional"
            className="w-full resize-none rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none" />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                className={`h-8 w-8 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                style={{ backgroundColor: c }} />
            ))}
            <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="h-8 w-8 cursor-pointer rounded-full border-0 p-0" title="Color personalizado" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="h-4 w-4 rounded-full" style={{ backgroundColor: form.color }} />
            <span className="text-xs text-gray-500">{form.color}</span>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Orden (posición en la lista)</label>
          <input type="number" min={1} value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })}
            className="w-32 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none" />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <a href="/dashboard/levels"
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-center text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </a>
          <button type="submit" disabled={saving}
            className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>

      <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4">
        <p className="mb-1 text-sm font-medium text-red-700">Zona peligrosa</p>
        <p className="mb-3 text-xs text-red-500">Los alumnos con este nivel quedarán sin nivel asignado.</p>
        <button onClick={handleDelete} disabled={deleting}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
          {deleting ? 'Eliminando...' : 'Eliminar nivel'}
        </button>
      </div>
    </div>
  )
}
