import { getAuthUser } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { loadClubMerchant, reconcileRedsysPayment, CONFIRMATION_MINUTES } from '@/lib/payment-reconcile'
import { ResultScreen } from './result-screen'
import { AutoRefresh } from './auto-refresh'

const ORDER_RE = /^[0-9A-Za-z]{4,12}$/
const BACK = { href: '/student', label: 'Volver a la app' }

type Outcome = 'paid' | 'failed' | 'pending' | 'unknown'

// Al volver de Redsys no se espera a su aviso: se le pregunta directamente por
// el pedido. Solo el dueño del pago puede consultarlo.
async function checkOrder(order: string | undefined, returnedOk: boolean): Promise<Outcome> {
  if (!order || !ORDER_RE.test(order)) return 'unknown'
  const user = await getAuthUser()
  if (!user) return 'unknown'

  const admin = getAdminClient()
  const { data: payment, error } = await admin.from('payments')
    .select('id, user_id, club_id, type, status, amount, created_at, metadata, redsys_order_id')
    .eq('redsys_order_id', order).maybeSingle()
  if (error) console.error('[pay/return] leer pago:', error.message)
  if (!payment || payment.user_id !== user.id) return 'unknown'
  if (payment.status === 'succeeded') return 'paid'
  if (payment.status !== 'pending') return 'failed'

  // Redsys solo manda a la página de «pago correcto» si lo autorizó: mientras
  // llega la confirmación, el alumno ve en la app que su pago se está confirmando.
  const current = returnedOk && !payment.metadata?.returned_ok
    ? { ...payment, metadata: { ...(payment.metadata ?? {}), returned_ok: true } }
    : payment
  if (current !== payment) {
    const { error: markErr } = await admin.from('payments')
      .update({ metadata: current.metadata }).eq('id', payment.id).eq('status', 'pending')
    if (markErr) console.error('[pay/return] marcar vuelta correcta:', markErr.message)
  }

  try {
    const merchant = await loadClubMerchant(admin, payment.club_id)
    if (!merchant) return 'pending'
    const result = await reconcileRedsysPayment(admin, current, merchant)
    if (result.action === 'error') console.error('[pay/return] consulta a Redsys:', order, result.detail)
    if (result.action === 'paid') return 'paid'
    if (result.action === 'denied' || result.action === 'abandoned') return 'failed'
  } catch (e) {
    console.error('[pay/return] consulta a Redsys:', order, e)
  }
  return 'pending'
}

export async function PaymentReturn({ order, fallback }: { order?: string; fallback: 'success' | 'error' }) {
  const outcome = await checkOrder(order, fallback === 'success')

  if (outcome === 'paid' || (outcome === 'unknown' && fallback === 'success')) {
    return <ResultScreen tone="success" title="Pago completado" description="Tu pago se ha procesado correctamente." action={BACK} />
  }
  if (outcome === 'pending') {
    return (
      <>
        <AutoRefresh />
        <ResultScreen
          tone="pending"
          title="Estamos confirmando tu pago"
          description={`El banco aún no nos ha dado la confirmación. En unos ${CONFIRMATION_MINUTES} minutos como mucho lo verás en «Mis pagos» y te avisaremos. No hace falta que vuelvas a pagar ni que avises al club.`}
          action={BACK}
        />
      </>
    )
  }
  return <ResultScreen tone="danger" title="No se ha completado el pago" description="No se ha cobrado nada. Vuelve a la app e inténtalo de nuevo." action={BACK} />
}
