export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { TournamentActions } from '../tournament-actions'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { List, ListRow, Avatar } from '@/components/ui/list'
import { buttonVariants } from '@/components/ui/button'
import { formatLongDate } from '@/lib/format-date'

const statusLabel: Record<string, string> = { open: 'Abierto', closed: 'Cerrado', finished: 'Finalizado' }
const statusTone: Record<string, 'success' | 'warn' | 'neutral'> = {
  open: 'success',
  closed: 'warn',
  finished: 'neutral',
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

  const dateLabel = formatLongDate(tournament.tournament_date)

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        back={{ href: '/dashboard/tournaments', label: 'Torneos' }}
        title={tournament.name}
        description={dateLabel}
        actions={
          <Link
            href={`/dashboard/tournaments/${params.id}/edit`}
            className={buttonVariants({ variant: 'secondary', className: 'w-full sm:w-auto' })}
          >
            Editar
          </Link>
        }
      />

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0">
            <Badge tone={statusTone[tournament.status] ?? 'neutral'}>{statusLabel[tournament.status] ?? tournament.status}</Badge>
            {tournament.location && <p className="mt-2 text-body text-ink-2">{tournament.location}</p>}
            {tournament.description && <p className="mt-2 text-body text-ink-2">{tournament.description}</p>}
            <div className="mt-3 flex flex-wrap gap-4 text-body tabular-nums text-ink-2">
              <span>{(registrations ?? []).length} / {tournament.max_players} inscritos</span>
              <span>{tournament.price_cents > 0 ? `${(tournament.price_cents / 100).toFixed(2)} €` : 'Gratuito'}</span>
            </div>
          </div>
          <TournamentActions tournamentId={tournament.id} currentStatus={tournament.status} />
        </div>
      </Card>

      <Card>
        <CardHeader title={`Inscritos (${(registrations ?? []).length})`} />
        {(!registrations || registrations.length === 0) ? (
          <EmptyState title="Nadie inscrito todavía" description="Los alumnos aparecerán aquí cuando se apunten." />
        ) : (
          <List className="mt-3 border-t border-line">
            {(registrations ?? []).map((r: any, idx: number) => {
              const student = r.student
              return (
                <ListRow
                  key={r.id}
                  leading={<Avatar name={student?.name ?? '?'} />}
                  title={`${idx + 1}. ${student?.name ?? '—'}`}
                  subtitle={student?.email ?? '—'}
                  trailing={<span className="text-meta tabular-nums text-ink-3">{formatLongDate(r.created_at, { weekday: false })}</span>}
                />
              )
            })}
          </List>
        )}
      </Card>
    </div>
  )
}
