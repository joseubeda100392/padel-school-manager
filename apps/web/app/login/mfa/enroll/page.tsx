'use client'

import { useEffect, useState } from 'react'
import QRCode from 'react-qr-code'
import { Check, TriangleAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Notice } from '@/components/ui/feedback'
import { AuthCard } from '../../auth-card'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  const raw = Array.from(array, b => chars[b % chars.length]).join('')
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`
}

export default function MfaEnrollPage() {
  const [phase, setPhase] = useState<'qr' | 'codes'>('qr')
  const [factorId, setFactorId] = useState('')
  const [uri, setUri] = useState('')
  const [secret, setSecret] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'ePadel School' }).then(({ data, error }) => {
      if (error || !data) return
      setFactorId(data.id)
      setUri(data.totp.uri)
      setSecret(data.totp.secret)
    })
  }, [])

  async function handleVerify(e: React.FormEvent) {
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
      code: verifyCode.trim(),
    })

    if (verifyError) {
      setError('Código incorrecto, inténtalo de nuevo')
      setVerifyCode('')
      setLoading(false)
      return
    }

    const codes = Array.from({ length: 10 }, generateCode)
    setRecoveryCodes(codes)

    const saveRes = await fetch('/api/auth/recovery-code/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes: codes.map(c => c.replace(/-/g, '')) }),
    })

    if (!saveRes.ok) {
      setError('Error al guardar los códigos de recuperación. Inténtalo de nuevo.')
      setLoading(false)
      return
    }

    setPhase('codes')
    setLoading(false)
  }

  async function handleCopyAll() {
    await navigator.clipboard.writeText(recoveryCodes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (phase === 'codes') {
    return (
      <AuthCard title="Códigos de recuperación" description="Guárdalos en un lugar seguro. Solo los verás ahora.">
        <div className="space-y-4">
          <Notice tone="warn" icon={<TriangleAlert />}>
            Si pierdes el móvil, estos códigos son tu única forma de acceder. Cada código solo funciona una vez.
          </Notice>

          <div className="rounded-control border border-line bg-surface-2 p-4">
            <ul className="space-y-1.5">
              {recoveryCodes.map((code, i) => (
                <li key={i} className="font-mono text-body tabular-nums tracking-widest text-ink">{code}</li>
              ))}
            </ul>
          </div>

          <Button type="button" variant="secondary" block onClick={handleCopyAll}>
            {copied && <Check className="h-4 w-4" aria-hidden />}
            {copied ? 'Copiados' : 'Copiar todos'}
          </Button>

          <Button type="button" size="lg" block onClick={() => { window.location.replace('/dashboard') }}>
            He guardado mis códigos, entrar
          </Button>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Configurar autenticador"
      description="Escanea el código QR con Google Authenticator, Authy u otra app TOTP"
    >
      {uri ? (
        <div className="mb-6 flex justify-center rounded-card border border-line bg-white p-4">
          <QRCode value={uri} size={180} bgColor="#FFFFFF" fgColor="#000000" />
        </div>
      ) : (
        <div className="mb-6 flex h-48 items-center justify-center rounded-card bg-surface-2">
          <p role="status" className="text-meta text-ink-3">Cargando código QR...</p>
        </div>
      )}

      {secret && (
        <details className="mb-4">
          <summary className="min-h-11 cursor-pointer py-2.5 text-meta text-ink-2 hover:text-ink">
            ¿No puedes escanear el QR? Introduce el código a mano
          </summary>
          <p className="mt-2 break-all rounded-control bg-surface-2 px-3 py-2 font-mono text-meta text-ink">{secret}</p>
        </details>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <Field label="Código de verificación">
          <Input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
            required
            autoComplete="one-time-code"
            autoFocus
            className="h-14 text-center font-display text-title tabular-nums tracking-widest"
            placeholder="000000"
          />
        </Field>

        {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}

        <Button type="submit" size="lg" block loading={loading} disabled={verifyCode.length !== 6}>
          {loading ? 'Verificando...' : 'Confirmar y activar 2FA'}
        </Button>
      </form>
    </AuthCard>
  )
}
