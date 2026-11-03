export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { loadAppFee, madridToday, pendingAppFeeMonths, recentlyNotifiedMonths } from '@/lib/app-fee'
import { escapeHtml, sendEmail } from '@/lib/email'
import { monthsLabel } from '@/lib/payment-concept'
import { formatCurrency } from '@/lib/utils'

// Buzón de contacto de ePadel School, el mismo de las solicitudes de demo de la web.
const NOTIFY_TO = ['contacto@epadelschool.com']

// El admin del club avisa de que ha hecho la transferencia de los meses pendientes.
// Solo deja constancia (notified_at); la cuota la da por pagada el super admin.
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id, name, email').eq('id', user.id).single()
  if (caller?.role !== 'admin' || !caller.club_id) {
    return NextResponse.json({ error: 'Solo el admin del club puede avisar del pago' }, { status: 403 })
  }

  const { plan, records } = await loadAppFee(admin, caller.club_id)
  if (!plan) return NextResponse.json({ error: 'Tu club no tiene cuota de la app' }, { status: 400 })
  const today = madridToday()
  const months = pendingAppFeeMonths(plan, records, today)
  if (!months.length) return NextResponse.json({ ok: true, months: [] })
  const alreadyNotified = recentlyNotifiedMonths(records, today)
  if (months.every(m => alreadyNotified.has(m))) return NextResponse.json({ ok: true, months })

  const now = new Date().toISOString()
  const { error } = await admin.from('app_fee_payments').upsert(
    months.map(m => ({ club_id: caller.club_id, month: `${m}-01`, notified_at: now })),
    { onConflict: 'club_id,month' },
  )
  if (error) {
    console.error('[app-fee] aviso de transferencia', caller.club_id, error)
    return NextResponse.json({ error: 'No se pudo guardar el aviso. Inténtalo de nuevo.' }, { status: 500 })
  }

  // El aviso ya está guardado y se ve en Clubes: si el correo falla no se le
  // muestra error al club, solo queda en el log.
  const { data: club } = await admin.from('clubs').select('name').eq('id', caller.club_id).single()
  const clubName = club?.name ?? caller.club_id
  const label = monthsLabel(months)
  const total = formatCurrency(Math.round(Number(plan.amount) * months.length * 100))
  await sendEmail({
    to: NOTIFY_TO,
    subject: `${clubName} dice que ha transferido la cuota (${label}, ${total})`,
    html: `<p><b>${escapeHtml(clubName)}</b> ha pulsado «Ya he hecho la transferencia».</p>
<p>Meses: ${escapeHtml(label)}<br>Importe: ${escapeHtml(total)}<br>Avisó: ${escapeHtml(caller.name ?? '')} (${escapeHtml(caller.email ?? '')})</p>
<p>Cuando llegue al banco, márcala como pagada en <a href="https://epadelschool.app/dashboard/clubs">Clubes → Cuota de la app</a>.</p>`,
  }).catch(e => console.error('[app-fee] correo de aviso', caller.club_id, e))

  return NextResponse.json({ ok: true, months })
}
