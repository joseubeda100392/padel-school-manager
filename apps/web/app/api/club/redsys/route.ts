export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

async function getAdminProfile() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = getAdminClient()

  const { data: profile } = await admin
    .from('users')
    .select('role, club_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) return null
  return { profile, admin }
}

export async function GET() {
  const result = await getAdminProfile()
  if (!result) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  const { profile, admin } = result

  if (!profile.club_id) return NextResponse.json({ error: 'Sin club asignado' }, { status: 400 })

  const { data: club } = await admin
    .from('clubs')
    .select('redsys_merchant_code, redsys_merchant_terminal, redsys_env, redsys_secret_key')
    .eq('id', profile.club_id)
    .single()

  return NextResponse.json({
    merchantCode: club?.redsys_merchant_code ?? '',
    terminal: club?.redsys_merchant_terminal ?? '001',
    env: club?.redsys_env ?? 'test',
    secretKeyMasked: club?.redsys_secret_key
      ? '••••••••' + club.redsys_secret_key.slice(-4)
      : '',
    hasSecretKey: !!club?.redsys_secret_key,
  })
}

export async function PUT(req: NextRequest) {
  const result = await getAdminProfile()
  if (!result) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  const { profile, admin } = result

  if (!profile.club_id) return NextResponse.json({ error: 'Sin club asignado' }, { status: 400 })

  const { merchantCode, secretKey, terminal, env }: {
    merchantCode?: string
    secretKey?: string
    terminal?: string
    env?: string
  } = await req.json()

  const update: Record<string, string> = {}
  if (merchantCode !== undefined) update.redsys_merchant_code = merchantCode.trim()
  if (terminal !== undefined) update.redsys_merchant_terminal = terminal.trim() || '001'
  if (env !== undefined) update.redsys_env = env === 'production' ? 'production' : 'test'
  if (secretKey?.trim()) update.redsys_secret_key = secretKey.trim()

  await admin.from('clubs').update(update).eq('id', profile.club_id)

  return NextResponse.json({ ok: true })
}
