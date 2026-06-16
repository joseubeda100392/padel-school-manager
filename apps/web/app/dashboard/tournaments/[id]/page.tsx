export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { TournamentActions } from '../tournament-actions'

const statusLabel: Record<string, string> = { open: 'Abierto', closed: 'Cerrado', finished: 'Finalizado' }
const statusColor: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-yellow-100 text-yellow-700',
  finished: 'bg-gray-100 text-gray-500',
}

export default async function TournamentDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()

  const { data: tournament } = await admin
    .from('tournaments')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!tournament) notFound()

  const { data: registrations } = await admin
    .from('tournament_registrations')
    .select('id, created_at, student:users!student_id(name, email)')
    .eq('tournament_id', params.id)
    .order('created_at')

  const dateLabel = new Date(tournament.tournament_date + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/tournaments" className="text-sm text-gray-400 hover:text-gray-600">
          ← Torneos
        </Link>
        <Link
          href={`/dashboard/tournaments/${params.id}/edit`}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Editar
        </Link>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{tournament.name}</h1>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[tournament.status] ?? 'bg-gray-100 text-gray-500'}`}>
                {statusLabel[tournament.status] ?? tournament.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 capitalize">{dateLabel}</p>
            {tournament.location && <p className="text-sm text-gray-400">{tournament.location}</p>}
            {tournament.description && <p className="mt-2 text-sm text-gray-600">{tournament.description}</p>}
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
              <span>{(registrations ?? []).length} / {tournament.max_players} inscritos</span>
              <span>{tournament.price_cents > 0 ? `${(tournament.price_cents / 100).toFixed(2)} €` : 'Gratuito'}</span>
            </div>
          </div>
          <TournamentActions tournamentId={tournament.id} currentStatus={tournament.status} />
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="border-b border-gray-50 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Inscritos ({(registrations ?? []).length})</h2>
        </div>
        {(!registrations || registrations.length === 0) ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 text-sm">Nadie inscrito todavía.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {(registrations ?? []).map((r: any, idx: number) => {
              const student = r.student
              const initials = (student?.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
              return (
                <div key={r.id} className="flex items-center gap-4 px-6 py-3">
                  <span className="text-xs text-gray-400 w-5">{idx + 1}</span>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{student?.name ?? '—'}</p>
                    <p className="text-xs text-gray-400">{student?.email ?? '—'}</p>
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(r.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
