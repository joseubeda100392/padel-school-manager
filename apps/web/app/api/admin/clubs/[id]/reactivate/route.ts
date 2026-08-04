export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// Complemento del toggle "Club activo" (se guarda directo desde el navegador
// vía RLS). Ese guardado no puede levantar el baneo de acceso aplicado a
// todos los usuarios del club al desactivarlo (requiere service role).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: callerProfile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!callerProfile || callerProfile.role !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const clubId = params.id
  const { data: clubUsers } = await admin.from('users').select('id').eq('club_id', clubId)
  const userIds = (clubUsers ?? []).map((u: any) => u.id)

  await Promise.all(
    userIds.map((id: string) =>
      admin.auth.admin.updateUserById(id, { ban_duration: 'none' }).catch(() => {})
    )
  )

  return NextResponse.json({ ok: true })
}
