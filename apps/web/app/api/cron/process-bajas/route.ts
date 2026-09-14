export const dynamic = 'force-dynamic'
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

// Procesa las bajas programadas por el botón "Causar baja": cualquier
// group_enrollment activo con end_date <= hoy se quita de verdad (mismo
// borrado que el botón "Quitar" manual: schedule_exclusions primero, luego
// la propia inscripción — nunca un cambio de status). Si tras eso el alumno
// se queda sin ninguna clase fija activa, se desactiva (users.is_active =
// false), que es lo que de verdad lo saca de pagos pendientes y de aforo en
// todos los sitios.
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET ?? ''
  const authHeader = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${cronSecret}`
  const authBuf = Buffer.from(authHeader)
  const expBuf = Buffer.from(expected)
  if (!cronSecret || authBuf.length !== expBuf.length || !timingSafeEqual(authBuf, expBuf)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = getAdminClient()
  const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())

  const { data: dueEnrollments } = await admin
    .from('group_enrollments')
    .select('id, student_id')
    .eq('status', 'active')
    .not('end_date', 'is', null)
    .lte('end_date', todaySpain)

  if (!dueEnrollments?.length) {
    return NextResponse.json({ ok: true, processed: 0, deactivated: 0 })
  }

  const enrollmentIds = dueEnrollments.map(e => e.id)
  const studentIds = [...new Set(dueEnrollments.map(e => e.student_id))]

  await admin.from('schedule_exclusions').delete().in('group_enrollment_id', enrollmentIds)
  await admin.from('group_enrollments').delete().in('id', enrollmentIds)

  let deactivated = 0
  for (const studentId of studentIds) {
    const { count } = await admin
      .from('group_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('status', 'active')
    if ((count ?? 0) === 0) {
      await admin.from('users').update({ is_active: false }).eq('id', studentId)
      deactivated++
    }
  }

  return NextResponse.json({ ok: true, processed: dueEnrollments.length, deactivated })
}
