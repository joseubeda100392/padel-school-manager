'use client'

import { useState } from 'react'

interface Props {
  studentId: string
  balance60: number
  balance90: number
}

export function BagAdjustForm({ studentId, balance60, balance90 }: Props) {
  const [amount, setAmount] = useState<number | ''>(1)
  const [durationType, setDurationType] = useState<'60' | '90'>('60')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const currentBalance = durationType === '60' ? balance60 : balance90

  async function adjust(sign: 1 | -1) {
    const n = Math.max(1, Math.min(100, Number(amount) || 1))
    const msg = sign === 1
      ? `¿Añadir ${n} clase(s) de ${durationType} min a la bolsa?`
      : `¿Descontar ${n} clase(s) de ${durationType} min de la bolsa? Saldo actual: ${currentBalance}.`
    if (!confirm(msg)) return
    setSaving(true)
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

    setSaving(false)
    if (res.ok) {
      window.location.reload()
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select
          value={durationType}
          onChange={(e) => setDurationType(e.target.value as '60' | '90')}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          <option value="60">60 min</option>
          <option value="90">90 min</option>
        </select>
        <input
          type="number"
          min={1}
          max={100}
          value={amount}
          onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
          className="w-20 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <input
          type="text"
          placeholder="Motivo (opcional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => adjust(1)}
          disabled={saving}
          className="flex-1 rounded-lg bg-brand-500 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          + Añadir
        </button>
        <button
          onClick={() => adjust(-1)}
          disabled={saving || currentBalance === 0}
          className="flex-1 rounded-lg bg-red-50 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
        >
          − Descontar
        </button>
      </div>
    </div>
  )
}
