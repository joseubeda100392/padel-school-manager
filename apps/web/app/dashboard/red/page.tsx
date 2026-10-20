export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getAuthUser } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getCoordinatorNetwork, getNetworkById, listCoordinatorCandidates, listCoordinators } from '@/lib/network'
import { loadClubStats, type ClubStats } from '@/lib/network-stats'
import { currentBillingMonth } from '@/lib/billing-cycle'
import { formatCurrency } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EnterClubButton } from './enter-club-button'
import { CoordinatorsPanel } from './coordinators-panel'

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// Vista de la red: una fila por sede con sus cifras y un botón para entrar a
// gestionarla. El coordinador ve solo su red; el super admin, la que abra
// desde Clubes (?id=), y además gestiona sus coordinadores.
export default async function NetworkPage({ searchParams }: { searchParams: { id?: string } }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const admin = getAdminClient()
  const { data: profile } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  const asSuperAdmin = profile?.role === 'super_admin'
  const network = asSuperAdmin
    ? (searchParams.id ? await getNetworkById(admin, searchParams.id) : null)
    : profile?.role === 'admin' ? await getCoordinatorNetwork(admin, user.id) : null
  if (!profile || !network) redirect(asSuperAdmin ? '/dashboard/clubs' : '/dashboard')

  const { year, month0 } = currentBillingMonth()
  const stats = await Promise.all(network.clubs.map(c => loadClubStats(admin, c, year, month0)))
  const total: Omit<ClubStats, 'id' | 'name'> = stats.reduce((acc, s) => ({
    students: acc.students + s.students,
    coaches: acc.coaches + s.coaches,
    classesToday: acc.classesToday + s.classesToday,
    groupsWithSpots: acc.groupsWithSpots + s.groupsWithSpots,
    collected: acc.collected + s.collected,
    pendingAmount: acc.pendingAmount + s.pendingAmount,
    pendingStudents: acc.pendingStudents + s.pendingStudents,
  }), { students: 0, coaches: 0, classesToday: 0, groupsWithSpots: 0, collected: 0, pendingAmount: 0, pendingStudents: 0 })
  const monthLabel = `${MONTHS[month0]} ${year}`
  const current = asSuperAdmin ? cookies().get('sa_active_club')?.value ?? null : profile.club_id
  const [coordinators, candidates] = asSuperAdmin
    ? await Promise.all([listCoordinators(admin, network.id), listCoordinatorCandidates(admin, network)])
    : [[], []]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Red ${network.name}`}
        description={`${network.clubs.length} sedes · cobros de ${monthLabel}. Entra en una para gestionarla como su admin.`}
      />

      <ul className="space-y-3 md:hidden">
        {stats.map(s => (
          <li key={s.id}>
            <Card className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="truncate text-heading text-ink">{s.name}</h2>
                {s.id === current && <Badge tone="success">Estás aquí</Badge>}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-meta">
                <MobileStat label="Alumnos activos" value={s.students} />
                <MobileStat label="Monitores" value={s.coaches} />
                <MobileStat label="Clases hoy" value={s.classesToday} />
                <MobileStat label="Grupos con plazas" value={s.groupsWithSpots} />
                <MobileStat label="Cobrado" value={formatCurrency(s.collected)} />
                <MobileStat label="Pendiente" value={`${formatCurrency(s.pendingAmount)} · ${s.pendingStudents} alumnos`} warn={s.pendingAmount > 0} />
              </dl>
              <EnterClubButton clubId={s.id} isCurrent={s.id === current} asSuperAdmin={asSuperAdmin} className="w-full" />
            </Card>
          </li>
        ))}
        <li>
          <Card className="space-y-2 bg-surface-2 p-4">
            <h2 className="text-label text-ink">Total de la red</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-meta">
              <MobileStat label="Alumnos activos" value={total.students} />
              <MobileStat label="Monitores" value={total.coaches} />
              <MobileStat label="Cobrado" value={formatCurrency(total.collected)} />
              <MobileStat label="Pendiente" value={formatCurrency(total.pendingAmount)} warn={total.pendingAmount > 0} />
            </dl>
          </Card>
        </li>
      </ul>

      <Card className="hidden overflow-x-auto md:block" tabIndex={0} role="region" aria-label="Sedes de la red">
        <table className="w-full text-left text-body">
          <thead className="border-b border-line bg-surface-2 text-meta text-ink-3">
            <tr>
              <th className="px-4 py-3 font-medium">Sede</th>
              <th className="px-4 py-3 text-right font-medium">Alumnos</th>
              <th className="px-4 py-3 text-right font-medium">Monitores</th>
              <th className="px-4 py-3 text-right font-medium">Clases hoy</th>
              <th className="px-4 py-3 text-right font-medium">Grupos con plazas</th>
              <th className="px-4 py-3 text-right font-medium">Cobrado</th>
              <th className="px-4 py-3 text-right font-medium">Pendiente</th>
              <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line tabular-nums">
            {stats.map(s => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium text-ink">
                  {s.name}
                  {s.id === current && <Badge tone="success" className="ml-2">Estás aquí</Badge>}
                </td>
                <td className="px-4 py-3 text-right">{s.students}</td>
                <td className="px-4 py-3 text-right">{s.coaches}</td>
                <td className="px-4 py-3 text-right">{s.classesToday}</td>
                <td className="px-4 py-3 text-right">{s.groupsWithSpots}</td>
                <td className="px-4 py-3 text-right text-accent-ink">{formatCurrency(s.collected)}</td>
                <td className={`px-4 py-3 text-right ${s.pendingAmount > 0 ? 'text-warn-ink' : ''}`}>
                  {formatCurrency(s.pendingAmount)}
                  <span className="block text-meta text-ink-3">{s.pendingStudents} alumnos</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <EnterClubButton clubId={s.id} isCurrent={s.id === current} asSuperAdmin={asSuperAdmin} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-line-strong bg-surface-2 font-medium tabular-nums text-ink">
            <tr>
              <td className="px-4 py-3">Total de la red</td>
              <td className="px-4 py-3 text-right">{total.students}</td>
              <td className="px-4 py-3 text-right">{total.coaches}</td>
              <td className="px-4 py-3 text-right">{total.classesToday}</td>
              <td className="px-4 py-3 text-right">{total.groupsWithSpots}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(total.collected)}</td>
              <td className="px-4 py-3 text-right">
                {formatCurrency(total.pendingAmount)}
                <span className="block text-meta font-normal text-ink-3">{total.pendingStudents} alumnos</span>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </Card>

      {asSuperAdmin && <CoordinatorsPanel networkId={network.id} networkName={network.name} coordinators={coordinators} candidates={candidates} />}
    </div>
  )
}

function MobileStat({ label, value, warn = false }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-ink-3">{label}</dt>
      <dd className={`truncate font-medium tabular-nums ${warn ? 'text-warn-ink' : 'text-ink'}`}>{value}</dd>
    </div>
  )
}
