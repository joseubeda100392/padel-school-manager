export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { parseClubFeatures } from '@/lib/get-club-features'
import { canCollectFees } from '@/lib/cashier'

// Marcar si un alumno ha pagado la fianza (módulo «Fianza» del club). Lo usa
// la Caja del cobrador; vale también para un admin de ese club.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !canCollectFees(caller.role) || caller.role === 'super_admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    studentId: z.string().uuid(),
    paid: z.boolean(),
  }))
  if (badRequest) return badRequest

  const { data: student } = await admin.from('users').select('club_id, role, also_student').eq('id', body.studentId).single()
  if (!student || !caller.club_id || student.club_id !== caller.club_id) {
    return NextResponse.json({ error: 'Sin permisos para este alumno' }, { status: 403 })
  }
  if (student.role !== 'student' && !student.also_student) {
    return NextResponse.json({ error: 'Solo los alumnos tienen fianza' }, { status: 400 })
  }

  const { data: club } = await admin.from('clubs').select('features').eq('id', caller.club_id).single()
  if (!parseClubFeatures(club?.features).enable_deposit) {
    return NextResponse.json({ error: 'El club no tiene activada la fianza' }, { status: 400 })
  }

  const { error } = await admin.from('users').update({ deposit_paid: body.paid }).eq('id', body.studentId)
  if (error) {
    console.error('[caja/deposit] update failed:', error.message)
    return NextResponse.json({ error: 'No se pudo guardar la fianza' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, paid: body.paid })
}
