import Link from 'next/link'
import { Receipt } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { isVoidedPayment } from '@/lib/payment-void'

// Abre el justificante de un pago (/ticket/[id]) en otra pestaña. No guarda
// nada: la página lo monta con los datos del pago. Solo para pagos cobrados o
// anulados (un pago con tarjeta sin terminar no tiene justificante).
export function TicketLink({ payment }: { payment: { id: string; status?: string | null; metadata?: Record<string, any> | null } }) {
  if (payment.status !== 'succeeded' && !isVoidedPayment(payment)) return null
  return (
    <Link href={`/ticket/${payment.id}`} target="_blank" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
      <Receipt className="h-4 w-4" aria-hidden />
      Ticket
    </Link>
  )
}
