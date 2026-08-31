export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formatTime } from '@/lib/utils'
import { currentBillingMonth } from '@/lib/billing-cycle'

const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret')
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Mes de facturación efectivo, no el de calendario — a menos de 5 días de
  // fin de mes ya se considera el mes siguiente (ver lib/billing-cycle.ts).
  const billing = currentBillingMonth()
  const endOfMonth = new Date(billing.year, billing.month0 + 1, 0).toISOString().split('T')[0]
  const targetMonthStart = new Date(billing.year, billing.month0, 1).toISOString().split('T')[0]
  const monthName = MONTH_NAMES[billing.month0]
  const year = billing.year

  // Alumnos con grupo fijo activo y cuota pendiente del mes de facturación
  // actual — solo si ya les toca facturar ese mes (start_date), para no
  // reclamar una cuota de un mes en el que la clase no ha dado ni una sesión.
  const { data: enrollments } = await adminSupabase
    .from('group_enrollments')
    .select('id, monthly_price, start_date, student:users!group_enrollments_student_id_fkey(id, name, push_token), schedule:schedules(start_time)')
    .eq('status', 'active')
    .lte('start_date', targetMonthStart)
    .or(`paid_until.is.null,paid_until.lt.${endOfMonth}`)

  if (!enrollments?.length) return NextResponse.json({ ok: true, sent: 0 })

  const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

  const messages = enrollments
    .filter((e: any) => e.student?.push_token)
    .map((e: any) => {
      const start = new Date(e.schedule?.start_time)
      const day = days[start.getDay()]
      const hour = formatTime(start)
      const price = (e.monthly_price / 100).toFixed(2)
      return {
        to: e.student.push_token,
        title: `Cuota de ${monthName} pendiente`,
        body: `Tu grupo del ${day} ${hour} · ${price}€. Paga desde la app para reservar tu plaza.`,
        sound: 'default',
        data: { enrollmentId: e.id, type: 'monthly_fee' },
      }
    })

  let sent = 0
  for (let i = 0; i < messages.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    })
    sent += messages.slice(i, i + 100).length
  }

  return NextResponse.json({ ok: true, sent, month: `${monthName} ${year}` })
}
