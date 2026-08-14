export const dynamic = 'force-dynamic'
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { PlaytomicOfficialClient } from '@/lib/playtomic'
import { sendPushToUsers } from '@/lib/push'

function formatMadrid(isoNoTz: string): string {
  const utcDate = new Date(isoNoTz.endsWith('Z') ? isoNoTz : isoNoTz + 'Z')
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(utcDate)
}

// MVP de Pista Viva v2 — API oficial de Playtomic (solo lectura) +
// opt-in propio. Una única notificación por partido, sin oleadas ni
// WhatsApp. Independiente de scan-playtomic-slots / import-players.
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

  const { data: clubs } = await admin
    .from('clubs')
    .select('id, playtomic_client_id, playtomic_client_secret, playtomic_tenant_id')
    .not('playtomic_client_id', 'is', null)
    .not('playtomic_client_secret', 'is', null)
    .not('playtomic_tenant_id', 'is', null)
    .filter('features->enable_pista_viva', 'eq', true)

  if (!clubs?.length) return NextResponse.json({ ok: true, clubsScanned: 0, alertsSent: 0 })

  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)
  const toBookingDate = (d: Date) => d.toISOString().slice(0, 19)

  let alertsSent = 0
  let recovered = 0
  let lost = 0

  for (const club of clubs) {
    const ptClient = new PlaytomicOfficialClient()
    try {
      await ptClient.login(club.playtomic_client_id!, club.playtomic_client_secret!)
    } catch {
      continue // credenciales inválidas para este club — se salta, no interrumpe a los demás
    }

    let matches: any[] = []
    try {
      matches = await ptClient.getVenuePendingOpenMatches(
        club.playtomic_tenant_id!, toBookingDate(yesterday), toBookingDate(in48h),
      )
    } catch {
      continue
    }

    const { data: existingAlerts } = await admin
      .from('pista_viva_open_match_alerts')
      .select('*')
      .eq('club_id', club.id)
      .eq('status', 'sent')

    const alertsByMatchId = new Map((existingAlerts ?? []).map((a: any) => [a.playtomic_match_id, a]))

    for (const match of matches) {
      const participants: any[] = match.participant_info?.participants ?? []
      const participantEmails = new Set(
        participants.map((p) => (p.email ?? '').toLowerCase()).filter(Boolean),
      )
      const participantCount = participants.length
      const startDate = new Date(match.booking_start_date + (match.booking_start_date.endsWith('Z') ? '' : 'Z'))

      const existing = alertsByMatchId.get(match.booking_id)

      if (existing) {
        if (participantCount > (existing.participants_at_send ?? 0)) {
          await admin.from('pista_viva_open_match_alerts')
            .update({ status: 'recovered', resolved_at: now.toISOString() })
            .eq('id', existing.id)
          recovered++
        } else if (startDate.getTime() <= now.getTime()) {
          await admin.from('pista_viva_open_match_alerts')
            .update({ status: 'lost', resolved_at: now.toISOString() })
            .eq('id', existing.id)
          lost++
        }
        continue // ya avisado antes — MVP no reenvía
      }

      if (participantCount >= 4 || startDate.getTime() <= now.getTime()) continue

      // Nivel del partido: se consulta en directo el nivel real de cada
      // participante ya apuntado (participant_id), sea o no alumno nuestro.
      // Solo se usa el número en memoria para calcular el rango — nunca se
      // guarda nada de estos jugadores en nuestra base de datos.
      const participantIds: string[] = participants.map((p: any) => p.participant_id).filter(Boolean)
      const levels: number[] = []
      for (const pid of participantIds) {
        try {
          const player = await ptClient.getPlayerById(club.playtomic_tenant_id!, pid)
          if (player?.level != null) levels.push(player.level)
        } catch {
          // fallo puntual al consultar un jugador — no interrumpe el partido
        }
      }

      if (!levels.length) continue

      const levelMin = Math.min(...levels) - 0.3
      const levelMax = Math.max(...levels) + 0.3

      const { data: candidates } = await admin
        .from('users')
        .select('id, email')
        .eq('club_id', club.id)
        .eq('pista_viva_optin', true)
        .gte('playtomic_level', levelMin)
        .lte('playtomic_level', levelMax)

      const targetUserIds = (candidates ?? [])
        .filter((c: any) => !participantEmails.has((c.email ?? '').toLowerCase()))
        .map((c: any) => c.id as string)

      if (!targetUserIds.length) continue

      const faltan = 4 - participantCount
      await sendPushToUsers(
        targetUserIds,
        {
          title: faltan === 1 ? '¡Falta 1 para un partido de tu nivel!' : `Faltan ${faltan} para un partido de tu nivel`,
          body: `${match.resource_name ?? 'Pista'} · ${formatMadrid(match.booking_start_date)}`,
          url: `https://app.playtomic.io/matches/${match.booking_id}`,
        },
        'pista_viva',
      )

      await admin.from('pista_viva_open_match_alerts').insert({
        club_id: club.id,
        playtomic_match_id: match.booking_id,
        court_name: match.resource_name ?? null,
        slot_datetime: startDate.toISOString(),
        level_min: levelMin,
        level_max: levelMax,
        notified_user_ids: targetUserIds,
        participants_at_send: participantCount,
        status: 'sent',
      })
      alertsSent++
    }
  }

  return NextResponse.json({ ok: true, clubsScanned: clubs.length, alertsSent, recovered, lost })
}
