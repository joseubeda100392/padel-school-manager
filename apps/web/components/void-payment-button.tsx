'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { formatCurrency } from '@/lib/utils'

// Botón "Anular" de un cobro apuntado en el club (efectivo o datáfono).
export function VoidPaymentButton({ paymentId, type, concept, amount, studentName }: {
  paymentId: string
  type: string
  concept: string
  amount: number
  studentName?: string | null
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)

  async function handleVoid() {
    const what = `${concept} · ${formatCurrency(amount)}${studentName ? ` · ${studentName}` : ''}`
    const ok = await confirm({
      title: '¿Anular este cobro?',
      description: `${what}. ${type === 'fixed_group_month'
        ? 'Ese mes volverá a quedar pendiente de pago'
        : 'El cargo volverá a quedar pendiente de pago'}, y el cobro dejará de sumar en Pagos. Úsalo solo si se apuntó por error y el dinero no se cobró.`,
      confirmLabel: 'Anular cobro',
      destructive: true,
    })
    if (!ok) return
    setBusy(true)
    const res = await fetch(`/api/admin/payments/${paymentId}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { toast.error(json.error ?? 'No se ha podido anular el cobro'); return }
    toast.success('Cobro anulado')
    router.refresh()
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleVoid} loading={busy}>
      <Undo2 className="h-4 w-4" aria-hidden />
      Anular
    </Button>
  )
}
