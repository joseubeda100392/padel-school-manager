export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getPlaytomicClient } from '@/lib/playtomic'
import { sendWhatsAppBulk } from '@/lib/whatsapp'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: campaign } = await admin
    .from('pista_viva_campaigns')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
  if (campaign.status !== 'draft') {
    return NextResponse.json({ error: 'Solo se pueden enviar campañas en estado draft' }, { status: 400 })
  }

  const { data: club } = await admin
    .from('clubs')
    .select('name, playtomic_email, playtomic_password, playtomic_tenant_id')
    .eq('id', campaign.club_id)
    .single()

  if (!club?.playtomic_email || !club?.playtomic_password || !club?.playtomic_tenant_id) {
    return NextResponse.json({ error: 'Credenciales Playtomic no configuradas (necesita cuenta de jugador bot)' }, { status: 400 })
  }

  // Login con cuenta jugador bot (cuenta normal de Playtomic, NO manager del club)
  const ptClient = getPlaytomicClient()
  try {
    await ptClient.login(club.playtomic_email, club.playtomic_password)
  } catch (e: any) {
    return NextResponse.json({ error: `Login Playtomic falló: ${e.message}` }, { status: 502 })
  }

  // slot_datetime en UTC → enviamos UTC directamente (Playtomic availability usa UTC)
  const utcDate = new Date(campaign.slot_datetime)
  const startTime = utcDate.toISOString().split('.')[0].replace('Z', '')

  const dryRun = req.nextUrl.searchParams.get('dry_run') === '1'
  let matchId: string
  let matchUrl: string
  try {
    const result = await ptClient.createMatch({
      tenantId: club.playtomic_tenant_id,
      resourceId: campaign.resource_id,
      startTime,
      durationMinutes: campaign.duration_minutes,
      playersNeeded: campaign.players_needed,
      dryRun,
    })
    if (result.dryRun) {
      return NextResponse.json({ dryRun: true, preview: result.preview })
    }
    matchId = result.matchId
    matchUrl = result.matchUrl
  } catch (e: any) {
    return NextResponse.json({ error: `Crear partido Playtomic falló: ${e.message}` }, { status: 502 })
  }

  await admin
    .from('pista_viva_campaigns')
    .update({
      playtomic_match_id: matchId,
      playtomic_match_url: matchUrl,
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  let usersQuery = admin
    .from('users')
    .select('id, name, phone, pista_viva_whatsapp, push_token')
    .eq('club_id', campaign.club_id)
    .eq('role', 'student')
    .not('phone', 'is', null)

  if (campaign.target_level_id) {
    const { data: levelUsers } = await admin
      .from('user_levels')
      .select('user_id')
      .eq('level_id', campaign.target_level_id)
      .eq('is_current', true)
    const ids = (levelUsers ?? []).map((u) => u.user_id)
    if (ids.length > 0) usersQuery = usersQuery.in('id', ids)
    else return NextResponse.json({ ok: true, matchId, matchUrl, waSent: 0, pushSent: 0 })
  }

  const { data: members } = await usersQuery

  const slotDate = new Date(campaign.slot_datetime)
  const dateStr = slotDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' })
  const timeStr = slotDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
  const faltan = campaign.players_needed - 1

  const message = campaign.message ??
    `🎾 Pista libre en ${club.name}\n📅 ${dateStr} a las ${timeStr} · ${campaign.court_name}\n👥 Faltan ${faltan} jugadores · ${campaign.duration_minutes} min\n¡Apúntate antes de que se llene!\n👉 ${matchUrl}`

  const waNumbers = (members ?? [])
    .filter((m) => m.pista_viva_whatsapp && m.phone)
    .map((m) => m.phone as string)

  const { sent: waSent } = await sendWhatsAppBulk(waNumbers, message)

  const pushTokens = (members ?? []).filter((m) => m.push_token).map((m) => m.push_token as string)
  let pushSent = 0
  if (pushTokens.length > 0) {
    const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: pushTokens,
        title: `🎾 Pista libre en ${club.name}`,
        body: `${dateStr} ${timeStr} · ${campaign.court_name} · Faltan ${faltan} jugadores`,
        data: { url: matchUrl },
      }),
    })
    if (pushRes.ok) pushSent = pushTokens.length
  }

  return NextResponse.json({ ok: true, matchId, matchUrl, waSent, pushSent })
}
