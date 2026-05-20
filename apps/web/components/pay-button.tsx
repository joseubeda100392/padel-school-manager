'use client'

import { useState, useEffect } from 'react'

interface PayButtonProps {
  type: 'fixed_group_month' | 'class_pack' | 'single_class'
  enrollmentId?: string
  packId?: string
  packType?: '60' | '90'  // legacy — prefer packId
  scheduleId?: string
  exclusionId?: string
  classDate?: string
  label: string
  className?: string
  style?: React.CSSProperties
  disabled?: boolean
}

export function PayButton({ type, enrollmentId, packId, packType, scheduleId, exclusionId, classDate, label, className, style, disabled }: PayButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Reset loading when user navigates back (bfcache restore)
  useEffect(() => {
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) setLoading(false)
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  async function handlePay() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/payments/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, enrollmentId, packId, packType, scheduleId, exclusionId, classDate }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Error al procesar el pago')
      setLoading(false)
      return
    }

    // Submit directly to Redsys — avoids base64 corruption through URL query params
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
  }

  return (
    <div className={className?.includes('w-full') ? 'w-full' : undefined}>
      <button
        onClick={handlePay}
        disabled={loading || disabled}
        className={className}
        style={style}
      >
        {loading ? 'Procesando...' : label}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
