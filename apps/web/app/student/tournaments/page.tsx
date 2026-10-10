export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { TournamentsClient } from './tournaments-client'
import { Trophy } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'

export default async function StudentTournamentsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()

  const { data: userRow } = await admin.from('users').select('club_id, current_level_id').eq('id', user.id).single()
  const clubId: string | null = (userRow as any)?.club_id ?? null
  const myLevelId: string | null = (userRow as any)?.current_level_id ?? null

  const { getClubFeatures } = await import('@/lib/get-club-features')
  const features = await getClubFeatures(clubId ?? undefined)
  if (!features.enable_tournaments) redirect('/student')

  const [{ data: tournamentsRaw }, { data: myRegistrations }, { data: levelsRaw }] = await Promise.all([
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
    clubId
      ? admin.from('levels').select('id, name, color').eq('club_id', clubId)
      : { data: [] },
  ])

  const myTournamentIds = new Set((myRegistrations ?? []).map(r => r.tournament_id))
  const levelsMap = Object.fromEntries((levelsRaw ?? []).map((l: any) => [l.id, l]))

  // Filter: only show tournaments where allowed_level_ids is empty (all levels) OR contains student's level
  const tournaments = (tournamentsRaw ?? []).filter((t: any) => {
    const ids: string[] = t.allowed_level_ids ?? []
    return ids.length === 0 || !myLevelId || ids.includes(myLevelId)
  })

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader title="Torneos" description="Torneos organizados por tu club." />

      {tournaments.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Trophy />}
            title="No hay torneos para tu nivel por ahora"
            description="Cuando el club abra uno para tu nivel, lo verás aquí."
          />
        </Card>
      ) : (
        <TournamentsClient
          tournaments={tournaments.map((t: any) => ({
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
            allowedLevels: (t.allowed_level_ids ?? []).map((id: string) => levelsMap[id]).filter(Boolean),
          }))}
          cashOnly={features.cash_only_payments}
        />
      )}
    </div>
  )
}
