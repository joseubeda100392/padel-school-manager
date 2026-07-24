import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getClubFeatures } from '@/lib/get-club-features'
import { formatCurrency } from '@/lib/utils'

const DEFAULT_CFG = {
  pay_per_class_price_60: 1200,
  pay_per_class_price_90: 1500,
  pack_price_60: 9000,
  classes_per_pack_60: 10,
  pack_price_90: 12000,
  classes_per_pack_90: 10,
  cancellation_hours: 24,
}

export default async function CoachTarifasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const { data: profile } = await admin.from('users').select('club_id').eq('id', user.id).single()
  const clubId = profile?.club_id ?? null

  const [features, { data: clubRow }] = await Promise.all([
    getClubFeatures(clubId),
    clubId
      ? admin.from('clubs').select('config').eq('id', clubId).single()
      : { data: null },
  ])

  const cfg = { ...DEFAULT_CFG, ...((clubRow as any)?.config ?? {}) }

  const hasPrices = features.enable_payments && (features.enable_60min || features.enable_90min)
  const hasPacks = features.enable_bag && (features.enable_60min || features.enable_90min)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tarifas</h1>
        <p className="text-sm text-gray-500">Precios actuales de clases y bonos</p>
      </div>

      {hasPrices && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Clase suelta</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {features.enable_60min && (
              <div className="rounded-lg border border-gray-100 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">1 hora</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {formatCurrency(cfg.pay_per_class_price_60)}
                </p>
                <p className="text-xs text-gray-400">por clase</p>
              </div>
            )}
            {features.enable_90min && (
              <div className="rounded-lg border border-gray-100 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">1h 30min</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {formatCurrency(cfg.pay_per_class_price_90)}
                </p>
                <p className="text-xs text-gray-400">por clase</p>
              </div>
            )}
          </div>
        </div>
      )}

      {hasPacks && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Bonos de clases</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {features.enable_60min && (
              <div className="rounded-lg border border-brand-100 bg-brand-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-brand-400">Bono 1 hora</p>
                <p className="mt-1 text-2xl font-bold text-brand-700">
                  {formatCurrency(cfg.pack_price_60)}
                </p>
                <p className="text-sm text-brand-600">
                  {cfg.classes_per_pack_60} clases incluidas
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatCurrency(Math.round(cfg.pack_price_60 / cfg.classes_per_pack_60))} / clase
                </p>
              </div>
            )}
            {features.enable_90min && (
              <div className="rounded-lg border border-brand-100 bg-brand-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-brand-400">Bono 1h 30min</p>
                <p className="mt-1 text-2xl font-bold text-brand-700">
                  {formatCurrency(cfg.pack_price_90)}
                </p>
                <p className="text-sm text-brand-600">
                  {cfg.classes_per_pack_90} clases incluidas
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatCurrency(Math.round(cfg.pack_price_90 / cfg.classes_per_pack_90))} / clase
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {features.enable_bag && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-semibold text-gray-900">Política de cancelación</h2>
          <p className="text-sm text-gray-600">
            Si el alumno cancela con menos de{' '}
            <strong>{cfg.cancellation_hours} horas</strong> de antelación, el crédito de clase <strong>no</strong> se devuelve a la bolsa.
          </p>
        </div>
      )}

      {!hasPrices && !hasPacks && (
        <div className="rounded-xl bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-400">No hay tarifas configuradas actualmente.</p>
        </div>
      )}
    </div>
  )
}
