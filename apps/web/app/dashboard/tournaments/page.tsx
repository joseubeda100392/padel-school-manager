export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Trophy, Plus } from 'lucide-react'
import { TournamentActions } from './tournament-actions'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { buttonVariants } from '@/components/ui/button'
import { formatLongDate } from '@/lib/format-date'

const statusLabel: Record<string, string> = { open: 'Abierto', closed: 'Cerrado', finished: 'Finalizado' }
const statusTone: Record<string, 'success' | 'warn' | 'neutral'> = {
  open: 'success',
  closed: 'warn',
  finished: 'neutral',
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
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Torneos"
        description={`${(tournaments ?? []).length} torneos creados`}
        actions={
          <Link href="/dashboard/tournaments/new" className={buttonVariants({ className: 'w-full sm:w-auto' })}>
            <Plus className="h-4 w-4" aria-hidden />
            Nuevo torneo
          </Link>
        }
      />

      {(!tournaments || tournaments.length === 0) ? (
        <Card>
          <EmptyState
            icon={<Trophy />}
            title="Todavía no hay torneos"
            description="Crea el primero para abrir inscripciones a tus alumnos."
            action={
              <Link href="/dashboard/tournaments/new" className={buttonVariants()}>
                Crear el primer torneo
              </Link>
            }
          />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {(tournaments ?? []).map((t: any) => {
              const count = t.registrations?.[0]?.count ?? 0
              return (
                <li key={t.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h2 className="text-heading text-ink">{t.name}</h2>
                        <Badge tone={statusTone[t.status] ?? 'neutral'}>{statusLabel[t.status] ?? t.status}</Badge>
                      </div>
                      <p className="text-body text-ink-2">{formatLongDate(t.tournament_date)}</p>
                      {t.location && <p className="text-meta text-ink-3">{t.location}</p>}
                      {t.description && <p className="mt-1 text-body text-ink-2">{t.description}</p>}
                      <div className="mt-2 flex flex-wrap gap-4 text-meta tabular-nums text-ink-3">
                        <span>{count} / {t.max_players} inscritos</span>
                        {t.price_cents > 0 && <span>{(t.price_cents / 100).toFixed(2)} €</span>}
                        {t.price_cents === 0 && <span>Gratuito</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Link href={`/dashboard/tournaments/${t.id}`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                        Ver inscritos
                      </Link>
                      <Link href={`/dashboard/tournaments/${t.id}/edit`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                        Editar
                      </Link>
                      <TournamentActions tournamentId={t.id} currentStatus={t.status} />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
