'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  studentId: string
  currentBalance: number
}

export function BagAdjustForm({ studentId, currentBalance }: Props) {
  const router = useRouter()
  const [amount, setAmount] = useState(1)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function adjust(sign: 1 | -1) {
    setSaving(true)
    const supabase = createClient()
    const delta = amount * sign
    const newBalance = Math.max(0, currentBalance + delta)

    const { data: bag } = await supabase
      .from('class_bag')
      .update({ balance: newBalance })
      .eq('user_id', studentId)
      .select('id')
      .single()

    if (bag) {
      await supabase.from('bag_transactions').insert({
        user_id: studentId,
        class_bag_id: bag.id,
        delta,
        type: sign === 1 ? 'credit' : 'debit',
        reason: reason.trim() || (sign === 1 ? 'Recarga manual' : 'Descuento manual'),
      })
    }

    setSaving(false)
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          max={100}
          value={amount}
          onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
          className="w-20 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
        />
        <input
          type="text"
          placeholder="Motivo (opcional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => adjust(1)}
          disabled={saving}
          className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
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
