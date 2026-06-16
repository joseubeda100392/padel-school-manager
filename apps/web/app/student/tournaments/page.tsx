export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { TournamentsClient } from './tournaments-client'

export default async function StudentTournamentsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()

  const { data: userRow } = await admin.from('users').select('club_id').eq('id', user.id).single()
  const clubId: string | null = (userRow as any)?.club_id ?? null

  const [{ data: tournaments }, { data: myRegistrations }] = await Promise.all([
    clubId
      ? admin
          .from('tournaments')
          .select('*, registrations:tournament_registrations(count)')
          .eq('club_id', clubId)
          .in('status', ['open', 'closed', 'finished'])
          .order('tournament_date', { ascending: false })
      : { data: [] },
    admin
      .from('tournament_registrations')
      .select('tournament_id')
      .eq('student_id', user.id),
  ])

  const myTournamentIds = new Set((myRegistrations ?? []).map(r => r.tournament_id))

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Torneos</h1>
        <p className="text-sm text-gray-500">Torneos organizados por tu club</p>
      </div>

      {(!tournaments || tournaments.length === 0) ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <p className="text-2xl mb-2">🏆</p>
          <p className="text-gray-400">No hay torneos disponibles por ahora.</p>
        </div>
      ) : (
        <TournamentsClient
          tournaments={(tournaments ?? []).map((t: any) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            tournament_date: t.tournament_date,
            location: t.location,
            max_players: t.max_players,
            price_cents: t.price_cents,
            status: t.status,
            registeredCount: t.registrations?.[0]?.count ?? 0,
            isRegistered: myTournamentIds.has(t.id),
          }))}
        />
      )}
    </div>
  )
}
