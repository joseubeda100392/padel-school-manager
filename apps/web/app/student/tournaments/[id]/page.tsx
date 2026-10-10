export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { CircleCheck, Clock, Lock, MapPin, Tag, Users } from 'lucide-react'
import { formatLongDate } from '@/lib/format-date'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge, LevelTag } from '@/components/ui/badge'
import { TournamentDetailClient } from './tournament-detail-client'

function StatusBadge({ status }: { status: string }) {
  if (status === 'open') return <Badge tone="success"><CircleCheck className="h-3.5 w-3.5" aria-hidden />Abierto</Badge>
  if (status === 'closed') return <Badge tone="warn"><Lock className="h-3.5 w-3.5" aria-hidden />Cerrado</Badge>
  if (status === 'finished') return <Badge tone="neutral"><Clock className="h-3.5 w-3.5" aria-hidden />Finalizado</Badge>
  return <Badge tone="neutral">{status}</Badge>
}

export default async function StudentTournamentDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()

  const { data: userRow } = await admin.from('users').select('club_id').eq('id', user.id).single()
  const myClubId: string | null = (userRow as any)?.club_id ?? null

  const { getClubFeatures } = await import('@/lib/get-club-features')
  const features = await getClubFeatures(myClubId ?? undefined)
  if (!features.enable_tournaments) redirect('/student')

  const [{ data: tournament }, { data: registrations }, { data: myReg }, { data: levelsRaw }] = await Promise.all([
    admin.from('tournaments').select('*').eq('id', params.id).single(),
    admin
      .from('tournament_registrations')
      .select('id')
      .eq('tournament_id', params.id),
    admin
      .from('tournament_registrations')
      .select('id')
      .eq('tournament_id', params.id)
      .eq('student_id', user.id)
      .maybeSingle(),
    myClubId
      ? admin.from('levels').select('id, name, color').eq('club_id', myClubId)
      : { data: [] },
  ])

  if (!tournament || tournament.club_id !== myClubId) notFound()

  const levelsMap = Object.fromEntries((levelsRaw ?? []).map((l: any) => [l.id, l]))
  const allowedLevels = (tournament.allowed_level_ids ?? []).map((id: string) => levelsMap[id]).filter(Boolean)
  const registeredCount = (registrations ?? []).length
  const isRegistered = !!myReg

  const dateLabel = formatLongDate(tournament.tournament_date)

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        back={{ href: '/student/tournaments', label: 'Torneos' }}
        title={tournament.name}
        description={dateLabel}
        actions={<StatusBadge status={tournament.status} />}
      />

      <Card>
        <div className="space-y-4 p-4 sm:p-5">
          {tournament.location && (
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-ink-3" aria-label="Lugar" />
              <p className="text-body text-ink">{tournament.location}</p>
            </div>
          )}

          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-ink-3" aria-label="Plazas" />
            <div className="min-w-0 flex-1">
              <p className="text-body text-ink tabular-nums">
                <span className="font-semibold">{registeredCount}</span> de <span className="font-semibold">{tournament.max_players}</span> plazas ocupadas
              </p>
              <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-ink/[0.07]">
                <div
                  className="h-1.5 rounded-full bg-accent-ink"
                  style={{ width: `${Math.min((registeredCount / tournament.max_players) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Tag className="mt-0.5 h-5 w-5 shrink-0 text-ink-3" aria-label="Precio" />
            <p className="text-body text-ink tabular-nums">
              {tournament.price_cents > 0
                ? <><span className="font-semibold">{(tournament.price_cents / 100).toFixed(2)} €</span> por jugador</>
                : 'Gratuito'}
            </p>
          </div>

          {allowedLevels.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-meta text-ink-3">Niveles</span>
              {allowedLevels.map((l: any) => (
                <LevelTag key={l.id} name={l.name} color={l.color} />
              ))}
            </div>
          )}

          {tournament.description && (
            <div className="border-t border-line pt-4">
              <p className="whitespace-pre-line text-body text-ink-2">{tournament.description}</p>
            </div>
          )}
        </div>

        <div className="border-t border-line p-4 sm:p-5">
          <TournamentDetailClient
            tournamentId={tournament.id}
            status={tournament.status}
            priceCents={tournament.price_cents}
            maxPlayers={tournament.max_players}
            registeredCount={registeredCount}
            isRegistered={isRegistered}
            cashOnly={features.cash_only_payments}
          />
        </div>
      </Card>
    </div>
  )
}
