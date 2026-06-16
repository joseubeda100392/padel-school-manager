'use client'

import { useState } from 'react'

interface PayButtonProps {
  type: 'fixed_group_month' | 'class_pack' | 'single_class' | 'tournament' | 'intensivo_group'
  enrollmentId?: string
  packType?: '60' | '90'
  scheduleId?: string
  exclusionId?: string
  classDate?: string
  tournamentId?: string
  intensivoGroupId?: string
  classDates?: string[]
  label: string
  className?: string
  disabled?: boolean
}

export function PayButton({ type, enrollmentId, packType, scheduleId, exclusionId, classDate, tournamentId, intensivoGroupId, classDates, label, className, disabled }: PayButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handlePay() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, enrollmentId, packType, scheduleId, exclusionId, classDate, tournamentId, intensivoGroupId, classDates }),
      })

      let json: any
      try {
        json = await res.json()
      } catch {
        setError('Error del servidor. Inténtalo de nuevo.')
        setLoading(false)
        return
      }

      if (!res.ok) {
        setError(json.error ?? 'Error al procesar el pago')
        setLoading(false)
        return
      }

      const form = document.createElement('form')
      form.method = 'POST'
      form.action = json.redsysUrl

      const fields = {
        Ds_SignatureVersion: 'HMAC_SHA256_V1',
        Ds_MerchantParameters: json.merchantParameters,
        Ds_Signature: json.signature,
      }
      for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = name
        input.value = value
        form.appendChild(input)
      }

      document.body.appendChild(form)
      form.submit()
    } catch (err: any) {
      setError('Error de conexión. Inténtalo de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handlePay}
        disabled={loading || disabled}
        className={className}
      >
        {loading ? 'Procesando...' : label}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
