'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Check, Trash2 } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { useConfirm } from '@/components/ui/confirm'

interface Props {
  student: { id: string; name: string; email: string; phone?: string; role: string; is_active: boolean; start_date?: string; end_date?: string; also_student?: boolean; is_external?: boolean; is_premium_private_coach?: boolean }
  isSuperAdmin?: boolean
  enablePrivateLessons?: boolean
}

export function StudentEditForm({ student, isSuperAdmin = false, enablePrivateLessons = false }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [form, setForm] = useState({
    name: student.name ?? '',
    phone: student.phone ?? '',
    role: student.role ?? 'student',
    is_active: student.is_active ?? true,
    start_date: student.start_date ?? '',
    end_date: student.end_date ?? '',
    also_student: student.also_student ?? false,
    is_external: student.is_external ?? false,
    is_premium_private_coach: student.is_premium_private_coach ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const [newEmail, setNewEmail] = useState(student.email ?? '')
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailDone, setEmailDone] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordDone, setPasswordDone] = useState(false)

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
      also_student: form.role === 'coach' ? form.also_student : false,
      is_external: form.role === 'student' ? form.is_external : false,
      is_premium_private_coach: form.role === 'coach' ? form.is_premium_private_coach : false,
    }).eq('id', student.id)
    if (!err && !student.is_active && form.is_active) {
      // Se acaba de reactivar: levantar el bloqueo de acceso (requiere service role)
      await fetch(`/api/admin/students/${student.id}/reactivate`, { method: 'POST' }).catch(() => {})
    }
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

  async function handleChangePassword() {
    if (newPassword.length < 6) { setPasswordError('Mínimo 6 caracteres'); return }
    setSavingPassword(true)
    setPasswordError('')
    const res = await fetch('/api/admin/update-user-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: student.id, password: newPassword }),
    })
    const json = await res.json()
    setSavingPassword(false)
    if (!res.ok) { setPasswordError(json.error ?? 'Error al cambiar la contraseña'); return }
    setPasswordDone(true)
    setNewPassword('')
    setTimeout(() => setPasswordDone(false), 2000)
  }

  async function handleDelete() {
    const confirmed = await confirm(
      isSuperAdmin
        ? {
            title: `¿Eliminar a ${student.name}?`,
            description: 'Se borra de forma permanente su historial de reservas, pagos y bolsa. Esta acción no se puede deshacer.',
            confirmLabel: 'Eliminar usuario',
            destructive: true,
          }
        : {
            title: `¿Desactivar a ${student.name}?`,
            description: 'No podrá entrar en la app, pero su historial (reservas, pagos, bolsa) se conserva y puedes reactivarlo cuando quieras.',
            confirmLabel: 'Desactivar usuario',
            destructive: true,
          },
    )
    if (!confirmed) return
    setDeleting(true)
    const res = await fetch(`/api/admin/students/${student.id}`, { method: 'DELETE' })
    if (res.ok) {
      window.location.href = '/dashboard/students'
    } else {
      const json = await res.json().catch(() => ({}))
      const msg = json.error ?? (isSuperAdmin ? 'Error al eliminar usuario' : 'Error al desactivar usuario')
      toast.error(msg)
      setDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Editar información" />
      <CardBody className="space-y-5">
        <Field label="Nombre">
          <Input type="text" autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Teléfono (opcional)">
          <Input type="tel" inputMode="tel" autoComplete="off" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Rol">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="student">Alumno</option>
            <option value="coach">Monitor</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
        {form.role === 'coach' && (
          <CheckRow id="also_student_edit" checked={form.also_student}
            onChange={(v) => setForm({ ...form, also_student: v })}
            label="También es alumno"
            hint="Puede entrar también al panel de alumno, apuntarse a clases y tener cuota." />
        )}
        {enablePrivateLessons && form.role === 'coach' && (
          <CheckRow id="is_premium_private_coach_edit" checked={form.is_premium_private_coach}
            onChange={(v) => setForm({ ...form, is_premium_private_coach: v })}
            label="Tarifa particular premium"
            hint="Sus clases particulares cobran el precio premium configurado en Tarifas." />
        )}
        {enablePrivateLessons && form.role === 'student' && (
          <CheckRow id="is_external_edit" checked={form.is_external}
            onChange={(v) => setForm({ ...form, is_external: v })}
            label="Alumno externo"
            hint="Paga las tarifas de externo y no ve los huecos libres de las clases fijas de la escuela." />
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Fecha de alta">
            <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </Field>
          <Field label="Fecha de baja">
            <Input type="date" value={form.end_date} min={form.start_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </Field>
        </div>
        <CheckRow id="is_active_edit" checked={form.is_active}
          onChange={(v) => setForm({ ...form, is_active: v, end_date: v ? '' : form.end_date })}
          label="Usuario activo" />

        {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}

        <Button onClick={handleSave} loading={saving} block>
          {done && <Check className="h-4 w-4" aria-hidden />}
          {saving ? 'Guardando cambios' : done ? 'Cambios guardados' : 'Guardar cambios'}
        </Button>

        <div className="border-t border-line pt-5">
          <h3 className="text-label text-ink">Cambiar email</h3>
          <p className="mb-3 mt-0.5 text-meta text-ink-3">El cambio es inmediato: no requiere confirmación por correo.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <Field label="Nuevo email" className="flex-1">
              <Input type="email" inputMode="email" autoComplete="off" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                placeholder="nuevo@email.com" />
            </Field>
            <Button variant="secondary" onClick={handleChangeEmail} loading={savingEmail} className="sm:mt-[26px]">
              {emailDone && <Check className="h-4 w-4" aria-hidden />}
              {emailDone ? 'Email cambiado' : 'Cambiar email'}
            </Button>
          </div>
          {emailError && <p role="alert" className="mt-2 text-meta font-medium text-danger-ink">{emailError}</p>}
        </div>

        <div className="border-t border-line pt-5">
          <h3 className="text-label text-ink">Cambiar contraseña</h3>
          <p className="mb-3 mt-0.5 text-meta text-ink-3">Se le pedirá elegir una contraseña propia la próxima vez que entre.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <Field label="Nueva contraseña" className="flex-1">
              <Input type="text" autoComplete="off" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres" />
            </Field>
            <Button variant="secondary" onClick={handleChangePassword} loading={savingPassword} className="sm:mt-[26px]">
              {passwordDone && <Check className="h-4 w-4" aria-hidden />}
              {passwordDone ? 'Contraseña cambiada' : 'Cambiar contraseña'}
            </Button>
          </div>
          {passwordError && <p role="alert" className="mt-2 text-meta font-medium text-danger-ink">{passwordError}</p>}
        </div>

        <div className="border-t border-line pt-5">
          <Button variant="danger-ghost" onClick={handleDelete} loading={deleting} block>
            <Trash2 className="h-4 w-4" aria-hidden />
            {deleting
              ? (isSuperAdmin ? 'Eliminando usuario' : 'Desactivando usuario')
              : (isSuperAdmin ? 'Eliminar usuario' : 'Desactivar usuario')}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

function CheckRow({ id, checked, onChange, label, hint }: {
  id: string
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-line-strong accent-accent-ink"
      />
      <label htmlFor={id} className="text-label text-ink">
        {label}
        {hint && <span className="mt-0.5 block text-meta font-normal text-ink-3">{hint}</span>}
      </label>
    </div>
  )
}
