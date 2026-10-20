'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Notice } from '@/components/ui/feedback'

export function PasswordChangeGate({ clubName }: { clubName: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      // Usar el cliente del browser para mantener la sesión activa
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError('Error al actualizar la contraseña.')
        setLoading(false)
        return
      }

      // Limpiar el flag en la BD
      await fetch('/api/auth/clear-password-flag', { method: 'POST' })

      window.location.replace('/student')
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <img src="/icon.svg" alt="" width={40} height={40} className="h-10 w-10 rounded-xl" />
        <p className="mt-4 text-meta text-ink-3">{clubName}</p>
        <h1 className="mt-0.5 font-display text-title text-ink">Elige tu contraseña</h1>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          <p className="text-body text-ink-2">
            Has accedido con una contraseña temporal. Elige una contraseña personal para continuar.
          </p>

          <Field label="Nueva contraseña" hint="Mínimo 6 caracteres.">
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="Repite la contraseña">
            <Input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>

          {error && <Notice tone="danger">{error}</Notice>}

          <Button type="submit" loading={loading} size="lg" block>
            Guardar contraseña y entrar
          </Button>
        </form>
      </Card>
    </main>
  )
}
