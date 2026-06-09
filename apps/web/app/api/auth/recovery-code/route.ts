export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const role = user.user_metadata?.role
  if (role !== 'admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json()
  const { code } = body as { code: string }
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Código inválido' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const hash = createHash('sha256').update(code.trim().toUpperCase().replace(/-/g, '')).digest('hex')
  const { data: recoveryCode } = await admin
    .from('admin_recovery_codes')
    .select('id')
    .eq('user_id', user.id)
    .eq('code_hash', hash)
    .eq('used', false)
    .single()

  if (!recoveryCode) {
    return NextResponse.json({ error: 'Código incorrecto o ya usado' }, { status: 400 })
  }

  const { error: updateError } = await admin.from('admin_recovery_codes').update({ used: true }).eq('id', recoveryCode.id)
  if (updateError) return NextResponse.json({ error: 'Error al invalidar el código' }, { status: 500 })

  // SDK v2 does not export admin MFA types; cast until they land
  const { data: factorsData } = await (admin.auth.admin.mfa as any).listFactors({ userId: user.id })
  for (const factor of factorsData?.factors ?? []) {
    // SDK v2 does not export admin MFA types; cast until they land
    await (admin.auth.admin.mfa as any).deleteFactor({ userId: user.id, id: factor.id })
  }

  return NextResponse.json({ ok: true })
}
