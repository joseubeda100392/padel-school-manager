export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

const VALID_DAYS = new Set([0, 1, 2, 3, 4, 5, 6])
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export async function PUT(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { preferredDays, preferredStart, preferredEnd } = await req.json()

  if (preferredDays != null) {
    if (!Array.isArray(preferredDays) || !preferredDays.every((d: unknown) => typeof d === 'number' && VALID_DAYS.has(d))) {
      return NextResponse.json({ error: 'Días no válidos' }, { status: 400 })
    }
  }
  for (const t of [preferredStart, preferredEnd]) {
    if (t != null && !TIME_RE.test(t)) {
      return NextResponse.json({ error: 'Hora no válida' }, { status: 400 })
    }
  }

  const admin = getAdminClient()
  await admin.from('users').update({
    pista_viva_preferred_days: preferredDays?.length ? preferredDays : null,
    pista_viva_preferred_start: preferredStart || null,
    pista_viva_preferred_end: preferredEnd || null,
  }).eq('id', user.id)

  return NextResponse.json({ ok: true })
}
