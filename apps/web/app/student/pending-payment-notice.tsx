import { Clock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { CONFIRMATION_MINUTES } from '@/lib/payment-reconcile'

// Pago que Redsys dio por bueno pero cuya confirmación aún no ha llegado: se
// le dice al alumno que no tiene que hacer nada, para que no pague dos veces
// ni escriba al club.
export function PendingPaymentNotice({ amounts }: { amounts: number[] }) {
  if (!amounts.length) return null
  const what = amounts.length === 1
    ? `tu pago de ${formatCurrency(amounts[0], 'EUR')}`
    : `tus ${amounts.length} pagos`
  return (
    <div role="status" className="mx-auto mb-6 flex w-full max-w-3xl items-start gap-3 rounded-lg bg-warn-soft px-4 py-3 text-warn-ink">
      <Clock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <p className="text-body">
        Estamos confirmando {what} con el banco. En unos {CONFIRMATION_MINUTES} minutos como mucho lo verás en «Mis pagos».
        No hace falta que vuelvas a pagar ni que avises al club.
      </p>
    </div>
  )
}
