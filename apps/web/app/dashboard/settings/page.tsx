'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AppConfig {
  pay_per_class_price_60: number
  pay_per_class_price_90: number
  pack_price_60: number
  classes_per_pack_60: number
  pack_price_90: number
  classes_per_pack_90: number
  school_name: string
  cancellation_hours: number
}

const defaults: AppConfig = {
  pay_per_class_price_60: 1200,
  pay_per_class_price_90: 1500,
  pack_price_60: 9000,
  classes_per_pack_60: 10,
  pack_price_90: 12000,
  classes_per_pack_90: 10,
  school_name: 'Mi Escuela de Pádel',
  cancellation_hours: 24,
}

export default function SettingsPage() {
  const [config, setConfig] = useState<AppConfig>(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [courts, setCourts] = useState<any[]>([])
  const [newCourt, setNewCourt] = useState({ name: '', type: 'indoor' })
  const [addingCourt, setAddingCourt] = useState(false)
  const [courtError, setCourtError] = useState('')
  const [editingCourtId, setEditingCourtId] = useState<string | null>(null)
  const [editingCourt, setEditingCourt] = useState({ name: '', type: 'indoor' })

  const [profile, setProfile] = useState<{ id: string; name: string; email: string; avatar_url?: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      const clubId = user?.user_metadata?.club_id ?? null
      const [{ data: cfg }, { data: c }, { data: userData }] = await Promise.all([
        supabase.from('app_config').select('key, value'),
        clubId
          ? supabase.from('courts').select('*').eq('club_id', clubId).order('name')
          : supabase.from('courts').select('*').order('name'),
        user
          ? supabase.from('users').select('name, email, avatar_url').eq('id', user.id).single()
          : Promise.resolve({ data: null, error: null }),
      ])
      if (userData && user) setProfile({ id: user.id, ...userData })
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

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    setUploading(true)
    try {
      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(`${profile.id}/avatar.jpg`, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(`${profile.id}/avatar.jpg`)
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

      await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', profile.id)
      setProfile((prev) => prev ? { ...prev, avatar_url: publicUrl } : prev)
    } catch (err: any) {
      alert('Error al subir la foto: ' + (err.message ?? err))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function saveConfig() {
    setSaving(true)
    setSaveError('')
    const supabase = createClient()
    const results = await Promise.all(
      Object.entries(config).map(([key, value]) =>
        supabase.from('app_config').upsert({ key, value: String(value) }, { onConflict: 'key' })
      )
    )
    const firstError = results.find((r) => r.error)?.error
    setSaving(false)
    if (firstError) {
      setSaveError(firstError.message)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function addCourt() {
    if (!newCourt.name.trim()) return
    setAddingCourt(true)
    setCourtError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: userData } = await supabase.from('users').select('club_id').eq('id', user!.id).single()
    const { data, error } = await supabase
      .from('courts')
      .insert({ name: newCourt.name.trim(), type: newCourt.type, is_active: true, club_id: userData?.club_id ?? null })
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

  function startEditCourt(court: any) {
    setEditingCourtId(court.id)
    setEditingCourt({ name: court.name, type: court.type })
  }

  async function saveEditCourt(id: string) {
    if (!editingCourt.name.trim()) return
    const supabase = createClient()
    const { error } = await supabase
      .from('courts')
      .update({ name: editingCourt.name.trim(), type: editingCourt.type })
      .eq('id', id)
    if (!error) {
      setCourts((prev) => prev.map((c) => c.id === id ? { ...c, name: editingCourt.name.trim(), type: editingCourt.type } : c))
      setEditingCourtId(null)
    }
  }

  async function deleteCourt(id: string) {
    if (!confirm('¿Eliminar esta pista?')) return
    const supabase = createClient()
    await supabase.from('courts').delete().eq('id', id)
    setCourts((prev) => prev.filter((c) => c.id !== id))
  }

  if (loading) return <div className="text-gray-400">Cargando...</div>

  const initials = (profile?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500">Ajustes generales de la escuela</p>
      </div>

      {/* Sección foto de perfil */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">Mi perfil</h2>
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.name}
                className="h-20 w-20 rounded-full object-cover ring-2 ring-green-500"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 ring-2 ring-green-500">
                <span className="text-2xl font-bold text-green-700">{initials}</span>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                <svg className="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900">{profile?.name}</p>
            <p className="mb-3 text-sm text-gray-400">{profile?.email}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {uploading ? 'Subiendo...' : 'Cambiar foto'}
            </button>
          </div>
        </div>
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
        <h2 className="mb-4 font-semibold text-gray-900">Precios de clase suelta</h2>
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Clase 1 hora (€)</label>
            <div className="relative">
              <input
                type="number" min={0} step={0.5}
                value={config.pay_per_class_price_60 / 100}
                onChange={(e) => setConfig({ ...config, pay_per_class_price_60: Math.round(Number(e.target.value) * 100) })}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-gray-400">€</span>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Clase 1h 30 min (€)</label>
            <div className="relative">
              <input
                type="number" min={0} step={0.5}
                value={config.pay_per_class_price_90 / 100}
                onChange={(e) => setConfig({ ...config, pay_per_class_price_90: Math.round(Number(e.target.value) * 100) })}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-gray-400">€</span>
            </div>
          </div>
        </div>

        <h2 className="mb-4 font-semibold text-gray-900">Bonos de clases</h2>

        <p className="mb-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Bono 1 hora</p>
        <div className="mb-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Clases por bono</label>
            <input
              type="number" min={1}
              value={config.classes_per_pack_60}
              onChange={(e) => setConfig({ ...config, classes_per_pack_60: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Precio del bono (€)</label>
            <div className="relative">
              <input
                type="number" min={0} step={0.5}
                value={config.pack_price_60 / 100}
                onChange={(e) => setConfig({ ...config, pack_price_60: Math.round(Number(e.target.value) * 100) })}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-gray-400">€</span>
            </div>
          </div>
        </div>
        <p className="mb-5 text-xs text-gray-400">
          Precio por clase: {config.classes_per_pack_60 > 0 ? ((config.pack_price_60 / config.classes_per_pack_60) / 100).toFixed(2) : '0.00'} €
        </p>

        <p className="mb-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Bono 1h 30min</p>
        <div className="mb-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Clases por bono</label>
            <input
              type="number" min={1}
              value={config.classes_per_pack_90}
              onChange={(e) => setConfig({ ...config, classes_per_pack_90: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Precio del bono (€)</label>
            <div className="relative">
              <input
                type="number" min={0} step={0.5}
                value={config.pack_price_90 / 100}
                onChange={(e) => setConfig({ ...config, pack_price_90: Math.round(Number(e.target.value) * 100) })}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-gray-400">€</span>
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Precio por clase: {config.classes_per_pack_90 > 0 ? ((config.pack_price_90 / config.classes_per_pack_90) / 100).toFixed(2) : '0.00'} €
        </p>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-1 font-semibold text-gray-900">Política de cancelación</h2>
        <p className="mb-4 text-xs text-gray-400">
          Si el alumno cancela con menos de X horas de antelación, la recuperación <strong>no</strong> se devuelve.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number" min={0} max={168}
            value={config.cancellation_hours}
            onChange={(e) => setConfig({ ...config, cancellation_hours: Number(e.target.value) })}
            className="w-28 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <span className="text-sm text-gray-500">horas antes del inicio de la clase</span>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {config.cancellation_hours === 0
            ? 'Con 0 horas: se puede cancelar siempre con devolución.'
            : `Ejemplo: si la clase empieza a las 10:00, hay que cancelar antes de las ${
                (() => { const d = new Date(); d.setHours(10 - config.cancellation_hours % 24, 0); return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) })()
              } del día anterior.`}
        </p>
      </div>

      {saveError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          Error al guardar: {saveError}
        </div>
      )}
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
            <div key={court.id} className="rounded-lg border border-gray-100 px-4 py-3">
              {editingCourtId === court.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={editingCourt.name}
                    onChange={(e) => setEditingCourt({ ...editingCourt, name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditCourt(court.id); if (e.key === 'Escape') setEditingCourtId(null) }}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none"
                    autoFocus
                  />
                  <select
                    value={editingCourt.type}
                    onChange={(e) => setEditingCourt({ ...editingCourt, type: e.target.value })}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none"
                  >
                    <option value="indoor">Interior</option>
                    <option value="outdoor">Exterior</option>
                  </select>
                  <button onClick={() => saveEditCourt(court.id)} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">
                    Guardar
                  </button>
                  <button onClick={() => setEditingCourtId(null)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{court.name}</p>
                    <p className="text-xs text-gray-400">{court.type === 'indoor' ? 'Interior' : 'Exterior'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleCourt(court.id, court.is_active)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${court.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {court.is_active ? 'Activa' : 'Inactiva'}
                    </button>
                    <button
                      onClick={() => startEditCourt(court)}
                      className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => deleteCourt(court.id)}
                      className="rounded-lg border border-red-100 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
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
