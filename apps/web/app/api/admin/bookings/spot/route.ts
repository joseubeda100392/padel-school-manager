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

  const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!caller || !['admin', 'coach', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    scheduleId: z.string().uuid(),
    studentId: z.string().uuid(),
    classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    clubId: z.string().uuid().nullable().optional(),
  }))
  if (badRequest) return badRequest
  const { scheduleId, studentId, classDate, clubId } = body

  const admin = getAdminClient()

  // Overlap check
  const { data: newSched } = await admin.from('schedules').select('start_time, end_time').eq('id', scheduleId).single()
  if (newSched) {
    const { data: existing } = await admin
      .from('bookings')
      .select('schedule_id, schedules(start_time, end_time)')
      .eq('student_id', studentId)
      .eq('class_date', classDate)
      .neq('status', 'cancelled')
      .neq('schedule_id', scheduleId)

    const nStart = new Date(newSched.start_time)
    const nEnd = new Date(newSched.end_time)
    const nStartMin = nStart.getUTCHours() * 60 + nStart.getUTCMinutes()
    const nEndMin = nEnd.getUTCHours() * 60 + nEnd.getUTCMinutes()

    for (const b of existing ?? []) {
      const s = (b as any).schedules
      if (!s) continue
      const sStartMin = new Date(s.start_time).getUTCHours() * 60 + new Date(s.start_time).getUTCMinutes()
      const sEndMin = new Date(s.end_time).getUTCHours() * 60 + new Date(s.end_time).getUTCMinutes()
      if (sStartMin < nEndMin && sEndMin > nStartMin) {
        return NextResponse.json({ error: 'Este alumno ya tiene una clase en ese horario' }, { status: 409 })
      }
    }
  }

  const [{ data: inGroup }, { data: existingBooking }] = await Promise.all([
    admin
      .from('group_enrollments')
      .select('id')
      .eq('schedule_id', scheduleId)
      .eq('student_id', studentId)
      .eq('status', 'active')
      .maybeSingle(),
    admin
      .from('bookings')
      .select('id')
      .eq('schedule_id', scheduleId)
      .eq('student_id', studentId)
      .eq('class_date', classDate)
      .neq('status', 'cancelled')
      .maybeSingle(),
  ])

  if (inGroup) {
    return NextResponse.json(
      { error: 'Este alumno ya está en el grupo fijo de esta clase' },
      { status: 409 }
    )
  }

  if (existingBooking) {
    return NextResponse.json(
      { error: 'Este alumno ya tiene una reserva para esta fecha' },
      { status: 409 }
    )
  }

  // Limpiar fila cancelada previa si existe (legacy antes de borrado directo)
  await admin
    .from('bookings')
    .delete()
    .eq('schedule_id', scheduleId)
    .eq('student_id', studentId)
    .eq('class_date', classDate)
    .eq('status', 'cancelled')

  const { data, error } = await admin
    .from('bookings')
    .insert({
      schedule_id: scheduleId,
      student_id: studentId,
      status: 'confirmed',
      source: 'admin',
      class_date: classDate,
      club_id: clubId ?? null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Este alumno ya tiene una reserva para esta fecha' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, bookingId: data.id })
}
