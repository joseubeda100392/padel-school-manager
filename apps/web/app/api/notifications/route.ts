export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()

  const { data: profile } = await admin
    .from('users')
    .select('role, club_id')
    .eq('id', user.id)
    .single()

  const isAdmin = profile && ['admin', 'super_admin'].includes(profile.role)
  const isSuperAdmin = profile?.role === 'super_admin'

  let body: { id?: string; all?: boolean; userId?: string } = {}
  try { body = await req.json() } catch { /* sin body */ }

  const { id, all, userId } = body
  const targetUserId = isAdmin && userId ? userId : user.id

  if (id) {
    if (isAdmin) {
      if (!isSuperAdmin && profile?.club_id) {
        const { data: notif } = await admin
          .from('notifications')
          .select('club_id')
          .eq('id', id)
          .single()
        if (notif && notif.club_id !== profile.club_id) {
          return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
        }
      }
      await admin.from('notifications').delete().eq('id', id)
    } else {
      await admin.from('notifications').delete().eq('id', id).eq('user_id', user.id)
    }
  } else if (all) {
    await admin.from('notifications').delete().eq('user_id', targetUserId)
  } else {
    return NextResponse.json({ error: 'Falta id o all:true' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
