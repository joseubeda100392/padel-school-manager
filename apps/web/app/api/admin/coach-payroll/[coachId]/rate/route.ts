export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest, { params }: { params: { coachId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    hourlyRateCents: z.number().int().nonnegative(),
  }))
  if (badRequest) return badRequest

  const { data: coach } = await admin.from('users').select('club_id, role').eq('id', params.coachId).single()
  if (!coach || coach.role !== 'coach') return NextResponse.json({ error: 'Profesor no encontrado' }, { status: 404 })
  if (caller.role !== 'super_admin' && coach.club_id !== caller.club_id) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { error } = await admin.from('users').update({ hourly_rate_cents: body.hourlyRateCents }).eq('id', params.coachId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
