export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TournamentActions } from './tournament-actions'

const statusLabel: Record<string, string> = { open: 'Abierto', closed: 'Cerrado', finished: 'Finalizado' }
const statusColor: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-yellow-100 text-yellow-700',
  finished: 'bg-gray-100 text-gray-500',
}

export default async function TournamentsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const clubId = await getClubId()

  const { getClubFeatures } = await import('@/lib/get-club-features')
  const features = await getClubFeatures(clubId ?? undefined)
  if (!features.enable_tournaments) redirect('/dashboard')

  const { data: tournaments } = await admin
    .from('tournaments')
    .select('*, registrations:tournament_registrations(count)')
    .eq('club_id', clubId ?? '')
    .order('tournament_date', { ascending: false })

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Torneos</h1>
          <p className="text-sm text-gray-500">{(tournaments ?? []).length} torneos creados</p>
        </div>
        <Link
          href="/dashboard/tournaments/new"
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          + Nuevo torneo
        </Link>
      </div>

      {(!tournaments || tournaments.length === 0) ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <p className="text-2xl mb-2">🏆</p>
          <p className="text-gray-400">No hay torneos creados todavía.</p>
          <Link href="/dashboard/tournaments/new" className="mt-3 inline-block text-sm text-brand-500 hover:underline">
            Crear el primero
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {(tournaments ?? []).map((t: any) => {
            const count = t.registrations?.[0]?.count ?? 0
            const dateLabel = new Date(t.tournament_date + 'T12:00:00').toLocaleDateString('es-ES', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })
            return (
              <div key={t.id} className="rounded-xl bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="font-semibold text-gray-900">{t.name}</h2>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[t.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {statusLabel[t.status] ?? t.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 capitalize">{dateLabel}</p>
                    {t.location && <p className="text-sm text-gray-400">{t.location}</p>}
                    {t.description && <p className="mt-1 text-sm text-gray-500">{t.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-400">
                      <span>{count} / {t.max_players} inscritos</span>
                      {t.price_cents > 0 && <span>{(t.price_cents / 100).toFixed(2)} €</span>}
                      {t.price_cents === 0 && <span>Gratuito</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/dashboard/tournaments/${t.id}`}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Ver inscritos
                    </Link>
                    <Link
                      href={`/dashboard/tournaments/${t.id}/edit`}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Editar
                    </Link>
                    <TournamentActions tournamentId={t.id} currentStatus={t.status} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
