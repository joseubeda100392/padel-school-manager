export const dynamic = 'force-dynamic'
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { PlaytomicOfficialClient } from '@/lib/playtomic'

// Refresco diario del nivel real de Playtomic de cada alumno con opt-in
// activo — el nivel se guarda solo en el momento del opt-in y Playtomic lo
// recalcula de forma continua según va jugando, así que sin esto se queda
// desfasado en silencio. Independiente de scan-open-matches (cadencia
// distinta: una vez al día, no cada 15 min).
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

  if (!clubs?.length) return NextResponse.json({ ok: true, clubsScanned: 0, updated: 0 })

  let updated = 0

  for (const club of clubs) {
    const ptClient = new PlaytomicOfficialClient()
    try {
      await ptClient.login(club.playtomic_client_id!, club.playtomic_client_secret!)
    } catch {
      continue // credenciales inválidas para este club — se salta, no interrumpe a los demás
    }

    const { data: optedIn } = await admin
      .from('users')
      .select('id, playtomic_player_id')
      .eq('club_id', club.id)
      .eq('pista_viva_optin', true)
      .not('playtomic_player_id', 'is', null)

    for (const student of optedIn ?? []) {
      try {
        const player = await ptClient.getPlayerById(club.playtomic_tenant_id!, student.playtomic_player_id as string)
        if (player?.level == null) continue
        await admin.from('users').update({ playtomic_level: player.level }).eq('id', student.id)
        updated++
      } catch {
        // fallo puntual con un alumno — no interrumpe al resto
      }
    }
  }

  return NextResponse.json({ ok: true, clubsScanned: clubs.length, updated })
}
