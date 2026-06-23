export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
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
    .select('name, playtomic_tenant_id')
    .eq('id', campaign.club_id)
    .single()

  if (!club?.playtomic_tenant_id) {
    return NextResponse.json({ error: 'Tenant ID de Playtomic no configurado' }, { status: 400 })
  }

  // Construir deep link directo al slot en app.playtomic.com
  // start debe estar en UTC (ya está así en slot_datetime de la DB)
  const startUTC = new Date(campaign.slot_datetime).toISOString()
  const matchUrl = `https://app.playtomic.com/payments?type=CUSTOMER_MATCH&tenant_id=${club.playtomic_tenant_id}&resource_id=${campaign.resource_id}&start=${encodeURIComponent(startUTC)}&duration=${campaign.duration_minutes}&sport_id=PADEL`

  // Actualizar campaña con URL y marcar como enviada
  await admin
    .from('pista_viva_campaigns')
    .update({
      playtomic_match_url: matchUrl,
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  // Obtener socios del nivel objetivo con teléfono
  const attributionUrl = matchUrl

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
    else return NextResponse.json({ ok: true, matchUrl, waSent: 0, pushSent: 0 })
  }

  const { data: members } = await usersQuery

  const slotDate = new Date(campaign.slot_datetime)
  const dateStr = slotDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
  const timeStr = slotDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const message = campaign.message ??
    `🎾 Pista libre en ${club.name}\n📅 ${dateStr} a las ${timeStr} · ${campaign.court_name}\n¡Reserva tu plaza antes de que se llene!\n👉 ${attributionUrl}`

  // WhatsApp a los que tienen opt-in
  const waNumbers = (members ?? [])
    .filter((m) => m.pista_viva_whatsapp && m.phone)
    .map((m) => m.phone as string)

  const { sent: waSent } = await sendWhatsAppBulk(waNumbers, message)

  // Push a todos los miembros con token
  const pushTokens = (members ?? []).filter((m) => m.push_token).map((m) => m.push_token as string)
  let pushSent = 0
  if (pushTokens.length > 0) {
    const pushBody = {
      to: pushTokens,
      title: `🎾 Pista libre en ${club.name}`,
      body: `${dateStr} ${timeStr} · ${campaign.court_name} · ¡Reserva ya!`,
      data: { url: attributionUrl },
    }
    const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pushBody),
    })
    if (pushRes.ok) pushSent = pushTokens.length
  }

  return NextResponse.json({ ok: true, matchUrl, waSent, pushSent })
}
