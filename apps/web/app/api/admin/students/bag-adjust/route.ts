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

  const defaultReason = (delta60 ?? delta90 ?? 0) > 0 ? 'Recarga manual' : 'Descuento manual'

  // Ajuste atómico (lock + update en una sola transacción de BD, sin race con reservas simultáneas)
  const { data: result, error: rpcErr } = await admin.rpc('adjust_class_bag', {
    p_user_id: userId,
    p_delta_60: delta60 ?? 0,
    p_delta_90: delta90 ?? 0,
    p_reason: reason?.trim() || defaultReason,
  })

  if (rpcErr || result?.error) {
    return NextResponse.json({ error: result?.error ?? rpcErr?.message ?? 'Error al ajustar la bolsa' }, { status: result?.error ? 404 : 500 })
  }

  return NextResponse.json({ ok: true })
}
