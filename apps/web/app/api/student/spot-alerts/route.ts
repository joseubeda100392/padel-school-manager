export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// El alumno enciende o apaga sus avisos de huecos libres (solo los suyos).
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: body, error: badRequest } = await parseBody(req, z.object({ enabled: z.boolean() }))
  if (badRequest) return badRequest

  const { error } = await getAdminClient().from('users').update({ spot_alerts: body.enabled }).eq('id', user.id)
  if (error) {
    console.error('[spot-alerts] no se pudo guardar', user.id, error.message)
    return NextResponse.json({ error: 'No se ha podido guardar. Vuelve a probar.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, enabled: body.enabled })
}
