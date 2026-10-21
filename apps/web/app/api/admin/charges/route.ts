export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from '@/lib/push'
import { formatCurrency } from '@/lib/utils'

// Cargo suelto a un alumno de tu club (p. ej. la cuota de un grupo que ya ha
// dejado). Le llega un aviso y lo ve como pendiente en Mis clases.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    studentId: z.string().uuid(),
    concept: z.string().trim().min(2).max(120),
    amountCents: z.number().int().positive().max(1_000_000),
  }))
  if (badRequest) return badRequest

  const { data: student } = await admin.from('users').select('club_id, role').eq('id', body.studentId).single()
  if (!student?.club_id || (caller.role !== 'super_admin' && student.club_id !== caller.club_id)) {
    return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 })
  }

  const { data: charge, error } = await admin
    .from('student_charges')
    .insert({ club_id: student.club_id, student_id: body.studentId, concept: body.concept, amount_cents: body.amountCents, created_by: user.id })
    .select('id')
    .single()
  if (error || !charge) {
    console.error('[charges] insert failed:', error?.message)
    return NextResponse.json({ error: 'No se ha podido crear el cargo' }, { status: 500 })
  }

  await sendPushToUsers([body.studentId], {
    title: '💳 Tienes un pago pendiente',
    body: `${body.concept}: ${formatCurrency(body.amountCents)}. Lo puedes ver en Mis clases.`,
    url: '/student/schedule',
  }, 'payment_reminder').catch(err => console.error('[charges] push failed:', err))

  return NextResponse.json({ ok: true, id: charge.id })
}
