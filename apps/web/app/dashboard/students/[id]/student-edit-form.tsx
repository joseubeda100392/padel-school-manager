'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  student: { id: string; name: string; email: string; phone?: string; role: string; is_active: boolean; start_date?: string; end_date?: string }
}

export function StudentEditForm({ student }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: student.name ?? '',
    phone: student.phone ?? '',
    role: student.role ?? 'student',
    is_active: student.is_active ?? true,
    start_date: student.start_date ?? '',
    end_date: student.end_date ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const [newEmail, setNewEmail] = useState(student.email ?? '')
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailDone, setEmailDone] = useState(false)

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
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    }).eq('id', student.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => { setDone(false); router.refresh() }, 1500)
  }

  async function handleChangeEmail() {
    const email = newEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) { setEmailError('Email no válido'); return }
    if (email === student.email) { setEmailError('El email es el mismo que el actual'); return }
    setSavingEmail(true)
    setEmailError('')
    const res = await fetch('/api/admin/update-user-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: student.id, email }),
    })
    const json = await res.json()
    setSavingEmail(false)
    if (!res.ok) { setEmailError(json.error ?? 'Error al cambiar email'); return }
    setEmailDone(true)
    setTimeout(() => { setEmailDone(false); router.refresh() }, 2000)
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar a ${student.name}? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('users').delete().eq('id', student.id)
    window.location.href = '/dashboard/students'
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 font-semibold text-gray-900">Editar información</h2>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Teléfono</label>
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Opcional"
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Rol</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none">
            <option value="student">Alumno</option>
            <option value="coach">Monitor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Fecha de alta</label>
            <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Fecha de baja</label>
            <input type="date" value={form.end_date} min={form.start_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="is_active_edit" checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-brand-500" />
          <label htmlFor="is_active_edit" className="text-sm font-medium text-gray-700">Usuario activo</label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button onClick={handleSave} disabled={saving}
          className="w-full rounded-lg bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
          {saving ? 'Guardando...' : done ? '¡Guardado!' : 'Guardar cambios'}
        </button>
      </div>

      {/* Cambio de email separado */}
      <div className="mt-6 border-t border-gray-100 pt-5">
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Cambiar email</h3>
        <p className="mb-3 text-xs text-gray-400">
          El cambio es inmediato — no requiere confirmación por correo.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="nuevo@email.com"
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
          <button
            onClick={handleChangeEmail}
            disabled={savingEmail}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
          >
            {savingEmail ? '...' : emailDone ? '¡Listo!' : 'Cambiar email'}
          </button>
        </div>
        {emailError && <p className="mt-2 text-sm text-red-600">{emailError}</p>}
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
