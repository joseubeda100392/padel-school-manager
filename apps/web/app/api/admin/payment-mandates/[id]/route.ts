export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

const patchSchema = z.object({
  status: z.enum(['pending', 'active', 'paused', 'cancelled']).optional(),
  amountCents: z.number().int().positive().optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  if (caller.role !== 'super_admin') {
    const { data: mandate } = await admin.from('payment_mandates').select('club_id').eq('id', params.id).single()
    if (!mandate || mandate.club_id !== caller.club_id) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
  }

  const { data: body, error: badRequest } = await parseBody(req, patchSchema)
  if (badRequest) return badRequest
  const { status, amountCents, dayOfMonth } = body

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status !== undefined) updates.status = status
  if (amountCents !== undefined) updates.amount_cents = amountCents
  if (dayOfMonth !== undefined) updates.day_of_month = dayOfMonth

  const { error } = await admin
    .from('payment_mandates')
    .update(updates)
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
