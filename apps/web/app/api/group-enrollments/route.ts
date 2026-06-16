export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    scheduleId: z.string().uuid(),
    studentId: z.string().uuid(),
    monthlyPrice: z.number().nonnegative().optional(),
  }))
  if (badRequest) return badRequest
  const { scheduleId, studentId, monthlyPrice } = body

  const admin = getAdminClient()

  const { data: adminUser } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const [{ data: schedule }, { data: student }, { data: existingEnrollments }] = await Promise.all([
    admin.from('schedules').select('level_id').eq('id', scheduleId).single(),
    admin.from('users').select('current_level_id').eq('id', studentId).single(),
    admin.from('group_enrollments')
      .select('student:users!group_enrollments_student_id_fkey(current_level_id)')
      .eq('schedule_id', scheduleId)
      .eq('status', 'active'),
  ])

  // level_id on schedule takes priority; if absent, infer from already-enrolled students
  const enrolledLevels = [...new Set(
    (existingEnrollments ?? []).map((e: any) => e.student?.current_level_id).filter(Boolean)
  )]
  const effectiveLevelId: string | null = schedule?.level_id ?? (enrolledLevels.length === 1 ? enrolledLevels[0] : null)

  if (effectiveLevelId && student?.current_level_id !== effectiveLevelId) {
    return NextResponse.json({ error: 'El nivel del alumno no coincide con el nivel de la clase' }, { status: 400 })
  }

  const { data, error } = await admin.from('group_enrollments').upsert({
    schedule_id: scheduleId,
    student_id: studentId,
    club_id: adminUser.club_id,
    monthly_price: monthlyPrice ?? 0,
    status: 'active',
    enrolled_by: user.id,
    enrolled_at: new Date().toISOString(),
    paid_until: null,
  }, { onConflict: 'schedule_id,student_id' }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Cancelar reservas puntuales futuras del alumno en esta clase (ya no las necesita)
  const today = new Date().toISOString().split('T')[0]
  await admin
    .from('bookings')
    .delete()
    .eq('schedule_id', scheduleId)
    .eq('student_id', studentId)
    .eq('source', 'admin')
    .gte('class_date', today)

  return NextResponse.json({ data })
}
