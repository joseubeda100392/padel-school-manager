export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getClubFeatures } from '@/lib/get-club-features'
import { rateLimit } from '@/lib/rate-limit'
import { loadMandateItems, madridMonth } from '@/lib/mandate-charge'

// Día del mes en que se cobra el pago automático que activa el propio alumno.
const AUTO_PAY_DAY = 1
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const monthName = (yyyyMm: string) => MONTHS[Number(yyyyMm.slice(5, 7)) - 1]

async function getContext() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getAdminClient()
  const { data: profile } = await admin.from('users').select('club_id').eq('id', user.id).single()
  const clubId = (profile as any)?.club_id as string | null
  if (!clubId) return null
  const features = await getClubFeatures(clubId)
  const available = !!features.enable_payments && !features.cash_only_payments && !!features.enable_auto_pay
  return { userId: user.id, clubId, admin, available }
}

export async function GET() {
  const ctx = await getContext()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!ctx.available) return NextResponse.json({ available: false })
  const { admin, userId, clubId } = ctx

  const { data: mandates } = await admin
    .from('payment_mandates')
    .select('id, status, day_of_month, next_charge_at, amount_cents')
    .eq('user_id', userId)
    .eq('club_id', clubId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
  const mandate = mandates?.[0] ?? null

  const items = await loadMandateItems(admin, { userId, clubId, mode: 'init' })
  const { data: groups } = items.length
    ? await admin.from('group_enrollments').select('id, schedule:schedules(start_time, court:courts(name))').in('id', items.map(i => i.enrollment_id))
    : { data: [] }
  const dayFmt = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long' })
  const timeFmt = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' })
  const currentMonth = madridMonth()

  return NextResponse.json({
    available: true,
    mandate,
    preview: {
      amount: items.reduce((sum, i) => sum + i.amount, 0),
      currentMonthName: monthName(currentMonth),
      onlyNextMonth: items.length > 0 && items.every(i => i.paid_until.slice(0, 7) > currentMonth),
      day: AUTO_PAY_DAY,
      items: items.map(i => {
        const schedule = (groups ?? []).find((g: any) => g.id === i.enrollment_id)?.schedule as any
        const start = schedule?.start_time ? new Date(schedule.start_time) : null
        return {
          label: start ? `${dayFmt.format(start)} ${timeFmt.format(start)}${schedule?.court?.name ? ` · ${schedule.court.name}` : ''}` : 'Grupo',
          month: monthName(i.paid_until.slice(0, 7)),
          amount: i.amount,
        }
      }),
    },
  })
}

// Crea el pago automático del propio alumno. La tarjeta se mete después en
// la página segura de Redsys (/pay/mandate/[id]), que es donde se calcula y
// cobra el primer importe.
export async function POST(req: NextRequest) {
  const ctx = await getContext()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!ctx.available) return NextResponse.json({ error: 'Tu club no tiene activado el pago automático con tarjeta' }, { status: 400 })
  const limited = rateLimit(req, `student-mandate:${ctx.userId}`, { limit: 5, windowMs: 10 * 60 * 1000 })
  if (limited) return limited
  const { admin, userId, clubId } = ctx

  const items = await loadMandateItems(admin, { userId, clubId, mode: 'init' })
  const amountCents = items.reduce((sum, i) => sum + i.amount, 0)
  if (!items.length || amountCents <= 0) {
    return NextResponse.json({ error: 'No tienes ninguna cuota de grupo que cobrar' }, { status: 400 })
  }

  await admin
    .from('payment_mandates')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('club_id', clubId)
    .in('status', ['pending_auth', 'active', 'paused'])

  const { data: mandate, error } = await admin
    .from('payment_mandates')
    .insert({ user_id: userId, club_id: clubId, amount_cents: amountCents, day_of_month: AUTO_PAY_DAY, status: 'pending_auth' })
    .select('id')
    .single()
  if (error || !mandate) return NextResponse.json({ error: 'No se pudo activar el pago automático' }, { status: 500 })

  return NextResponse.json({ mandateId: mandate.id })
}

export async function DELETE() {
  const ctx = await getContext()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { error } = await ctx.admin
    .from('payment_mandates')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', ctx.userId)
    .eq('club_id', ctx.clubId)
    .in('status', ['pending_auth', 'active', 'paused'])
  if (error) return NextResponse.json({ error: 'No se pudo cancelar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
