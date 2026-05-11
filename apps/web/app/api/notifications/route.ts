export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile && ['admin', 'super_admin'].includes(profile.role)

  let body: { id?: string; all?: boolean; userId?: string } = {}
  try { body = await req.json() } catch { /* sin body */ }

  const { id, all, userId } = body
  const targetUserId = isAdmin && userId ? userId : user.id

  if (id) {
    if (isAdmin) {
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
