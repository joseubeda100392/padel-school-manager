export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { tournamentId } = await req.json()
  if (!tournamentId) return NextResponse.json({ error: 'tournamentId requerido' }, { status: 400 })

  const admin = getAdminClient()

  const { data: tournament } = await admin
    .from('tournaments')
    .select('id, status, max_players, club_id')
    .eq('id', tournamentId)
    .single()

  if (!tournament) return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 })
  if (tournament.status !== 'open') return NextResponse.json({ error: 'Las inscripciones están cerradas' }, { status: 409 })

  const { data: userRow } = await admin.from('users').select('club_id').eq('id', user.id).single()
  if ((userRow as any)?.club_id !== tournament.club_id) {
    return NextResponse.json({ error: 'No perteneces a este club' }, { status: 403 })
  }

  const { count } = await admin
    .from('tournament_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)

  if ((count ?? 0) >= tournament.max_players) {
    return NextResponse.json({ error: 'El torneo está completo' }, { status: 409 })
  }

  const { error } = await admin.from('tournament_registrations').insert({
    tournament_id: tournamentId,
    student_id: user.id,
  })

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Ya estás inscrito' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { tournamentId } = await req.json()
  if (!tournamentId) return NextResponse.json({ error: 'tournamentId requerido' }, { status: 400 })

  const admin = getAdminClient()
  const { error } = await admin
    .from('tournament_registrations')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('student_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
