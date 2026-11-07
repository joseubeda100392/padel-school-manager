export const dynamic = 'force-dynamic'
export const maxDuration = 300
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from '@/lib/push'
import { sendEmail, INTERNAL_REPORT_TO, escapeHtml } from '@/lib/email'
import { loadClubMerchant, reconcileRedsysPayment, type ReconcileResult } from '@/lib/payment-reconcile'
import type { RedsysMerchant } from '@/lib/redsys-query'

// Cada 10 minutos: pregunta a Redsys por los pagos con tarjeta que siguen
// pendientes y los cierra (cobrado, rechazado o abandonado). Así un aviso de
// Redsys que no llega no deja al alumno como «no pagado».
const MIN_AGE_MS = 10 * 60 * 1000
const MAX_AGE_DAYS = 30
const BATCH = 100

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET ?? ''
  const authBuf = Buffer.from(req.headers.get('authorization') ?? '')
  const expBuf = Buffer.from(`Bearer ${cronSecret}`)
  return !!cronSecret && authBuf.length === expBuf.length && timingSafeEqual(authBuf, expBuf)
}

interface Line { payment: any; result: ReconcileResult }

function reportHtml(paid: Line[], review: Line[]): string {
  const row = ({ payment, result }: Line) =>
    `<li>${escapeHtml(payment.user?.name ?? payment.user_id)} · ${(payment.amount / 100).toFixed(2)} € · pedido ${escapeHtml(payment.redsys_order_id)} · ${escapeHtml(payment.created_at.slice(0, 16).replace('T', ' '))} UTC${result.detail ? ` · ${escapeHtml(result.detail)}` : ''}</li>`
  const block = (title: string, lines: Line[]) => (lines.length ? `<h3>${title}</h3><ul>${lines.map(row).join('')}</ul>` : '')
  return `<div style="font-family:sans-serif">
${block('Cobrados por Redsys sin aviso (ya aplicados en la app)', paid)}
${block('Cobrados que hay que revisar a mano', review)}
</div>`
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const now = new Date()
  // ?club=<id>: solo ese club (para probar en «Escuela - prueba» sin tocar los demás).
  const onlyClub = req.nextUrl.searchParams.get('club')
  if (onlyClub && !/^[0-9a-f-]{36}$/.test(onlyClub)) return NextResponse.json({ error: 'Club no válido' }, { status: 400 })
  let query = admin.from('payments')
    .select('id, user_id, club_id, type, status, amount, created_at, metadata, redsys_order_id, user:users(name)')
    .eq('status', 'pending')
    .not('redsys_order_id', 'is', null)
    .lt('created_at', new Date(now.getTime() - MIN_AGE_MS).toISOString())
    .gt('created_at', new Date(now.getTime() - MAX_AGE_DAYS * 86_400_000).toISOString())
  if (onlyClub) query = query.eq('club_id', onlyClub)
  const { data: pending, error } = await query.order('created_at').limit(BATCH)
  if (error) {
    console.error('[reconcile-payments] leer pagos pendientes:', error.message)
    return NextResponse.json({ error: 'Error al leer los pagos' }, { status: 500 })
  }

  // Los que ya se mandaron a revisar no se vuelven a consultar: el email ya salió.
  const todo = (pending ?? []).filter((p: any) => !p.metadata?.redsys_check?.review)
  const merchants = new Map<string, RedsysMerchant | null>()
  const lines: Line[] = []
  for (const payment of todo) {
    const key = payment.club_id ?? ''
    if (!merchants.has(key)) merchants.set(key, await loadClubMerchant(admin, payment.club_id).catch(() => null))
    const merchant = merchants.get(key)
    const result: ReconcileResult = merchant
      ? await reconcileRedsysPayment(admin, payment, merchant, now)
      : { action: 'error', detail: 'el club no tiene datos de Redsys' }
    lines.push({ payment, result })
  }

  const paid = lines.filter(l => l.result.action === 'paid')
  const review = lines.filter(l => l.result.action === 'review')
  const errors = lines.filter(l => l.result.action === 'error')

  if (paid.length) {
    await sendPushToUsers([...new Set(paid.map(l => l.payment.user_id))], {
      title: 'Pago confirmado',
      body: 'El banco ha confirmado tu pago. Ya lo tienes en «Mis pagos».',
      url: '/student/pagos',
    }, 'payment_succeeded').catch(e => console.error('[reconcile-payments] aviso al alumno:', e))
  }
  // Los errores van al resumen de errores del servidor (lib/error-alerts.ts), no
  // a este email: si Redsys cae, no llega un correo cada 10 minutos.
  if (errors.length) console.error('[reconcile-payments] errores al consultar a Redsys:', errors.map(l => `${l.payment.redsys_order_id}: ${l.result.detail}`))
  if (paid.length || review.length) {
    await sendEmail({
      to: INTERNAL_REPORT_TO,
      subject: `Pagos con tarjeta: ${paid.length} cobrados sin aviso de Redsys${review.length ? `, ${review.length} a revisar` : ''}`,
      html: reportHtml(paid, review),
    }).catch(e => console.error('[reconcile-payments] email:', e))
  }

  const summary: Record<string, number> = {}
  for (const l of lines) summary[l.result.action] = (summary[l.result.action] ?? 0) + 1
  return NextResponse.json({ ok: true, checked: lines.length, ...summary })
}
