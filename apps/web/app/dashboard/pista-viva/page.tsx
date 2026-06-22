import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import SlotsPanel from './slots-panel'
import CampaignsList from './campaigns-list'


export default async function PistaVivaPage() {
  const clubId = await getClubId()
  const admin = getAdminClient()

  const { data: clubConfig } = await admin
    .from('clubs')
    .select('playtomic_tenant_id, playtomic_email')
    .eq('id', clubId!)
    .single()

  const needsSetup = !clubConfig?.playtomic_tenant_id || !clubConfig?.playtomic_email

  const { data: campaigns } = await admin
    .from('pista_viva_campaigns')
    .select('*, levels(name)')
    .eq('club_id', clubId!)
    .order('slot_datetime', { ascending: false })
    .limit(100)

  const stats = {
    sent: (campaigns ?? []).filter((c) => c.status === 'sent').length,
    converted: (campaigns ?? []).filter((c) => c.status === 'converted').length,
    clicks: (campaigns ?? []).reduce((acc, c) => acc + (c.click_count ?? 0), 0),
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pista Viva ⚡</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Detecta pistas libres en Playtomic y notifica a tus socios
          </p>
        </div>
        <a
          href="/dashboard/settings#playtomic"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          ⚙️ Configurar Playtomic
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">En curso</p>
          <p className="mt-1 text-3xl font-bold text-blue-600">{stats.sent}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Convertidas</p>
          <p className="mt-1 text-3xl font-bold text-green-600">{stats.converted}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Clics totales</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{stats.clicks}</p>
        </div>
      </div>

      {/* Aviso de configuración pendiente */}
      {needsSetup && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <span className="font-medium">⚙️ Configuración pendiente.</span>{' '}
          Para usar Pista Viva necesitas introducir tus credenciales de Playtomic.{' '}
          <a href="/dashboard/settings#playtomic" className="font-medium underline hover:no-underline">
            Configurar ahora →
          </a>
        </div>
      )}

      {/* Panel de búsqueda de pistas libres */}
      <SlotsPanel clubId={clubId!} />

      {/* Lista de campañas */}
      <div className="rounded-xl bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Campañas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Pista</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Fecha / Hora</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Nivel</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Jugadores</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Clics</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Estado</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <CampaignsList campaigns={campaigns ?? []} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
