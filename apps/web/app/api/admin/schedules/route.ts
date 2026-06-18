export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

const scheduleSchema = z.object({
  court_id: z.string().uuid(),
  coach_id: z.string().uuid(),
  level_id: z.string().uuid().nullable().optional(),
  start_time: z.string(),
  end_time: z.string(),
  recurrence: z.enum(['none', 'weekly', 'biweekly']),
  recurrence_end_date: z.string().nullable().optional(),
  max_students: z.number().int().min(1).max(20),
  is_active: z.boolean().optional(),
  club_id: z.string().uuid().nullable().optional(),
  type: z.enum(['regular', 'intensivo']).optional(),
  price_cents: z.number().int().min(0).nullable().optional(),
  intensivo_group_id: z.string().uuid().nullable().optional(),
})

function toMinutes(iso: string) {
  const d = new Date(iso)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

function overlaps(startTime: string, endTime: string, existing: { start_time: string; end_time: string }[]) {
  const dow = new Date(startTime).getUTCDay()
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  return existing.some(s =>
    new Date(s.start_time).getUTCDay() === dow &&
    start < toMinutes(s.end_time) &&
    end > toMinutes(s.start_time)
  )
}

async function checkOverlap(admin: ReturnType<typeof getAdminClient>, courtId: string, startTime: string, endTime: string, excludeId?: string) {
  const query = admin.from('schedules').select('id, start_time, end_time').eq('court_id', courtId).eq('is_active', true)
  const { data } = await (excludeId ? query.neq('id', excludeId) : query)
  return overlaps(startTime, endTime, data ?? [])
}

async function checkCoachOverlap(admin: ReturnType<typeof getAdminClient>, coachId: string, startTime: string, endTime: string, excludeId?: string) {
  const query = admin.from('schedules').select('id, start_time, end_time').eq('coach_id', coachId).eq('is_active', true)
  const { data } = await (excludeId ? query.neq('id', excludeId) : query)
  return overlaps(startTime, endTime, data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: body, error: badRequest } = await parseBody(req, scheduleSchema)
  if (badRequest) return badRequest

  const [courtBusy, coachBusy] = await Promise.all([
    checkOverlap(admin, body.court_id, body.start_time, body.end_time),
    checkCoachOverlap(admin, body.coach_id, body.start_time, body.end_time),
  ])
  if (courtBusy) return NextResponse.json({ error: 'Ya existe una clase activa en esa pista a esa hora.' }, { status: 409 })
  if (coachBusy) return NextResponse.json({ error: 'El monitor ya tiene otra clase a esa hora.' }, { status: 409 })

  const cookieStore = cookies()
  const effectiveClubId = caller.role === 'super_admin'
    ? (cookieStore.get('sa_active_club')?.value ?? caller.club_id ?? null)
    : caller.club_id

  const { data, error } = await admin.from('schedules').insert({
    court_id: body.court_id,
    coach_id: body.coach_id,
    level_id: body.level_id ?? null,
    start_time: body.start_time,
    end_time: body.end_time,
    recurrence: body.recurrence,
    recurrence_end_date: body.recurrence_end_date ?? null,
    max_students: body.max_students,
    is_active: true,
    club_id: effectiveClubId,
    type: body.type ?? 'regular',
    price_cents: body.price_cents ?? null,
    intensivo_group_id: body.intensivo_group_id ?? null,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: body, error: badRequest } = await parseBody(req, scheduleSchema.extend({
    id: z.string().uuid(),
  }))
  if (badRequest) return badRequest

  if (caller.role !== 'super_admin') {
    const { data: existing } = await admin.from('schedules').select('club_id').eq('id', body.id).single()
    if (!existing || existing.club_id !== caller.club_id) {
      return NextResponse.json({ error: 'Sin permisos para editar este horario' }, { status: 403 })
    }
  }

  const [courtBusy, coachBusy] = await Promise.all([
    checkOverlap(admin, body.court_id, body.start_time, body.end_time, body.id),
    checkCoachOverlap(admin, body.coach_id, body.start_time, body.end_time, body.id),
  ])
  if (courtBusy) return NextResponse.json({ error: 'Ya existe una clase activa en esa pista a esa hora.' }, { status: 409 })
  if (coachBusy) return NextResponse.json({ error: 'El monitor ya tiene otra clase a esa hora.' }, { status: 409 })

  const { error } = await admin.from('schedules').update({
    court_id: body.court_id,
    coach_id: body.coach_id,
    level_id: body.level_id ?? null,
    start_time: body.start_time,
    end_time: body.end_time,
    recurrence: body.recurrence,
    recurrence_end_date: body.recurrence_end_date ?? null,
    max_students: body.max_students,
    is_active: body.is_active ?? true,
    type: body.type ?? 'regular',
    price_cents: body.price_cents ?? null,
  }).eq('id', body.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { scheduleId } = await req.json()
  if (!scheduleId) return NextResponse.json({ error: 'scheduleId requerido' }, { status: 400 })

  if (caller.role !== 'super_admin') {
    const { data: existing } = await admin.from('schedules').select('club_id').eq('id', scheduleId).single()
    if (!existing || existing.club_id !== caller.club_id) {
      return NextResponse.json({ error: 'Sin permisos para borrar este horario' }, { status: 403 })
    }
  }

  await admin.from('group_enrollments').delete().eq('schedule_id', scheduleId)
  await admin.from('bookings').delete().eq('schedule_id', scheduleId)
  await admin.from('schedules').delete().eq('id', scheduleId)

  return NextResponse.json({ ok: true })
}
