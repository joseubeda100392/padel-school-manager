'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function EditClubPage({ params }: { params: { id: string } }) {
  const [form, setForm] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('clubs').select('*').eq('id', params.id).single().then(({ data }) => {
      if (data) setForm({ name: data.name, slug: data.slug, plan: data.plan, is_active: data.is_active })
    })
  }, [params.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('clubs').update({
      name: form.name.trim(),
      slug: form.slug.trim(),
      plan: form.plan,
      is_active: form.is_active,
    }).eq('id', params.id)
    if (err) { setError(err.message); setLoading(false); return }
    window.location.href = '/dashboard/clubs'
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar este club? Esta acción no se puede deshacer.')) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('clubs').delete().eq('id', params.id)
    window.location.href = '/dashboard/clubs'
  }

  if (!form) return <div className="p-8 text-center text-gray-400">Cargando...</div>

  return (
    <div className="max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <a href="/dashboard/clubs" className="text-sm text-gray-500 hover:text-gray-700">← Clubes</a>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Editar club</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre del club *</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Slug (URL)</label>
          <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none font-mono" />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Plan</label>
          <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none">
            <option value="trial">Trial</option>
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="is_active" checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-brand-500" />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Club activo</label>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <a href="/dashboard/clubs"
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-center text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </a>
          <button type="submit" disabled={loading}
            className="flex-1 rounded-lg bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>

      <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4">
        <p className="mb-3 text-sm font-medium text-red-700">Zona peligrosa</p>
        <button onClick={handleDelete} disabled={deleting}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
          {deleting ? 'Eliminando...' : 'Eliminar club'}
        </button>
      </div>
    </div>
  )
}
