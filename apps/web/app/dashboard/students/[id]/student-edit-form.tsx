'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  student: { id: string; name: string; email: string; phone?: string; role: string; is_active: boolean }
}

export function StudentEditForm({ student }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: student.name ?? '',
    phone: student.phone ?? '',
    role: student.role ?? 'student',
    is_active: student.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSave() {
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('users').update({
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      role: form.role,
      is_active: form.is_active,
    }).eq('id', student.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => { setDone(false); router.refresh() }, 1500)
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar a ${student.name}? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('users').delete().eq('id', student.id)
    router.push('/dashboard/students')
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 font-semibold text-gray-900">Editar información</h2>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Teléfono</label>
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Opcional"
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Rol</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none">
            <option value="student">Alumno</option>
            <option value="coach">Monitor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="is_active_edit" checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-green-600" />
          <label htmlFor="is_active_edit" className="text-sm font-medium text-gray-700">Usuario activo</label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button onClick={handleSave} disabled={saving}
          className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">
          {saving ? 'Guardando...' : done ? '¡Guardado!' : 'Guardar cambios'}
        </button>
      </div>

      <div className="mt-6 border-t border-gray-100 pt-4">
        <button onClick={handleDelete} disabled={deleting}
          className="w-full rounded-lg bg-red-50 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-60">
          {deleting ? 'Eliminando...' : 'Eliminar usuario'}
        </button>
      </div>
    </div>
  )
}
