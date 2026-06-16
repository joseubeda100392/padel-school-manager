export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { TournamentDetailClient } from './tournament-detail-client'

const statusLabel: Record<string, string> = { open: 'Abierto', closed: 'Cerrado', finished: 'Finalizado' }
const statusColor: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-yellow-100 text-yellow-700',
  finished: 'bg-gray-100 text-gray-500',
}

export default async function StudentTournamentDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()

  const { data: userRow } = await admin.from('users').select('club_id').eq('id', user.id).single()
  const myClubId: string | null = (userRow as any)?.club_id ?? null

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

  const dateLabel = new Date(tournament.tournament_date + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Link href="/student/tournaments" className="text-sm text-gray-400 hover:text-gray-600">
          ← Torneos
        </Link>
      </div>

      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-brand-500 to-brand-600 px-6 py-8 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{tournament.name}</h1>
              <p className="mt-1 capitalize text-brand-100">{dateLabel}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor[tournament.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {statusLabel[tournament.status] ?? tournament.status}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-6 space-y-4">
          {tournament.location && (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-gray-400">📍</span>
              <p className="text-sm text-gray-700">{tournament.location}</p>
            </div>
          )}

          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-gray-400">👥</span>
            <div>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">{registeredCount}</span> de <span className="font-semibold">{tournament.max_players}</span> plazas ocupadas
              </p>
              <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-1.5 rounded-full bg-brand-500 transition-all"
                  style={{ width: `${Math.min((registeredCount / tournament.max_players) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-gray-400">💰</span>
            <p className="text-sm text-gray-700">
              {tournament.price_cents > 0
                ? <><span className="font-semibold">{(tournament.price_cents / 100).toFixed(2)} €</span> por jugador</>
                : 'Gratuito'}
            </p>
          </div>

          {allowedLevels.length > 0 && (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-gray-400">🎯</span>
              <div className="flex flex-wrap gap-1.5">
                {allowedLevels.map((l: any) => (
                  <span
                    key={l.id}
                    className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: l.color }}
                  >
                    {l.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {tournament.description && (
            <div className="border-t border-gray-50 pt-4">
              <p className="text-sm text-gray-600 whitespace-pre-line">{tournament.description}</p>
            </div>
          )}
        </div>

        {/* Acción */}
        <div className="border-t border-gray-50 px-6 pb-6 pt-4">
          <TournamentDetailClient
            tournamentId={tournament.id}
            status={tournament.status}
            priceCents={tournament.price_cents}
            maxPlayers={tournament.max_players}
            registeredCount={registeredCount}
            isRegistered={isRegistered}
          />
        </div>
      </div>
    </div>
  )
}
