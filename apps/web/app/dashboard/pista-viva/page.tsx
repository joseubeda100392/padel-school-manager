import Link from 'next/link'
import { Settings, TriangleAlert, CircleCheck, Clock, CircleX } from 'lucide-react'
import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import { PendingMatchesPanel } from './pending-matches-panel'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Notice } from '@/components/ui/feedback'
import { Stat } from '@/components/ui/list'
import { buttonVariants } from '@/components/ui/button'
import { formatShortDay, formatClock } from '@/lib/format-date'

const statusTone: Record<string, 'neutral' | 'success' | 'danger'> = {
  sent: 'neutral',
  recovered: 'success',
  lost: 'danger',
}
const statusIcon: Record<string, React.ReactNode> = {
  sent: <Clock className="h-3.5 w-3.5" aria-hidden />,
  recovered: <CircleCheck className="h-3.5 w-3.5" aria-hidden />,
  lost: <CircleX className="h-3.5 w-3.5" aria-hidden />,
}
const statusLabel: Record<string, string> = {
  sent: 'Avisado, esperando',
  recovered: 'Recuperado',
  lost: 'Perdido',
}

export default async function PistaVivaPage() {
  const clubId = await getClubId()
  const admin = getAdminClient()

  const { data: clubConfig } = await admin
    .from('clubs')
    .select('playtomic_client_id, playtomic_client_secret, playtomic_tenant_id')
    .eq('id', clubId!)
    .single()

  const needsSetup = !clubConfig?.playtomic_client_id || !clubConfig?.playtomic_client_secret || !clubConfig?.playtomic_tenant_id

  const [{ data: alerts }, { count: totalStudents }, { count: optedInStudents }] = await Promise.all([
    admin
      .from('pista_viva_open_match_alerts')
      .select('*')
      .eq('club_id', clubId!)
      .order('slot_datetime', { ascending: false })
      .limit(100),
    admin.from('users').select('id', { count: 'exact', head: true }).eq('club_id', clubId!).eq('role', 'student'),
    admin.from('users').select('id', { count: 'exact', head: true }).eq('club_id', clubId!).eq('role', 'student').eq('pista_viva_optin', true),
  ])

  const stats = {
    watching: (alerts ?? []).filter((a) => a.status === 'sent').length,
    recovered: (alerts ?? []).filter((a) => a.status === 'recovered').length,
    lost: (alerts ?? []).filter((a) => a.status === 'lost').length,
    optedIn: optedInStudents ?? 0,
    totalStudents: totalStudents ?? 0,
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Pista Viva"
        description="Detecta partidos abiertos en Playtomic a los que les faltan jugadores y avisa a tus alumnos."
        actions={
          <Link href="/dashboard/settings#playtomic" className={buttonVariants({ variant: 'secondary', className: 'w-full sm:w-auto' })}>
            <Settings className="h-4 w-4" aria-hidden />
            Configurar Playtomic
          </Link>
        }
      />

      <Card>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 p-4 sm:p-5 lg:grid-cols-4">
          <Stat label="Vigilando" value={stats.watching} />
          <Stat label="Recuperados" value={stats.recovered} />
          <Stat label="Perdidos" value={stats.lost} />
          <Stat
            label="Alumnos con Pista Viva activo"
            value={
              <>
                {stats.optedIn} <span className="font-sans text-label text-ink-3">de {stats.totalStudents}</span>
              </>
            }
          />
        </div>
      </Card>

      {needsSetup && (
        <Notice
          tone="warn"
          icon={<TriangleAlert />}
          action={
            <Link href="/dashboard/settings#playtomic" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              Configurar ahora
            </Link>
          }
        >
          <span className="font-medium">Configuración pendiente.</span> Para usar Pista Viva necesitas introducir tus credenciales oficiales de Playtomic.
        </Notice>
      )}

      <p className="max-w-2xl text-body text-ink-2">
        Detecta automáticamente (cada pocos minutos) partidos abiertos en Playtomic a los que les faltan 3, 2 o 1 jugadores,
        y avisa a los alumnos del club con opt-in activo y nivel compatible.
      </p>

      {!needsSetup && <PendingMatchesPanel />}

      <Card>
        <CardHeader title="Partidos detectados" />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-y border-line bg-surface-2">
                <th scope="col" className="px-4 py-3 text-left text-meta font-medium text-ink-3 sm:px-5">Pista</th>
                <th scope="col" className="px-4 py-3 text-left text-meta font-medium text-ink-3">Fecha y hora</th>
                <th scope="col" className="px-4 py-3 text-left text-meta font-medium text-ink-3">Nivel</th>
                <th scope="col" className="px-4 py-3 text-left text-meta font-medium text-ink-3">Avisados</th>
                <th scope="col" className="px-4 py-3 text-left text-meta font-medium text-ink-3 sm:pr-5">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!alerts?.length && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-body text-ink-2">
                    Todavía no se ha detectado ningún partido. El escaneo se ejecuta automáticamente cada pocos minutos.
                  </td>
                </tr>
              )}
              {(alerts ?? []).map((a: any) => {
                const day = formatShortDay(a.slot_datetime)
                return (
                  <tr key={a.id}>
                    <td className="px-4 py-3 text-body font-medium text-ink sm:px-5">{a.court_name ?? '—'}</td>
                    <td className="px-4 py-3 text-body tabular-nums text-ink-2">
                      {day.weekday} {day.day} · {formatClock(a.slot_datetime)}
                    </td>
                    <td className="px-4 py-3 text-body tabular-nums text-ink-2">
                      {a.level_min != null && a.level_max != null ? `${a.level_min.toFixed(2)} – ${a.level_max.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-body tabular-nums text-ink-2">{(a.notified_user_ids ?? []).length}</td>
                    <td className="px-4 py-3 sm:pr-5">
                      <Badge tone={statusTone[a.status] ?? 'neutral'}>
                        {statusIcon[a.status]}
                        {statusLabel[a.status] ?? a.status}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
