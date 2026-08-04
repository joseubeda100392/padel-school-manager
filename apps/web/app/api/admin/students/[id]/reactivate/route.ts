export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// Complemento del toggle "Usuario activo" (que se guarda directo desde el
// navegador vía RLS). Ese guardado no puede levantar el baneo de acceso que
// se aplica al desactivar (requiere service role) — esta ruta lo hace.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const userId = params.id
  if (caller.role !== 'super_admin') {
    const { data: target } = await admin.from('users').select('club_id').eq('id', userId).single()
    if (!target || !caller.club_id || target.club_id !== caller.club_id) {
      return NextResponse.json({ error: 'Sin permisos para reactivar este usuario' }, { status: 403 })
    }
  }

  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
  if (error) return NextResponse.json({ error: 'Error al reactivar el acceso' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
