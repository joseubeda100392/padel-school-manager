import type { SupabaseClient } from '@supabase/supabase-js'
import { queryRedsysOrder, type RedsysMerchant, type RedsysOrderStatus } from '@/lib/redsys-query'
import { settleRedsysPayment } from '@/lib/payment-settlement'

// Un pago a medias aún puede terminarse mientras dura la sesión de Redsys:
// pasado este tiempo sin terminar, se da por abandonado.
export const ABANDON_AFTER_MS = 2 * 60 * 60 * 1000

// Lo que se le dice al alumno: en este tiempo como mucho estará confirmado.
export const CONFIRMATION_MINUTES = 15

export type ReconcileAction =
  | 'paid'          // cobrado: se ha entregado lo pagado
  | 'denied'        // terminado sin cobro: queda fallido
  | 'abandoned'     // no lo terminó: queda fallido y marcado como abandonado
  | 'waiting'       // aún puede terminarlo: se vuelve a mirar más tarde
  | 'review'        // cobrado, pero hay que revisarlo a mano (José recibe un email)
  | 'error'         // la consulta o el apunte fallaron: se reintenta en la próxima pasada

export interface ReconcileResult {
  action: ReconcileAction
  detail: string | null
}

type Decision = 'settle' | 'abandon' | 'wait' | 'review'

export function decideReconcile(
  payment: { amount: number; type: string; created_at: string },
  status: RedsysOrderStatus,
  now: Date,
): { decision: Decision; detail: string | null } {
  // Los cobros de domiciliación los aplica su propio cron (charge-mandates),
  // no el aviso de Redsys: si uno se queda a medias, lo revisa José a mano.
  if (payment.type === 'mandate_charge') {
    const young = now.getTime() - new Date(payment.created_at).getTime() < ABANDON_AFTER_MS
    return young && status.outcome !== 'paid' && status.outcome !== 'denied'
      ? { decision: 'wait', detail: null }
      : { decision: 'review', detail: `cobro de domiciliación a medias (Redsys: ${status.outcome})` }
  }
  if (status.outcome === 'paid') {
    if (status.amount !== null && Number(status.amount) !== Number(payment.amount)) {
      return { decision: 'review', detail: `importe en Redsys ${status.amount} y en la app ${payment.amount}` }
    }
    // El alta de la domiciliación necesita el identificador de la tarjeta, que
    // solo llega en el aviso de Redsys: sin él no se puede activar.
    if (payment.type === 'mandate_init') return { decision: 'review', detail: 'alta de domiciliación cobrada sin aviso: falta el identificador de la tarjeta' }
    return { decision: 'settle', detail: null }
  }
  if (status.outcome === 'denied') return { decision: 'settle', detail: null }
  const age = now.getTime() - new Date(payment.created_at).getTime()
  return age >= ABANDON_AFTER_MS ? { decision: 'abandon', detail: null } : { decision: 'wait', detail: null }
}

export async function loadClubMerchant(admin: SupabaseClient, clubId: string | null): Promise<RedsysMerchant | null> {
  let merchant: RedsysMerchant = {
    merchantCode: process.env.REDSYS_MERCHANT_CODE ?? '',
    secretKey: process.env.REDSYS_SECRET_KEY ?? '',
    terminal: process.env.REDSYS_TERMINAL ?? '001',
    env: null,
  }
  if (clubId) {
    const { data: club, error } = await admin.from('clubs')
      .select('redsys_merchant_code, redsys_secret_key, redsys_merchant_terminal, redsys_env')
      .eq('id', clubId).single()
    if (error) throw new Error(`leer datos de Redsys del club: ${error.message}`)
    merchant = {
      merchantCode: club?.redsys_merchant_code || merchant.merchantCode,
      secretKey: club?.redsys_secret_key || merchant.secretKey,
      terminal: club?.redsys_merchant_terminal || merchant.terminal,
      env: club?.redsys_env ?? null,
    }
  }
  return merchant.merchantCode && merchant.secretKey ? merchant : null
}

// Pregunta a Redsys por un pago pendiente y lo cierra si ya hay respuesta.
// Repetible: si el aviso de Redsys llega a la vez, solo uno aplica los efectos.
export async function reconcileRedsysPayment(
  admin: SupabaseClient,
  payment: any,
  merchant: RedsysMerchant,
  now = new Date(),
): Promise<ReconcileResult> {
  if (payment.status !== 'pending' || !payment.redsys_order_id) return { action: 'waiting', detail: 'no está pendiente' }

  let status: RedsysOrderStatus
  try {
    status = await queryRedsysOrder(merchant, payment.redsys_order_id)
  } catch (e: any) {
    return { action: 'error', detail: e?.message ?? String(e) }
  }

  const { decision, detail } = decideReconcile(payment, status, now)
  const checkedAt = now.toISOString()

  if (decision === 'wait') return { action: 'waiting', detail: status.state }

  if (decision === 'review') {
    const { error } = await admin.from('payments')
      .update({ metadata: { ...(payment.metadata ?? {}), redsys_check: { at: checkedAt, outcome: status.outcome, state: status.state, review: detail } } })
      .eq('id', payment.id).eq('status', 'pending')
    if (error) return { action: 'error', detail: error.message }
    return { action: 'review', detail }
  }

  if (decision === 'abandon') {
    const { error } = await admin.from('payments')
      .update({
        status: 'failed',
        metadata: { ...(payment.metadata ?? {}), abandoned: true, redsys_check: { at: checkedAt, outcome: status.outcome, state: status.state } },
      })
      .eq('id', payment.id).eq('status', 'pending')
    if (error) return { action: 'error', detail: error.message }
    return { action: 'abandoned', detail: status.state ?? status.outcome }
  }

  const result = await settleRedsysPayment(admin, payment, {
    responseCode: status.responseCode ?? '9999',
    extraMetadata: { redsys_check: { at: checkedAt, outcome: status.outcome, state: status.state, settled_without_notice: true } },
  })
  if (result.status !== 200) return { action: 'error', detail: String(result.body.error ?? result.status) }
  if (result.body.already_processed) return { action: 'waiting', detail: 'ya lo había cerrado el aviso de Redsys' }
  return { action: status.outcome === 'paid' ? 'paid' : 'denied', detail: status.responseCode }
}
