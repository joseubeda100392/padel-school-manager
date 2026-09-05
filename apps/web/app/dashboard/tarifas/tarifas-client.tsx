'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'

interface Config {
  pay_per_class_price_60: number
  pay_per_class_price_90: number
  pack_price_60: number
  classes_per_pack_60: number
  pack_price_90: number
  classes_per_pack_90: number
  cancellation_hours: number
  max_recovery_classes: number
  // Módulo enable_private_lessons (exclusivo R3)
  pay_per_class_price_60_external: number
  pay_per_class_price_90_external: number
  pack_price_60_external: number
  classes_per_pack_60_external: number
  pack_price_90_external: number
  classes_per_pack_90_external: number
  private_lesson_price_60: number
  private_lesson_price_90: number
  private_lesson_price_60_external: number
  private_lesson_price_90_external: number
  private_lesson_price_60_premium: number
  private_lesson_price_90_premium: number
  private_lesson_price_60_premium_external: number
  private_lesson_price_90_premium_external: number
  private_lesson_pack_price_60: number
  private_lesson_pack_classes_60: number
  private_lesson_pack_price_90: number
  private_lesson_pack_classes_90: number
  private_lesson_pack_price_60_external: number
  private_lesson_pack_classes_60_external: number
  private_lesson_pack_price_90_external: number
  private_lesson_pack_classes_90_external: number
  private_lesson_pack_price_60_premium: number
  private_lesson_pack_classes_60_premium: number
  private_lesson_pack_price_90_premium: number
  private_lesson_pack_classes_90_premium: number
  private_lesson_pack_price_60_premium_external: number
  private_lesson_pack_classes_60_premium_external: number
  private_lesson_pack_price_90_premium_external: number
  private_lesson_pack_classes_90_premium_external: number
}

interface Features {
  enable_60min: boolean
  enable_90min: boolean
  enable_payments: boolean
  enable_bag: boolean
  enable_private_lessons: boolean
}

const DEFAULT_CFG: Config = {
  pay_per_class_price_60: 1200,
  pay_per_class_price_90: 1500,
  pack_price_60: 9000,
  classes_per_pack_60: 10,
  pack_price_90: 12000,
  classes_per_pack_90: 10,
  cancellation_hours: 24,
  max_recovery_classes: 0,
  pay_per_class_price_60_external: 0,
  pay_per_class_price_90_external: 0,
  pack_price_60_external: 0,
  classes_per_pack_60_external: 0,
  pack_price_90_external: 0,
  classes_per_pack_90_external: 0,
  private_lesson_price_60: 0,
  private_lesson_price_90: 0,
  private_lesson_price_60_external: 0,
  private_lesson_price_90_external: 0,
  private_lesson_price_60_premium: 0,
  private_lesson_price_90_premium: 0,
  private_lesson_price_60_premium_external: 0,
  private_lesson_price_90_premium_external: 0,
  private_lesson_pack_price_60: 0,
  private_lesson_pack_classes_60: 0,
  private_lesson_pack_price_90: 0,
  private_lesson_pack_classes_90: 0,
  private_lesson_pack_price_60_external: 0,
  private_lesson_pack_classes_60_external: 0,
  private_lesson_pack_price_90_external: 0,
  private_lesson_pack_classes_90_external: 0,
  private_lesson_pack_price_60_premium: 0,
  private_lesson_pack_classes_60_premium: 0,
  private_lesson_pack_price_90_premium: 0,
  private_lesson_pack_classes_90_premium: 0,
  private_lesson_pack_price_60_premium_external: 0,
  private_lesson_pack_classes_60_premium_external: 0,
  private_lesson_pack_price_90_premium_external: 0,
  private_lesson_pack_classes_90_premium_external: 0,
}

const DEFAULT_FEATURES: Features = {
  enable_60min: true,
  enable_90min: true,
  enable_payments: true,
  enable_bag: true,
  enable_private_lessons: false,
}

function intVal(s: string): number {
  const n = parseInt(s.replace(/\D/g, ''), 10)
  return isNaN(n) ? 0 : n
}

function priceVal(s: string): number {
  const n = parseFloat(s.replace(',', '.').replace(/[^\d.]/g, ''))
  return isNaN(n) ? 0 : Math.round(n * 100)
}

function displayPrice(cents: number): string {
  return cents === 0 ? '' : (cents / 100).toString()
}

function displayInt(n: number): string {
  return n === 0 ? '' : n.toString()
}

function PriceField({ label, value, onChange }: { label: string; value: number; onChange: (cents: number) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          onFocus={e => e.target.select()}
          value={displayPrice(value)}
          onChange={e => onChange(priceVal(e.target.value))}
          className="w-full rounded-lg border border-gray-200 px-4 py-2.5 pr-8 text-sm focus:border-brand-500 focus:outline-none"
        />
        <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-gray-400">€</span>
      </div>
    </div>
  )
}

function CountField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="text"
        inputMode="numeric"
        onFocus={e => e.target.select()}
        value={displayInt(value)}
        onChange={e => onChange(intVal(e.target.value))}
        className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
      />
    </div>
  )
}

