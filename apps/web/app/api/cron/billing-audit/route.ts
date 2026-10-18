export const dynamic = 'force-dynamic'
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from '@/lib/push'
import { findBillingDiscrepancies, type AuditClub, type BillingDiscrepancy } from '@/lib/billing-audit'

const REPORT_TO = ['joseubeda10@gmail.com']
const REPORT_FROM = 'ePadel School <notificaciones@epadelschool.com>'
const PAGE = 1000
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET ?? ''
  const authBuf = Buffer.from(req.headers.get('authorization') ?? '')
  const expBuf = Buffer.from(`Bearer ${cronSecret}`)
  return !!cronSecret && authBuf.length === expBuf.length && timingSafeEqual(authBuf, expBuf)
}

// Supabase devuelve como mucho 1000 filas por consulta: sin paginar, el
// informe se quedaría corto en silencio en cuanto haya más pagos.
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`

function reportHtml(items: BillingDiscrepancy[]): string {
  if (!items.length) {
    return '<p style="font-family:sans-serif">Comprobación semanal de cobros: todo cuadra. Ningún alumno consta como pagado más meses de los que ha pagado.</p>'
  }
  const rows = items.map(d => {
    const what = d.kind === 'cubierto_sin_pago'
      ? `Consta pagado sin pago registrado: <b>${d.months.map(monthLabel).join(', ')}</b>`
      : `Pago registrado que no se refleja en su cuota: <b>${d.months.map(monthLabel).join(', ')}</b>`
    return `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${escapeHtml(d.club_name)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${escapeHtml(d.student_name)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${what}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${d.paid_until ?? '—'}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${d.payments}</td>
    </tr>`
  }).join('')
  return `<div style="font-family:sans-serif;font-size:14px">
    <p>La comprobación semanal ha encontrado <b>${items.length}</b> descuadre${items.length === 1 ? '' : 's'} entre lo que la app da por pagado y los pagos registrados. No se ha cambiado ningún dato.</p>
    <table style="border-collapse:collapse">
      <tr style="background:#f5f5f5;text-align:left">
        <th style="padding:6px 10px">Club</th><th style="padding:6px 10px">Alumno</th><th style="padding:6px 10px">Qué pasa</th>
        <th style="padding:6px 10px">Pagado hasta</th><th style="padding:6px 10px">Pagos de cuota</th>
      </tr>${rows}
    </table>
  </div>`
}

async function sendReportEmail(items: BillingDiscrepancy[]): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('Falta RESEND_API_KEY')
  const subject = items.length
    ? `Cobros: ${items.length} descuadre${items.length === 1 ? '' : 's'} para revisar`
    : 'Cobros: todo cuadra'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: REPORT_FROM, to: REPORT_TO, subject, html: reportHtml(items) }),
  })
  if (!res.ok) throw new Error(`Resend respondió ${res.status}: ${await res.text()}`)
}

// Solo lee y avisa, nunca corrige: cada descuadre lo revisa una persona.
// Solo entran los clubs con el TPV en producción (los de prueba y demo tienen
// datos que no cuadran a propósito). ?dryRun=1 devuelve el informe sin
// avisar; ?always=1 manda el email aunque todo cuadre.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'
  const always = req.nextUrl.searchParams.get('always') === '1'
  const admin = getAdminClient()

  try {
    const clubRows = await fetchAll<{ id: string; name: string; config: { billing_start_date?: string } | null }>((from, to) =>
      admin.from('clubs').select('id, name, config').eq('is_active', true).eq('redsys_env', 'production').order('id').range(from, to))
    const clubs: Record<string, AuditClub> = Object.fromEntries(
      clubRows.map(c => [c.id, { name: c.name, billing_start_date: c.config?.billing_start_date ?? null }]),
    )
    const clubIds = Object.keys(clubs)
    if (!clubIds.length) return NextResponse.json({ ok: true, clubs: 0, discrepancies: [] })

    const enrollments = await fetchAll<any>((from, to) =>
      admin.from('group_enrollments')
        .select('id, student_id, club_id, start_date, enrolled_at, paid_until, monthly_price, student:users!group_enrollments_student_id_fkey(name)')
        .eq('status', 'active').in('club_id', clubIds).order('id').range(from, to))
    const payments = await fetchAll<any>((from, to) =>
      admin.from('payments')
        .select('id, user_id, club_id, created_at, metadata')
        .in('type', ['fixed_group_month', 'mandate_init', 'mandate_charge'])
        .eq('status', 'succeeded').in('club_id', clubIds).order('id').range(from, to))

    const discrepancies = findBillingDiscrepancies(
      enrollments.map(e => ({
        student_id: e.student_id,
        student_name: e.student?.name ?? 'Sin nombre',
        club_id: e.club_id,
        start_date: e.start_date,
        enrolled_at: e.enrolled_at,
        paid_until: e.paid_until,
        monthly_price: e.monthly_price,
      })),
      payments,
      clubs,
    )

    if (dryRun) return NextResponse.json({ ok: true, clubs: clubIds.length, discrepancies })

    let emailed = false
    if (discrepancies.length || always) {
      await sendReportEmail(discrepancies)
      emailed = true
    }

    if (discrepancies.length) {
      const { data: recipients } = await admin.from('users').select('id').eq('role', 'super_admin').in('email', REPORT_TO)
      const ids = (recipients ?? []).map(r => r.id)
      if (ids.length) {
        await sendPushToUsers(ids, {
          title: 'Cobros: descuadres para revisar',
          body: `${discrepancies.length} alumno${discrepancies.length === 1 ? '' : 's'} con el pago sin cuadrar. Detalle en tu email.`,
          url: '/dashboard/payments',
        }).catch(err => console.error('[billing-audit] push failed:', err))
      }
    }

    return NextResponse.json({ ok: true, clubs: clubIds.length, discrepancies: discrepancies.length, emailed })
  } catch (err) {
    console.error('[billing-audit] failed:', err)
    return NextResponse.json({ error: 'La comprobación de cobros ha fallado' }, { status: 500 })
  }
}
