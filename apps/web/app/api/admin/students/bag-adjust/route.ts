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

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    userId: z.string().uuid(),
    delta60: z.number().int().optional(),
    delta90: z.number().int().optional(),
    reason: z.string().max(200).optional(),
  }).refine(v => v.delta60 !== undefined || v.delta90 !== undefined, { message: 'delta60 o delta90 requerido' }))
  if (badRequest) return badRequest
  const { userId, delta60, delta90, reason } = body

  if (caller.role !== 'super_admin') {
    const { data: targetUser } = await admin.from('users').select('club_id').eq('id', userId).single()
    if (!targetUser || !caller.club_id || targetUser.club_id !== caller.club_id) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
  }

  const { data: bag, error: bagErr } = await admin
    .from('class_bag')
    .select('id, balance_60, balance_90')
    .eq('user_id', userId)
    .single()

  if (bagErr || !bag) return NextResponse.json({ error: 'Bolsa no encontrada' }, { status: 404 })

  const newBalance60 = delta60 !== undefined ? Math.max(0, bag.balance_60 + delta60) : bag.balance_60
  const newBalance90 = delta90 !== undefined ? Math.max(0, bag.balance_90 + delta90) : bag.balance_90

  const { error: updateErr } = await admin
    .from('class_bag')
    .update({ balance_60: newBalance60, balance_90: newBalance90, updated_at: new Date().toISOString() })
    .eq('id', bag.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  if (delta60 !== undefined && delta60 !== 0) {
    const { error: tx60Err } = await admin.from('bag_transactions').insert({
      user_id: userId,
      class_bag_id: bag.id,
      delta: delta60,
      type: delta60 > 0 ? 'credit' : 'debit',
      reason: reason?.trim() || (delta60 > 0 ? 'Recarga manual' : 'Descuento manual'),
      class_duration: '60',
    })
    if (tx60Err) console.error('[bag-adjust] tx60 insert failed:', tx60Err.message)
  }

  if (delta90 !== undefined && delta90 !== 0) {
    const { error: tx90Err } = await admin.from('bag_transactions').insert({
      user_id: userId,
      class_bag_id: bag.id,
      delta: delta90,
      type: delta90 > 0 ? 'credit' : 'debit',
      reason: reason?.trim() || (delta90 > 0 ? 'Recarga manual' : 'Descuento manual'),
      class_duration: '90',
    })
    if (tx90Err) console.error('[bag-adjust] tx90 insert failed:', tx90Err.message)
  }

  return NextResponse.json({ ok: true })
}
