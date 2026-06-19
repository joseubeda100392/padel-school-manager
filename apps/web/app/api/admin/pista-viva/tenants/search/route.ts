export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getPlaytomicClient } from '@/lib/playtomic'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const text = req.nextUrl.searchParams.get('text') ?? ''
  if (text.length < 2) return NextResponse.json({ tenants: [] })

  const client = getPlaytomicClient()
  const tenants = await client.searchTenants(text)

  return NextResponse.json({
    tenants: tenants.map((t) => ({
      tenant_id: t.tenant_id,
      name: t.tenant_name,
      address: [t.main_info?.address?.street, t.main_info?.address?.city]
        .filter(Boolean)
        .join(', '),
    })),
  })
}
