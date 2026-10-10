'use client'

import { useState } from 'react'
import { CircleCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Notice } from '@/components/ui/feedback'
import { AuthCard, BackToLogin } from '../auth-card'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/login/reset-password`,
    })
    setSent(true)
    setLoading(false)
  }

  return (
    <AuthCard title="Recuperar contraseña" description="Te enviaremos un enlace para crear una nueva contraseña">
      {sent ? (
        <div className="space-y-4">
          <Notice tone="success" icon={<CircleCheck />}>
            Si el email existe, recibirás un enlace en breve. Revisa también la carpeta de spam.
          </Notice>
          <BackToLogin />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Email">
            <Input
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              placeholder="tu@email.com"
            />
          </Field>

          <Button type="submit" size="lg" block loading={loading}>
            {loading ? 'Enviando...' : 'Enviar enlace'}
          </Button>

          <BackToLogin />
        </form>
      )}
    </AuthCard>
  )
}
