export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// Sin cuerpo marca todas como leídas (al abrir "Notificaciones"); con `id`
// solo esa, que es lo que pide el móvil al tocar un aviso.
const bodySchema = z.object({ id: z.string().uuid().optional() })

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const raw = await req.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(raw ?? {})
  if (!parsed.success) return NextResponse.json({ error: 'Parámetros no válidos' }, { status: 400 })

  const admin = getAdminClient()

  let query = admin
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)
  if (parsed.data.id) query = query.eq('id', parsed.data.id)
  await query

  return NextResponse.json({ ok: true })
}
