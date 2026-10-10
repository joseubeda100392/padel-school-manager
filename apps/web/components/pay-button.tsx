'use client'

import { Loader2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

import { useState } from 'react'

interface PayButtonProps {
  type: 'fixed_group_month' | 'class_pack' | 'private_lesson_pack' | 'single_class' | 'tournament' | 'intensivo_group'
  enrollmentId?: string
  // Adelantar la cuota del mes siguiente (solo type: 'fixed_group_month').
  advance?: boolean
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
  variant?: 'primary' | 'secondary'
  block?: boolean
  disabled?: boolean
  // El club todavía no tiene TPV propio configurado (o cobra en efectivo a
  // propósito): en vez del botón, se muestra un aviso — el servidor también
  // lo bloquea (create-order), esto es solo para no dejar al alumno
  // intentarlo a ciegas.
  cashOnly?: boolean
}

export function PayButton({ type, enrollmentId, advance, packType, privatePremium, scheduleId, bookingId, wholeClass, exclusionId, classDate, tournamentId, intensivoGroupId, classDates, label, className, variant = 'primary', block = false, disabled, cashOnly }: PayButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handlePay() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, enrollmentId, advance, packType, privatePremium, scheduleId, bookingId, wholeClass, exclusionId, classDate, tournamentId, intensivoGroupId, classDates }),
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
      <p className="rounded-control bg-surface-2 px-3 py-2.5 text-meta text-ink-2">
        El pago por la app aún no está disponible: paga en efectivo en el club.
      </p>
    )
  }

  return (
    <div className={block ? 'w-full' : undefined}>
      <button
        type="button"
        onClick={handlePay}
        disabled={loading || disabled}
        aria-busy={loading || undefined}
        className={className ?? buttonVariants({ variant, block })}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {loading ? 'Abriendo el pago seguro' : label}
      </button>
      {error && <p role="alert" className="mt-1.5 text-meta font-medium text-danger-ink">{error}</p>}
    </div>
  )
}
