export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.user_metadata?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json()
  const { userId } = body as { userId: string }
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: factorsData } = await (admin.auth.admin.mfa as any).listFactors({ userId })
  for (const factor of factorsData?.factors ?? []) {
    await (admin.auth.admin.mfa as any).deleteFactor({ userId, id: factor.id })
  }

  await admin.from('admin_recovery_codes').delete().eq('user_id', userId)

  return NextResponse.json({ ok: true })
}
