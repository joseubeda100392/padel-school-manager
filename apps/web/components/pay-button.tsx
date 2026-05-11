'use client'

import { useState } from 'react'

interface PayButtonProps {
  type: 'fixed_group_month' | 'class_pack' | 'single_class'
  enrollmentId?: string
  packType?: '60' | '90'
  scheduleId?: string
  exclusionId?: string
  label: string
  className?: string
  disabled?: boolean
}

export function PayButton({ type, enrollmentId, packType, scheduleId, exclusionId, label, className, disabled }: PayButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handlePay() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/payments/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, enrollmentId, packType, scheduleId, exclusionId }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Error al procesar el pago')
      setLoading(false)
      return
    }
    const params = new URLSearchParams({
      url: json.redsysUrl,
      Ds_MerchantParameters: json.merchantParameters,
      Ds_Signature: json.signature,
    })
    window.location.href = `/pay?${params.toString()}`
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
