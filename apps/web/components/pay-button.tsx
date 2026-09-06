'use client'

import { useState } from 'react'

interface PayButtonProps {
  type: 'fixed_group_month' | 'class_pack' | 'private_lesson_pack' | 'single_class' | 'tournament' | 'intensivo_group'
  enrollmentId?: string
  packType?: '60' | '90'
  // Bono de clase particular: comprar la tarifa de monitor premium en vez
  // de la general.
  privatePremium?: boolean
  scheduleId?: string
  // Pagar una reserva ya creada (ej. clase particular asignada por el admin,
  // en estado 'pending') en vez de crear una nueva al confirmar el pago.
  bookingId?: string
  wholeClass?: boolean
  exclusionId?: string
  classDate?: string
  tournamentId?: string
  intensivoGroupId?: string
  classDates?: string[]
  label: string
  className?: string
  disabled?: boolean
  // El club todavía no tiene TPV propio configurado (o cobra en efectivo a
  // propósito): en vez del botón, se muestra un aviso — el servidor también
  // lo bloquea (create-order), esto es solo para no dejar al alumno
  // intentarlo a ciegas.
  cashOnly?: boolean
}

export function PayButton({ type, enrollmentId, packType, privatePremium, scheduleId, bookingId, wholeClass, exclusionId, classDate, tournamentId, intensivoGroupId, classDates, label, className, disabled, cashOnly }: PayButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handlePay() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, enrollmentId, packType, privatePremium, scheduleId, bookingId, wholeClass, exclusionId, classDate, tournamentId, intensivoGroupId, classDates }),
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

  if (cashOnly) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
        💵 Pago por app no disponible todavía — paga en efectivo en el club.
      </p>
    )
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
