export const dynamic = 'force-dynamic'
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getPlaytomicClient } from '@/lib/playtomic'

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET ?? ''
  const authHeader = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${cronSecret}`
  const authBuf = Buffer.from(authHeader)
  const expBuf = Buffer.from(expected)
  if (!cronSecret || authBuf.length !== expBuf.length || !timingSafeEqual(authBuf, expBuf)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = getAdminClient()

  // Clubs con Pista Viva activa y tenant_id configurado
  const { data: clubs } = await admin
    .from('clubs')
    .select('id, playtomic_tenant_id')
    .not('playtomic_tenant_id', 'is', null)
    .filter('features->enable_pista_viva', 'eq', true)

  if (!clubs?.length) return NextResponse.json({ ok: true, scanned: 0, created: 0 })

  // Ventana 24h-48h (no 0h-48h): un rango de 24h limpias, por debajo del
  // límite de ~25h por llamada, en vez de pedir 48h de golpe y arriesgarse a
  // un truncado silencioso de Playtomic.
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)
  const startMin = in24h.toISOString().replace('Z', '').split('.')[0]
  const startMax = in48h.toISOString().replace('Z', '').split('.')[0]

  const client = getPlaytomicClient()
  let created = 0

  for (const club of clubs) {
    const resources = await client.getAvailableSlots(club.playtomic_tenant_id!, startMin, startMax)
    await new Promise((resolve) => setTimeout(resolve, 500))

    for (const resource of resources) {
      for (const slot of resource.slots) {
        const slotDatetime = new Date(slot.start_time).toISOString()

        const { error } = await admin.from('pista_viva_campaigns').upsert({
          club_id: club.id,
          court_name: resource.name,
          resource_id: resource.resource_id,
          slot_datetime: slotDatetime,
          duration_minutes: slot.duration,
          status: 'draft',
        }, { onConflict: 'club_id,resource_id,slot_datetime', ignoreDuplicates: true })

        if (!error) created++
      }
    }
  }

  return NextResponse.json({ ok: true, scanned: clubs.length, created })
}