export function TarifasClient() {
  const [config, setConfig] = useState<Config>(DEFAULT_CFG)
  const [features, setFeatures] = useState<Features>(DEFAULT_FEATURES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/club-config').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/admin/club-features').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([cfgData, featData]) => {
      if (cfgData?.config) setConfig(prev => ({ ...prev, ...cfgData.config }))
      if (featData?.features) setFeatures(prev => ({ ...prev, ...featData.features }))
      setLoading(false)
    })
  }, [])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/club-config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      toast.success('Tarifas guardadas')
    } else {
      const j = await res.json().catch(() => ({}))
      toast.error(j.error ?? 'Error al guardar')
    }
  }

  if (loading) return <div className="text-sm text-gray-400">Cargando...</div>

  const hasPrices = features.enable_payments && (features.enable_60min || features.enable_90min)
  const hasPacks = features.enable_bag && (features.enable_60min || features.enable_90min)

  return (
    <div className="space-y-5">
      {hasPrices && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Clase suelta</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {features.enable_60min && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Clase 1 hora (€)</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    onFocus={e => e.target.select()}
                    value={displayPrice(config.pay_per_class_price_60)}
                    onChange={e => setConfig({ ...config, pay_per_class_price_60: priceVal(e.target.value) })}
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 pr-8 text-sm focus:border-brand-500 focus:outline-none"
                  />
                  <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-gray-400">€</span>
                </div>
              </div>
            )}
            {features.enable_90min && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Clase 1h 30min (€)</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    onFocus={e => e.target.select()}
                    value={displayPrice(config.pay_per_class_price_90)}
                    onChange={e => setConfig({ ...config, pay_per_class_price_90: priceVal(e.target.value) })}
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 pr-8 text-sm focus:border-brand-500 focus:outline-none"
                  />
                  <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-gray-400">€</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {hasPacks && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Bonos de clases</h2>
          {features.enable_60min && (
            <>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Bono 1 hora</p>
              <div className="mb-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Clases por bono</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    onFocus={e => e.target.select()}
                    value={displayInt(config.classes_per_pack_60)}
                    onChange={e => setConfig({ ...config, classes_per_pack_60: intVal(e.target.value) })}
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Precio del bono (€)</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      onFocus={e => e.target.select()}
                      value={displayPrice(config.pack_price_60)}
                      onChange={e => setConfig({ ...config, pack_price_60: priceVal(e.target.value) })}
                      className="w-full rounded-lg border border-gray-200 px-4 py-2.5 pr-8 text-sm focus:border-brand-500 focus:outline-none"
                    />
                    <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-gray-400">€</span>
                  </div>
                </div>
              </div>
              <p className="mb-5 text-xs text-gray-400">
                Precio por clase: {config.classes_per_pack_60 > 0 ? ((config.pack_price_60 / config.classes_per_pack_60) / 100).toFixed(2) : '0.00'} €
              </p>
            </>
          )}
          {features.enable_90min && (
            <>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Bono 1h 30min</p>
              <div className="mb-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Clases por bono</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    onFocus={e => e.target.select()}
                    value={displayInt(config.classes_per_pack_90)}
                    onChange={e => setConfig({ ...config, classes_per_pack_90: intVal(e.target.value) })}
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Precio del bono (€)</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      onFocus={e => e.target.select()}
                      value={displayPrice(config.pack_price_90)}
                      onChange={e => setConfig({ ...config, pack_price_90: priceVal(e.target.value) })}
                      className="w-full rounded-lg border border-gray-200 px-4 py-2.5 pr-8 text-sm focus:border-brand-500 focus:outline-none"
                    />
                    <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-gray-400">€</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Precio por clase: {config.classes_per_pack_90 > 0 ? ((config.pack_price_90 / config.classes_per_pack_90) / 100).toFixed(2) : '0.00'} €
              </p>
            </>
          )}
        </div>
      )}

      {features.enable_private_lessons && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-semibold text-gray-900">Alumno externo</h2>
          <p className="mb-4 text-xs text-gray-400">
            Tarifas para alumnos marcados como "externo" en su ficha — no ven los huecos libres de las clases fijas de la escuela.
          </p>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Clase suelta externa</p>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {features.enable_60min && (
              <PriceField label="Clase 1 hora (€)" value={config.pay_per_class_price_60_external} onChange={v => setConfig({ ...config, pay_per_class_price_60_external: v })} />
            )}
            {features.enable_90min && (
              <PriceField label="Clase 1h 30min (€)" value={config.pay_per_class_price_90_external} onChange={v => setConfig({ ...config, pay_per_class_price_90_external: v })} />
            )}
          </div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Bono externo</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {features.enable_60min && (
              <>
                <CountField label="Bono 1h — clases por bono" value={config.classes_per_pack_60_external} onChange={v => setConfig({ ...config, classes_per_pack_60_external: v })} />
                <PriceField label="Bono 1h — precio (€)" value={config.pack_price_60_external} onChange={v => setConfig({ ...config, pack_price_60_external: v })} />
              </>
            )}
            {features.enable_90min && (
              <>
                <CountField label="Bono 1h30 — clases por bono" value={config.classes_per_pack_90_external} onChange={v => setConfig({ ...config, classes_per_pack_90_external: v })} />
                <PriceField label="Bono 1h30 — precio (€)" value={config.pack_price_90_external} onChange={v => setConfig({ ...config, pack_price_90_external: v })} />
              </>
            )}
          </div>
        </div>
      )}

      {features.enable_private_lessons && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-semibold text-gray-900">Clase particular</h2>
          <p className="mb-4 text-xs text-gray-400">
            Clase 1 a 1 con un monitor. Cualquier alumno puede pedirla, de la escuela o externo. Si el monitor tiene marcada la tarifa premium en su ficha, se aplica el precio premium.
          </p>
          {(['60', '90'] as const).map(dur => (
            <div key={dur} className={dur === '60' ? 'mb-5' : ''}>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">{dur === '60' ? 'Clase particular 1 hora' : 'Clase particular 1h 30min'}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <PriceField
                  label="Alumno de la escuela (€)"
                  value={config[`private_lesson_price_${dur}` as keyof Config]}
                  onChange={v => setConfig({ ...config, [`private_lesson_price_${dur}`]: v })}
                />
                <PriceField
                  label="Alumno externo (€)"
                  value={config[`private_lesson_price_${dur}_external` as keyof Config]}
                  onChange={v => setConfig({ ...config, [`private_lesson_price_${dur}_external`]: v })}
                />
                <PriceField
                  label="Alumno de la escuela · monitor premium (€)"
                  value={config[`private_lesson_price_${dur}_premium` as keyof Config]}
                  onChange={v => setConfig({ ...config, [`private_lesson_price_${dur}_premium`]: v })}
                />
                <PriceField
                  label="Alumno externo · monitor premium (€)"
                  value={config[`private_lesson_price_${dur}_premium_external` as keyof Config]}
                  onChange={v => setConfig({ ...config, [`private_lesson_price_${dur}_premium_external`]: v })}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {features.enable_private_lessons && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-semibold text-gray-900">Bono de clase particular</h2>
          <p className="mb-4 text-xs text-gray-400">
            Pack de créditos que solo valen para clases particulares.
          </p>
          {(['60', '90'] as const).map(dur => (
            <div key={dur} className={dur === '60' ? 'mb-6' : ''}>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">{dur === '60' ? 'Bono particular 1 hora' : 'Bono particular 1h 30min'}</p>
              {([
                { suffix: '', label: 'Alumno de la escuela' },
                { suffix: '_external', label: 'Alumno externo' },
                { suffix: '_premium', label: 'Alumno de la escuela · monitor premium' },
                { suffix: '_premium_external', label: 'Alumno externo · monitor premium' },
              ] as const).map(({ suffix, label }) => (
                <div key={suffix} className="mb-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <CountField
                    label={`${label} — clases por bono`}
                    value={config[`private_lesson_pack_classes_${dur}${suffix}` as keyof Config]}
                    onChange={v => setConfig({ ...config, [`private_lesson_pack_classes_${dur}${suffix}`]: v })}
                  />
                  <PriceField
                    label={`${label} — precio (€)`}
                    value={config[`private_lesson_pack_price_${dur}${suffix}` as keyof Config]}
                    onChange={v => setConfig({ ...config, [`private_lesson_pack_price_${dur}${suffix}`]: v })}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {features.enable_bag && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-semibold text-gray-900">Política de cancelación</h2>
          <p className="mb-4 text-xs text-gray-400">Si el alumno cancela con menos de X horas, el crédito <strong>no</strong> se devuelve.</p>
          <div className="flex items-center gap-3">
            <input
              type="text"
              inputMode="numeric"
              onFocus={e => e.target.select()}
              value={displayInt(config.cancellation_hours)}
              onChange={e => setConfig({ ...config, cancellation_hours: intVal(e.target.value) })}
              className="w-28 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
            />
            <span className="text-sm text-gray-500">horas antes del inicio</span>
          </div>
        </div>
      )}

      {!hasPrices && !hasPacks && (
        <p className="text-sm text-gray-400">
          Activa los módulos de pagos o bolsa en{' '}
          <Link href="/dashboard/settings" className="text-brand-500 hover:underline">Configuración → Módulos</Link>
          {' '}para configurar precios.
        </p>
      )}

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-1 font-semibold text-gray-900">Clases de recuperación</h2>
        <p className="mb-4 text-xs text-gray-400">
          Máximo de clases de recuperación pendientes acumuladas por alumno. Las clases de bono no cuentan.
          Pon <strong>0</strong> para no aplicar límite.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="text"
            inputMode="numeric"
            onFocus={e => e.target.select()}
            value={displayInt(config.max_recovery_classes)}
            onChange={e => setConfig({ ...config, max_recovery_classes: intVal(e.target.value) })}
            className="w-24 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
          <span className="text-sm text-gray-500">
            {config.max_recovery_classes === 0 ? 'sin límite' : 'clases máximo'}
          </span>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar tarifas'}
      </button>
    </div>
  )
}
