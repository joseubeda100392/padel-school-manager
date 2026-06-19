export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getPlaytomicClient } from '@/lib/playtomic'

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
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

  const now = new Date()
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)
  const startMin = now.toISOString().replace('Z', '').split('.')[0]
  const startMax = in48h.toISOString().replace('Z', '').split('.')[0]

  const client = getPlaytomicClient()
  let created = 0

  for (const club of clubs) {
    const resources = await client.getAvailableSlots(club.playtomic_tenant_id!, startMin, startMax)

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
