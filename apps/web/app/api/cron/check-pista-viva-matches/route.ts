export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getPlaytomicClient } from '@/lib/playtomic'
import { sendWhatsAppBulk } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = getAdminClient()
  const now = new Date()

  // Campañas activas cuyo slot no ha empezado aún (con margen de 30min)
  const cutoff = new Date(now.getTime() + 30 * 60 * 1000).toISOString()

  const { data: campaigns } = await admin
    .from('pista_viva_campaigns')
    .select('*, clubs(name, playtomic_booking_url)')
    .eq('status', 'sent')
    .not('playtomic_match_id', 'is', null)
    .gt('slot_datetime', cutoff)

  if (!campaigns?.length) return NextResponse.json({ ok: true, checked: 0 })

  const client = getPlaytomicClient()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://padelschoolmanager.com'
  let checked = 0

  for (const campaign of campaigns) {
    try {
      const status = await client.getMatchStatus(campaign.playtomic_match_id!)
      checked++

      await admin
        .from('pista_viva_campaigns')
        .update({ last_checked_at: now.toISOString() })
        .eq('id', campaign.id)

      if (status.isConverted) {
        await admin
          .from('pista_viva_campaigns')
          .update({ status: 'converted', closed_at: now.toISOString(), players_joined: status.playersJoined })
          .eq('id', campaign.id)
        continue
      }

      if (status.playersJoined === campaign.players_joined) continue

      // Número de jugadores cambió
      const faltan = status.playersNeeded - status.playersJoined
      await admin
        .from('pista_viva_campaigns')
        .update({ players_joined: status.playersJoined })
        .eq('id', campaign.id)

      const attributionUrl = `${baseUrl}/pv/${campaign.id}`
      const clubName = (campaign as any).clubs?.name ?? ''

      // Obtener miembros que aún no se han apuntado
      let membersQuery = admin
        .from('users')
        .select('phone, push_token, pista_viva_whatsapp')
        .eq('club_id', campaign.club_id)
        .eq('role', 'student')

      if (campaign.target_level_id) {
        const { data: levelUsers } = await admin
          .from('user_levels')
          .select('user_id')
          .eq('level_id', campaign.target_level_id)
          .eq('is_current', true)
        const ids = (levelUsers ?? []).map((u) => u.user_id)
        if (ids.length > 0) membersQuery = membersQuery.in('id', ids)
      }

      const { data: members } = await membersQuery

      const slotDate = new Date(campaign.slot_datetime)
      const dateStr = slotDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
      const timeStr = slotDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

      if (faltan === 1) {
        // ÚLTIMO HUECO — WhatsApp + push
        const waMsg = `🔥 ¡ÚLTIMO HUECO! en ${clubName}\n📅 ${dateStr} ${timeStr} · ${campaign.court_name}\nYa somos ${status.playersJoined} — solo queda 1 plaza\n¡Corre! 👉 ${attributionUrl}`

        const waNumbers = (members ?? [])
          .filter((m) => m.pista_viva_whatsapp && m.phone)
          .map((m) => m.phone as string)

        if (waNumbers.length > 0) await sendWhatsAppBulk(waNumbers, waMsg)
      }

      // Push para todos (tanto en último hueco como en updates intermedios)
      const pushMsg = faltan === 1
        ? `🔥 ¡ÚLTIMO HUECO! ${campaign.court_name} · ${timeStr} — ¡solo queda 1 plaza!`
        : `👥 Ya somos ${status.playersJoined} en ${campaign.court_name} — Faltan ${faltan} para cerrar`

      const pushTokens = (members ?? []).filter((m) => m.push_token).map((m) => m.push_token as string)
      if (pushTokens.length > 0) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: pushTokens,
            title: `🎾 ${clubName} — Pista Viva`,
            body: pushMsg,
            data: { url: attributionUrl },
          }),
        }).catch(() => {})
      }
    } catch {
      // No interrumpir el bucle si falla un partido
    }
  }

  // Cerrar campañas cuyo slot ya pasó (slot_datetime - 30min <= now)
  await admin
    .from('pista_viva_campaigns')
    .update({ status: 'closed', closed_at: now.toISOString() })
    .eq('status', 'sent')
    .lte('slot_datetime', cutoff)

  return NextResponse.json({ ok: true, checked })
}
