export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { computePaidUntil, computeBillingCycle } from '@/lib/billing-cycle'

// Endpoint temporal de solo lectura para verificar en vivo el cálculo de
// billing-cycle.ts con una fecha concreta, sin tocar pagos ni base de
// datos. Borrar una vez confirmado el arranque de temporada 2026.
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const dateParam = req.nextUrl.searchParams.get('date')
  const dayOfMonthParam = req.nextUrl.searchParams.get('dayOfMonth')
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: 'Pasa ?date=YYYY-MM-DD' }, { status: 400 })
  }

  const referenceDate = new Date(dateParam + 'T12:00:00Z')
  const dayOfMonth = dayOfMonthParam ? parseInt(dayOfMonthParam, 10) : 1

  return NextResponse.json({
    referenceDate: dateParam,
    paidUntil_pagoSuelto: computePaidUntil(referenceDate),
    domiciliacion: computeBillingCycle(referenceDate, dayOfMonth),
  })
}
