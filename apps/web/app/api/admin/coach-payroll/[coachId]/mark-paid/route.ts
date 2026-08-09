export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { calculateCoachPending } from '@/lib/coach-payroll'

export async function POST(_req: NextRequest, { params }: { params: { coachId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const cookieStore = cookies()
  const clubId = caller.role === 'super_admin'
    ? (cookieStore.get('sa_active_club')?.value ?? caller.club_id)
    : caller.club_id
  if (!clubId) return NextResponse.json({ error: 'Sin club asignado' }, { status: 400 })

  const { data: coach } = await admin.from('users').select('club_id, role').eq('id', params.coachId).single()
  if (!coach || coach.role !== 'coach') return NextResponse.json({ error: 'Profesor no encontrado' }, { status: 404 })
  if (caller.role !== 'super_admin' && coach.club_id !== clubId) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  // Recalculado en servidor, no se confía en ningún importe mandado por el cliente.
  const pending = await calculateCoachPending(admin, params.coachId, clubId)
  if (pending.sessionCount === 0) {
    return NextResponse.json({ error: 'No hay horas pendientes de pagar' }, { status: 400 })
  }
  if (!pending.hourlyRateCents) {
    return NextResponse.json({ error: 'Este profesor no tiene tarifa por hora configurada' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]

  const { error } = await admin.from('coach_payouts').insert({
    coach_id: params.coachId,
    club_id: clubId,
    period_start: pending.periodStart ?? today,
    period_end: today,
    hours: pending.hours,
    amount_cents: pending.amountCents,
    marked_paid_by: user.id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, hours: pending.hours, amountCents: pending.amountCents })
}
