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
  const { codes } = body as { codes: string[] }
  if (!Array.isArray(codes) || codes.length === 0) {
    return NextResponse.json({ error: 'Códigos inválidos' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error: deleteError } = await admin.from('admin_recovery_codes').delete().eq('user_id', user.id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  const rows = codes.map(code => ({
    user_id: user.id,
    code_hash: createHash('sha256').update(code.trim().toUpperCase().replace(/-/g, '')).digest('hex'),
    used: false,
  }))

  const { error } = await admin.from('admin_recovery_codes').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
