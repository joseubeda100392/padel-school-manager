'use client'

import { useState } from 'react'
import { CircleCheck, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/feedback'
import { useConfirm } from '@/components/ui/confirm'

export function ResetMfaButton({ userId }: { userId: string }) {
  const confirm = useConfirm()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleReset() {
    const ok = await confirm({
      title: '¿Resetear el MFA de este usuario?',
      description: 'Deberá registrar de nuevo su autenticador en el próximo inicio de sesión.',
      confirmLabel: 'Resetear MFA',
      destructive: true,
    })
    if (!ok) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/reset-mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Error al resetear MFA')
    } else {
      setDone(true)
    }
    setLoading(false)
  }

  if (done) {
    return (
      <Notice tone="success" icon={<CircleCheck />}>
        MFA reseteado. El usuario deberá registrar su autenticador en el próximo inicio de sesión.
      </Notice>
    )
  }

  return (
    <div>
      <Button variant="danger-ghost" onClick={handleReset} loading={loading} className="border border-danger-ink/30">
        <ShieldOff className="h-4 w-4" aria-hidden />
        {loading ? 'Reseteando MFA' : 'Resetear MFA'}
      </Button>
      {error && <p role="alert" className="mt-2 text-meta font-medium text-danger-ink">{error}</p>}
    </div>
  )
}
