import Link from 'next/link'
import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'

const statusBadge: Record<string, string> = {
  sent: 'bg-blue-100 text-blue-700',
  recovered: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-600',
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

  const { data: alerts } = await admin
    .from('pista_viva_open_match_alerts')
    .select('*')
    .eq('club_id', clubId!)
    .order('slot_datetime', { ascending: false })
    .limit(100)

  const stats = {
    watching: (alerts ?? []).filter((a) => a.status === 'sent').length,
    recovered: (alerts ?? []).filter((a) => a.status === 'recovered').length,
    lost: (alerts ?? []).filter((a) => a.status === 'lost').length,
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
        <Link
          href="/dashboard/settings#playtomic"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          ⚙️ Configurar Playtomic
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Vigilando</p>
          <p className="mt-1 text-3xl font-bold text-blue-600">{stats.watching}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Recuperados</p>
          <p className="mt-1 text-3xl font-bold text-green-600">{stats.recovered}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Perdidos</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{stats.lost}</p>
        </div>
      </div>

      {/* Aviso de configuración pendiente */}
      {needsSetup && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <span className="font-medium">⚙️ Configuración pendiente.</span>{' '}
          Para usar Pista Viva necesitas introducir tus credenciales oficiales de Playtomic.{' '}
          <Link href="/dashboard/settings#playtomic" className="font-medium underline hover:no-underline">
            Configurar ahora →
          </Link>
        </div>
      )}

      <p className="text-sm text-gray-500">
        Detecta automáticamente (cada pocos minutos) partidos abiertos en Playtomic a los que les falta 1-2 jugadores,
        y avisa a los socios del club con opt-in activo y nivel compatible.
      </p>

      {/* Lista de partidos vigilados */}
      <div className="rounded-xl bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Partidos detectados</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Pista</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Fecha / Hora</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Nivel</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Avisados</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!alerts?.length && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    Todavía no se ha detectado ningún partido. El escaneo se ejecuta automáticamente cada pocos minutos.
                  </td>
                </tr>
              )}
              {(alerts ?? []).map((a: any) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{a.court_name ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(a.slot_datetime).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' '}
                    {new Date(a.slot_datetime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {a.level_min != null && a.level_max != null ? `${a.level_min.toFixed(2)} – ${a.level_max.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{(a.notified_user_ids ?? []).length}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge[a.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {statusLabel[a.status] ?? a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
