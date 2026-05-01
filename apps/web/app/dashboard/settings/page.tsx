'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AppConfig {
  pay_per_class_price: number
  classes_per_pack: number
  pack_price: number
  school_name: string
}

const defaults: AppConfig = {
  pay_per_class_price: 1200,
  classes_per_pack: 10,
  pack_price: 9000,
  school_name: 'Mi Escuela de Pádel',
}

export default function SettingsPage() {
  const [config, setConfig] = useState<AppConfig>(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [courts, setCourts] = useState<any[]>([])
  const [newCourt, setNewCourt] = useState({ name: '', type: 'indoor' })
  const [addingCourt, setAddingCourt] = useState(false)
  const [courtError, setCourtError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('app_config').select('key, value'),
      supabase.from('courts').select('*').order('name'),
    ]).then(([{ data: cfg }, { data: c }]) => {
      if (cfg) {
        const merged = { ...defaults }
        cfg.forEach((row: any) => {
          if (row.key in merged) {
            ;(merged as any)[row.key] =
              typeof (defaults as any)[row.key] === 'number' ? Number(row.value) : row.value
          }
        })
        setConfig(merged)
      }
      if (c) setCourts(c)
      setLoading(false)
    })
  }, [])

  async function saveConfig() {
    setSaving(true)
    const supabase = createClient()
    await Promise.all(
      Object.entries(config).map(([key, value]) =>
        supabase.from('app_config').upsert({ key, value: String(value) }, { onConflict: 'key' })
      )
    )
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function addCourt() {
    if (!newCourt.name.trim()) return
    setAddingCourt(true)
    setCourtError('')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('courts')
      .insert({ name: newCourt.name.trim(), type: newCourt.type, is_active: true })
      .select()
      .single()
    if (error) {
      setCourtError(error.message)
    } else if (data) {
      setCourts((prev) => [...prev, data])
      setNewCourt({ name: '', type: 'indoor' })
    }
    setAddingCourt(false)
  }

  async function toggleCourt(id: string, active: boolean) {
    const supabase = createClient()
    await supabase.from('courts').update({ is_active: !active }).eq('id', id)
    setCourts((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: !active } : c)))
  }

  if (loading) return <div className="text-gray-400">Cargando...</div>

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500">Ajustes generales de la escuela</p>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">Información general</h2>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre de la escuela</label>
          <input
            type="text"
            value={config.school_name}
            onChange={(e) => setConfig({ ...config, school_name: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">Precios y bolsa de clases</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Precio clase suelta (€)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={config.pay_per_class_price / 100}
                  onChange={(e) => setConfig({ ...config, pay_per_class_price: Math.round(Number(e.target.value) * 100) })}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-gray-400">€</span>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Clases por bono
              </label>
              <input
                type="number"
                min={1}
                value={config.classes_per_pack}
                onChange={(e) => setConfig({ ...config, classes_per_pack: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Precio del bono (€)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={config.pack_price / 100}
                  onChange={(e) => setConfig({ ...config, pack_price: Math.round(Number(e.target.value) * 100) })}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-gray-400">€</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Precio por clase en bono: {config.classes_per_pack > 0 ? ((config.pack_price / config.classes_per_pack) / 100).toFixed(2) : '0.00'} € (ahorro del {config.pay_per_class_price > 0 ? Math.round((1 - config.pack_price / config.classes_per_pack / config.pay_per_class_price) * 100) : 0}%)
          </p>
        </div>
      </div>

      <button
        onClick={saveConfig}
        disabled={saving}
        className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
      >
        {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar cambios'}
      </button>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">Pistas</h2>
        <div className="mb-4 space-y-2">
          {courts.map((court) => (
            <div key={court.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{court.name}</p>
                <p className="text-xs text-gray-400">{court.type === 'indoor' ? 'Interior' : 'Exterior'}</p>
              </div>
              <button
                onClick={() => toggleCourt(court.id, court.is_active)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${court.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {court.is_active ? 'Activa' : 'Inactiva'}
              </button>
            </div>
          ))}
          {courts.length === 0 && (
            <p className="text-sm text-gray-400">No hay pistas. Añade la primera.</p>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Nombre de la pista"
            value={newCourt.name}
            onChange={(e) => setNewCourt({ ...newCourt, name: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') addCourt() }}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
          />
          <select
            value={newCourt.type}
            onChange={(e) => setNewCourt({ ...newCourt, type: e.target.value })}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
          >
            <option value="indoor">Interior</option>
            <option value="outdoor">Exterior</option>
          </select>
          <button
            onClick={addCourt}
            disabled={addingCourt || !newCourt.name.trim()}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            Añadir
          </button>
        </div>
        {courtError && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            Error: {courtError}
          </p>
        )}
      </div>
    </div>
  )
}
