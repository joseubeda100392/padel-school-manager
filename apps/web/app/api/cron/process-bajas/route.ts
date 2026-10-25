export const dynamic = 'force-dynamic'
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { endEnrollment } from '@/lib/end-enrollment'

// Procesa las salidas programadas (Quitar con fecha, Causar baja, cambio de
// grupo programado, clase quitada desde un día): cada inscripción activa cuyo
// último día (end_date) ya ha pasado queda terminada, sin borrarla, para no
// perder el historial (ver lib/end-enrollment.ts). Si el alumno se queda sin
// ningún grupo activo, se le desactiva.
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
    .select('id, student_id, start_date, end_date')
    .eq('status', 'active')
    .not('end_date', 'is', null)
    .lt('end_date', todaySpain)

  if (!dueEnrollments?.length) {
    return NextResponse.json({ ok: true, processed: 0, deactivated: 0 })
  }

  let deactivated = 0
  for (const e of dueEnrollments) {
    const { data: before } = await admin.from('users').select('is_active').eq('id', e.student_id).single()
    await endEnrollment(admin, e, e.end_date as string, todaySpain)
    const { data: after } = await admin.from('users').select('is_active').eq('id', e.student_id).single()
    if (before?.is_active && !after?.is_active) deactivated++
  }

  return NextResponse.json({ ok: true, processed: dueEnrollments.length, deactivated })
}
