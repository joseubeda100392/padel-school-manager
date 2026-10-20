'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button, buttonVariants } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Notice } from '@/components/ui/feedback'
import { AuthCard } from '../auth-card'

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false)
  const [linkError, setLinkError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlError = params.get('error_code')
    if (urlError) {
      setLinkError(urlError === 'otp_expired'
        ? 'El enlace ha caducado. Solicita uno nuevo.'
        : 'El enlace no es válido. Solicita uno nuevo.')
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/update-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Error al guardar la contraseña')
      setLoading(false)
      return
    }
    setDone(true)
    setTimeout(() => { window.location.replace('/login') }, 2000)
  }

  if (linkError) {
    return (
      <AuthCard title="Enlace no válido">
        <div className="space-y-4">
          <Notice tone="danger" icon={<TriangleAlert />}>{linkError}</Notice>
          <Link href="/login/forgot-password" className={buttonVariants({ size: 'lg', block: true })}>
            Solicitar nuevo enlace
          </Link>
        </div>
      </AuthCard>
    )
  }

  if (!ready) {
    return (
      <AuthCard title="Nueva contraseña">
        <p role="status" className="text-center text-body text-ink-2">Verificando enlace...</p>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Nueva contraseña">
      {done ? (
        <Notice tone="success" icon={<CircleCheck />}>
          Contraseña actualizada. Redirigiendo al inicio de sesión...
        </Notice>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nueva contraseña" hint="Mínimo 6 caracteres">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              minLength={6}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirmar contraseña">
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </Field>

          {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}

          <Button type="submit" size="lg" block loading={loading}>
            {loading ? 'Guardando...' : 'Guardar contraseña'}
          </Button>
        </form>
      )}
    </AuthCard>
  )
}
