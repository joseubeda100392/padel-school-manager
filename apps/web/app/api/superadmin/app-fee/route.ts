export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// El super admin confirma (o deshace) que ha llegado la transferencia de un mes.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role').eq('id', user.id).single()
  if (caller?.role !== 'super_admin') return NextResponse.json({ error: 'Solo super admin' }, { status: 403 })

  const { data: body, error: badRequest } = await parseBody(req, z.union([
    z.object({ clubId: z.string().uuid(), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), paid: z.boolean() }),
    z.object({ clubId: z.string().uuid(), lockWhenOverdue: z.boolean() }),
  ]))
  if (badRequest) return badRequest

  if ('lockWhenOverdue' in body) {
    const { data, error } = await admin.from('app_fee_plans').update({ lock_when_overdue: body.lockWhenOverdue }).eq('club_id', body.clubId).select('club_id')
    if (error || !data?.length) {
      if (error) console.error('[app-fee] interruptor de bloqueo', body, error)
      return NextResponse.json({ error: error ? 'No se pudo guardar' : 'Ese club no tiene cuota de la app' }, { status: error ? 500 : 400 })
    }
    return NextResponse.json({ ok: true })
  }

  const { data: plan } = await admin.from('app_fee_plans').select('amount').eq('club_id', body.clubId).maybeSingle()
  if (!plan) return NextResponse.json({ error: 'Ese club no tiene cuota de la app' }, { status: 400 })

  const { error } = await admin.from('app_fee_payments').upsert(
    { club_id: body.clubId, month: `${body.month}-01`, paid_at: body.paid ? new Date().toISOString() : null, amount: body.paid ? plan.amount : null },
    { onConflict: 'club_id,month' },
  )
  if (error) {
    console.error('[app-fee] marcar pago', body, error)
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
