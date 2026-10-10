'use client'

import { useState } from 'react'
import { CircleCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/feedback'

export function PasswordForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError('No se ha podido cambiar la contraseña. Revisa tu conexión y vuelve a intentarlo.')
      return
    }

    setSuccess(true)
    setPassword('')
    setConfirm('')
  }

  return (
    <Card>
      <CardHeader title="Contraseña" description="Mínimo 6 caracteres." />
      <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-5">
        <Field label="Nueva contraseña">
          <Input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
        </Field>
        <Field label="Repite la contraseña" error={error || undefined}>
          <Input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
        </Field>
        {success && <Notice tone="success" icon={<CircleCheck />}>Contraseña cambiada.</Notice>}
        <Button type="submit" loading={loading} disabled={!password} block className="sm:w-auto">
          Cambiar contraseña
        </Button>
      </form>
    </Card>
  )
}
