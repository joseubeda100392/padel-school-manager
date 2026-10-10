'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { AuthCard } from '../auth-card'

export default function MfaPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = (data?.totp ?? []).filter(f => f.status === 'verified')
      if (verified.length > 0) setFactorId(verified[0].id)
      else window.location.replace('/login/mfa/enroll')
    })
    inputRef.current?.focus()
  }, [])

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId) return
    setLoading(true)
    setError('')

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError || !challengeData) {
      setError('Error al iniciar verificación')
      setLoading(false)
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: code.trim(),
    })

    if (verifyError) {
      setError('Código incorrecto')
      setCode('')
      setLoading(false)
      return
    }

    window.location.replace('/dashboard')
  }

  async function handleRecovery(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/recovery-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase() }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Código incorrecto o ya usado')
      setLoading(false)
      return
    }

    window.location.replace('/login/mfa/enroll')
  }

  return (
    <AuthCard
      title={useRecovery ? 'Código de recuperación' : 'Verificación en dos pasos'}
      description={
        useRecovery
          ? 'Introduce uno de tus códigos de recuperación'
          : 'Introduce el código de 6 dígitos de tu app de autenticación'
      }
    >
      <form onSubmit={useRecovery ? handleRecovery : handleTotp} className="space-y-4">
        <Field label={useRecovery ? 'Código de recuperación' : 'Código de 6 dígitos'}>
          <Input
            ref={inputRef}
            type="text"
            inputMode={useRecovery ? 'text' : 'numeric'}
            maxLength={useRecovery ? 19 : 6}
            value={code}
            onChange={(e) => setCode(useRecovery ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ''))}
            required
            autoComplete="one-time-code"
            className="h-14 text-center font-display text-title tabular-nums tracking-widest"
            placeholder={useRecovery ? 'XXXX-XXXX-XXXX-XXXX' : '000000'}
          />
        </Field>

        {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}

        <Button
          type="submit"
          size="lg"
          block
          loading={loading}
          disabled={useRecovery ? code.replace(/-/g, '').length !== 16 : code.length !== 6}
        >
          {loading ? 'Verificando...' : 'Verificar'}
        </Button>
      </form>

      <Button
        variant="ghost"
        block
        className="mt-3"
        onClick={() => { setUseRecovery(!useRecovery); setCode(''); setError('') }}
      >
        {useRecovery ? (
          <>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Usar código del autenticador
          </>
        ) : (
          'Usar código de recuperación'
        )}
      </Button>
    </AuthCard>
  )
}
