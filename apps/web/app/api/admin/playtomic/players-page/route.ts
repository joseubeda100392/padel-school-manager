export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { PlaytomicOfficialClient } from '@/lib/playtomic'

// Extracción incremental: el cliente llama repetidamente pasando el cursor
// devuelto por la llamada anterior, acumulando resultados en el navegador.
// Cada llamada trae solo unas pocas páginas (rápido, dentro del timeout de
// la plataforma) en vez de intentar traer los ~22.000 jugadores del venue
// de una sola vez. Nunca escribe en la base de datos.
export async function POST(req: NextRequest) {
  try {
    return await handlePost(req)
  } catch (e: any) {
    console.error('[playtomic/players-page] unhandled error:', e)
    return NextResponse.json({ error: 'Error inesperado: ' + (e?.message ?? String(e)) }, { status: 500 })
  }
}

async function handlePost(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const cookieStore = cookies()
  const clubId = caller.role === 'super_admin'
    ? (cookieStore.get('sa_active_club')?.value ?? caller.club_id)
    : caller.club_id
  if (!clubId) return NextResponse.json({ error: 'Club no encontrado' }, { status: 400 })

  const { data: club } = await admin
    .from('clubs')
    .select('playtomic_client_id, playtomic_client_secret, playtomic_tenant_id')
    .eq('id', clubId)
    .single()

  if (!club?.playtomic_client_id || !club?.playtomic_client_secret || !club?.playtomic_tenant_id) {
    return NextResponse.json({ error: 'Configura el Client ID y Client Secret de la API de Playtomic en Settings → Playtomic' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const cursorId: string | null = body.cursorId ?? null

  const ptClient = new PlaytomicOfficialClient()
  try {
    await ptClient.login(club.playtomic_client_id, club.playtomic_client_secret)
  } catch (e: any) {
    return NextResponse.json({ error: 'Error de autenticación con la API de Playtomic' }, { status: 502 })
  }

  let page
  try {
    page = await ptClient.getVenuePlayersPage(club.playtomic_tenant_id, cursorId, 3)
  } catch (e: any) {
    return NextResponse.json({ error: 'Error al obtener jugadores de Playtomic: ' + e.message }, { status: 502 })
  }

  const { data: existingUsers } = await admin
    .from('users')
    .select('email')
    .eq('club_id', clubId)
  const existingEmails = new Set((existingUsers ?? []).map((u) => u.email?.toLowerCase()))

  return NextResponse.json({
    players: page.players.map((p) => ({
      name: p.name,
      email: p.email || null,
      phone: p.phone ?? null,
      gender: p.gender ?? null,
      level: p.level ?? null,
      birthDate: p.birthDate ?? null,
      lastActivity: p.lastActivity ?? null,
      acceptsMarketing: p.acceptsMarketing ?? null,
      otherSports: p.otherSports?.length ? p.otherSports.map((s) => `${s.sportId}: ${s.level}`).join(' / ') : null,
      benefits: p.benefits?.length ? p.benefits.map((b) => b.name).join(' / ') : null,
      walletBalance: p.walletBalance ?? null,
      status: !p.email ? 'sin_email' : existingEmails.has(p.email.toLowerCase()) ? 'ya_existe' : 'se_crearia',
    })),
    nextCursorId: page.nextCursorId,
    hasMore: page.hasMore,
  })
}
