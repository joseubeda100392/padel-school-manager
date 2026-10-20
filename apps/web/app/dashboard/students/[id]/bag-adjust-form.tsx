'use client'

import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { useConfirm } from '@/components/ui/confirm'

interface Props {
  studentId: string
  balance60: number
  balance90: number
}

export function BagAdjustForm({ studentId, balance60, balance90 }: Props) {
  const confirm = useConfirm()
  const [amount, setAmount] = useState<number | ''>(1)
  const [durationType, setDurationType] = useState<'60' | '90'>('60')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const currentBalance = durationType === '60' ? balance60 : balance90

  async function adjust(sign: 1 | -1) {
    const n = Math.max(1, Math.min(100, Number(amount) || 1))
    const ok = await confirm(
      sign === 1
        ? {
            title: `¿Añadir ${n} clase(s) de ${durationType} min?`,
            description: 'Se sumarán a la bolsa del alumno.',
            confirmLabel: 'Añadir clases',
          }
        : {
            title: `¿Descontar ${n} clase(s) de ${durationType} min?`,
            description: `Se restarán de la bolsa del alumno. Saldo actual: ${currentBalance}.`,
            confirmLabel: 'Descontar clases',
            destructive: true,
          },
    )
    if (!ok) return
    setSaving(true)
    setError('')
    const delta = n * sign

    const res = await fetch('/api/admin/students/bag-adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: studentId,
        delta60: durationType === '60' ? delta : undefined,
        delta90: durationType === '90' ? delta : undefined,
        reason: reason.trim() || undefined,
      }),
    })

    if (res.ok) {
      window.location.reload()
      return
    }

    setSaving(false)
    const json = await res.json().catch(() => null)
    setError(json?.error ?? `Error al ajustar la bolsa (${res.status})`)
  }

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duración">
          <Select value={durationType} onChange={(e) => setDurationType(e.target.value as '60' | '90')}>
            <option value="60">60 min</option>
            <option value="90">90 min</option>
          </Select>
        </Field>
        <Field label="Cantidad">
          <Input
            type="text"
            inputMode="numeric"
            onFocus={e => e.target.select()}
            value={amount}
            onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
            className="tabular-nums"
          />
        </Field>
      </div>
      <Field label="Motivo (opcional)">
        <Input type="text" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => adjust(1)} disabled={saving} className="flex-1">
          <Plus className="h-4 w-4" aria-hidden />
          Añadir
        </Button>
        <Button variant="secondary" onClick={() => adjust(-1)} disabled={saving || currentBalance === 0} className="flex-1">
          <Minus className="h-4 w-4" aria-hidden />
          Descontar
        </Button>
      </div>
    </div>
  )
}
