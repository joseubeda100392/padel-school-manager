export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { checkOverlap, checkCoachOverlap } from '@/lib/schedule-overlap'

// "Arrancar grupo": un grupo en formación pasa a ser una clase normal. Sus
// interesados ('pending') pasan a alumnos del grupo ('active') con fecha de
// alta el día elegido, que es desde cuando se les cobra y la ven en su app.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }))
  if (badRequest) return badRequest

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: schedule } = await admin.from('schedules').select('id, club_id, is_active, max_students, court_id, coach_id, start_time, end_time, recurrence_end_date').eq('id', params.id).single()
  if (!schedule) return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })
  if (caller.role !== 'super_admin' && schedule.club_id !== caller.club_id) {
    return NextResponse.json({ error: 'Sin permisos sobre esta clase' }, { status: 403 })
  }
  if (schedule.is_active !== false) {
    return NextResponse.json({ error: 'Este grupo ya está en marcha' }, { status: 409 })
  }

  // Mientras estaba en formación no reservaba pista ni monitor: al arrancar
  // se comprueba que no choque con una clase que se haya creado entretanto.
  const [courtBusy, coachBusy] = await Promise.all([
    checkOverlap(admin, schedule.court_id, schedule.start_time, schedule.end_time, schedule.recurrence_end_date, schedule.id),
    checkCoachOverlap(admin, schedule.coach_id, schedule.start_time, schedule.end_time, schedule.recurrence_end_date, schedule.id),
  ])
  if (courtBusy) return NextResponse.json({ error: 'Ya hay otra clase en esa pista a esa hora. Cambia la pista u hora del grupo antes de arrancarlo.' }, { status: 409 })
  if (coachBusy) return NextResponse.json({ error: 'El monitor ya tiene otra clase a esa hora. Cambia el monitor u hora del grupo antes de arrancarlo.' }, { status: 409 })

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
  if (body.startDate < today) {
    return NextResponse.json({ error: 'La fecha de inicio no puede ser anterior a hoy' }, { status: 400 })
  }

  const { data: activated, error: enrErr } = await admin
    .from('group_enrollments')
    .update({ status: 'active', start_date: body.startDate, paid_until: null })
    .eq('schedule_id', params.id)
    .eq('status', 'pending')
    .select('id')
  if (enrErr) {
    console.error('[schedules/start] enrollments update failed:', enrErr.message)
    return NextResponse.json({ error: 'No se ha podido arrancar el grupo' }, { status: 500 })
  }

  const { error: schErr } = await admin.from('schedules').update({ is_active: true }).eq('id', params.id)
  if (schErr) {
    // Deshacer: que no queden alumnos activos en un grupo que sigue en formación.
    if (activated?.length) {
      await admin.from('group_enrollments').update({ status: 'pending', start_date: null }).in('id', activated.map(a => a.id))
    }
    console.error('[schedules/start] schedule update failed:', schErr.message)
    return NextResponse.json({ error: 'No se ha podido arrancar el grupo' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, students: activated?.length ?? 0 })
}
