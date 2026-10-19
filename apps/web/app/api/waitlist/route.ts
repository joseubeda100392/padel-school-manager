export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { parseClubFeatures } from '@/lib/get-club-features'
import { getHolidaySet, HOLIDAY_ERROR } from '@/lib/club-holidays'
import { canTakeSpot, parseLowerLevelMap } from '@/lib/spot-levels'
import { getDayOfWeek, getScheduleDateTimeInMadrid } from '@/lib/utils'
import { WAITLIST_MAX, getClassOccupancy, isWaitlistable } from '@/lib/waitlist'

const TZ = 'Europe/Madrid'
const madridDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)

// Apuntarse en reserva para una clase concreta en una fecha.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const limited = rateLimit(req, `waitlist:${user.id}`, { limit: 20, windowMs: 10 * 60 * 1000 })
  if (limited) return limited

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    scheduleId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }))
  if (badRequest) return badRequest
  const { scheduleId, date } = body

  const admin = getAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('role, club_id, current_level_id, is_external, club:clubs(features, config)')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'student' || (profile as any).is_external === true) {
    return NextResponse.json({ error: 'Solo los alumnos de la escuela pueden apuntarse en reserva' }, { status: 403 })
  }
  const features = parseClubFeatures((profile as any).club?.features)
  if (!features.enable_waitlist || !features.enable_spots) {
    return NextResponse.json({ error: 'Las reservas en espera no están activadas en tu club' }, { status: 403 })
  }
  const config = (profile as any).club?.config ?? {}

  const { data: schedule } = await admin
    .from('schedules')
    .select('id, club_id, level_id, type, is_private, max_students, start_time, end_time, recurrence_end_date')
    .eq('id', scheduleId)
    .single()
  if (!schedule || schedule.club_id !== profile.club_id) {
    return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })
  }
  if ((schedule as any).is_private || schedule.type === 'intensivo') {
    return NextResponse.json({ error: 'En esta clase no se puede reservar' }, { status: 400 })
  }
  if (!canTakeSpot(profile.current_level_id, schedule.level_id, parseLowerLevelMap(config))) {
    return NextResponse.json({ error: 'Esta clase no es de tu nivel' }, { status: 403 })
  }

  // La fecha tiene que ser un día real de esa clase, futuro y sin festivo.
  const today = madridDate(new Date())
  if (getDayOfWeek(date + 'T12:00:00Z') !== getDayOfWeek(schedule.start_time)) {
    return NextResponse.json({ error: 'La fecha no corresponde al día de la clase' }, { status: 400 })
  }
  if (date < madridDate(new Date(schedule.start_time)) || ((schedule as any).recurrence_end_date && date > (schedule as any).recurrence_end_date)) {
    return NextResponse.json({ error: 'Esa fecha no tiene clase' }, { status: 400 })
  }
  if (getHolidaySet(config).has(date)) return NextResponse.json({ error: HOLIDAY_ERROR }, { status: 400 })
  if (getScheduleDateTimeInMadrid(schedule.start_time, date).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'Esa clase ya ha empezado' }, { status: 400 })
  }
  const advanceMonths = (config.falta_advance_months ?? 0) > 0 ? config.falta_advance_months : 2
  const [ty, tm, td] = today.split('-').map(Number)
  const maxDate = madridDate(new Date(Date.UTC(ty, tm - 1 + advanceMonths, td, 12)))
  if (date > maxDate) return NextResponse.json({ error: 'Esa fecha está demasiado lejos' }, { status: 400 })

  const occupancy = await getClassOccupancy(admin, scheduleId, date, schedule.max_students)
  if (occupancy.fixedStudentIds.has(user.id) || occupancy.bookedStudentIds.has(user.id)) {
    return NextResponse.json({ error: 'Ya estás en esta clase ese día' }, { status: 409 })
  }
  if (occupancy.presentFixed + occupancy.bookedCount < occupancy.capacity) {
    return NextResponse.json({ error: 'Esta clase tiene hueco libre: cógelo directamente en Huecos' }, { status: 409 })
  }
  if (!isWaitlistable(occupancy)) {
    return NextResponse.json({ error: 'En esta clase no se puede reservar: van todos los alumnos fijos' }, { status: 409 })
  }

  // Para entrar solo hay que poder descontarle 1 clase de la bolsa.
  const durationMin = Math.round((new Date(schedule.end_time).getTime() - new Date(schedule.start_time).getTime()) / 60000)
  const { data: bag } = await admin.from('class_bag').select('balance_60, balance_90').eq('user_id', user.id).maybeSingle()
  const hasBalance = durationMin >= 80
    ? (bag?.balance_90 ?? 0) > 0
    : ((bag?.balance_60 ?? 0) > 0 || (bag?.balance_90 ?? 0) > 0)
  if (!hasBalance) {
    return NextResponse.json({ error: 'Necesitas al menos 1 clase en tu bolsa para apuntarte en reserva' }, { status: 400 })
  }

  const { data: rpc, error } = await admin.rpc('join_class_waitlist', {
    p_schedule_id: scheduleId,
    p_class_date: date,
    p_student_id: user.id,
    p_max_waiting: WAITLIST_MAX,
  })
  if (error || !rpc) {
    console.error('[waitlist] join failed:', error?.message)
    return NextResponse.json({ error: 'No se ha podido apuntarte en reserva' }, { status: 500 })
  }
  if (rpc.error) return NextResponse.json({ error: rpc.error }, { status: 409 })

  return NextResponse.json({ ok: true, id: rpc.id, position: rpc.position })
}

// Quitarse de la reserva.
export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: body, error: badRequest } = await parseBody(req, z.object({ id: z.string().uuid() }))
  if (badRequest) return badRequest

  const admin = getAdminClient()
  const { data, error } = await admin
    .from('class_waitlist')
    .update({ status: 'left', updated_at: new Date().toISOString() })
    .eq('id', body.id)
    .eq('student_id', user.id)
    .eq('status', 'waiting')
    .select('id')
  if (error) return NextResponse.json({ error: 'No se ha podido quitar la reserva' }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Esa reserva ya no está activa' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
