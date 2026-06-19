'use client'

import { toast } from 'sonner'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
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

export function SettingsClient({ clubId, userId }: { clubId: string | null; userId: string }) {
  const router = useRouter()
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

  const [features, setFeatures] = useState({
    enable_60min: true, enable_90min: true, enable_payments: true,
    enable_spots: true, enable_bag: true, enable_chat: true,
    enable_materials: true, enable_objectives: true,
    enable_tournaments: true, enable_intensivos: true,
    enable_pista_viva: false,
  })
  const [featuresSaving, setFeaturesSaving] = useState(false)
  const [featuresSaved, setFeaturesSaved] = useState(false)
  const [featuresError, setFeaturesError] = useState('')

  const [redsys, setRedsys] = useState({ merchantCode: '', secretKey: '', terminal: '001', env: 'test', secretKeyMasked: '', hasSecretKey: false })
  const [redsysSaving, setRedsysSaving] = useState(false)
  const [redsysSaved, setRedsysSaved] = useState(false)
  const [redsysError, setRedsysError] = useState('')
  const [showSecretKey, setShowSecretKey] = useState(false)

  const [playtomic, setPlaytomic] = useState({ email: '', password: '', tenantId: '', bookingUrl: '' })
  const [playtomicSaving, setPlaytomicSaving] = useState(false)
  const [playtomicSaved, setPlaytomicSaved] = useState(false)
  const [playtomicError, setPlaytomicError] = useState('')
  const [tenantSearch, setTenantSearch] = useState('')
  const [tenantResults, setTenantResults] = useState<{ tenant_id: string; name: string; address: string }[]>([])

  const [holidays, setHolidays] = useState<string[]>([])
  const [newHoliday, setNewHoliday] = useState('')
  const [holidaysSaving, setHolidaysSaving] = useState(false)

  const [activeTab, setActiveTab] = useState<'perfil' | 'pistas' | 'precios' | 'modulos' | 'pagos' | 'playtomic'>('perfil')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      fetch('/api/admin/club-config').catch(() => null),
      clubId
        ? supabase.from('courts').select('*').eq('club_id', clubId).order('name')
        : supabase.from('courts').select('*').order('name'),
      supabase.from('users').select('name, email, avatar_url').eq('id', userId).single(),
      fetch('/api/club/redsys').catch(() => null),
      fetch('/api/admin/club-features').catch(() => null),
      fetch('/api/admin/club-holidays').catch(() => null),
      fetch('/api/admin/pista-viva/credentials').catch(() => null),
    ]).then(async ([cfgRes, { data: c }, { data: userData }, redsysRes, featRes, holRes, ptRes]) => {
      if (userData) setProfile({ id: userId, ...userData })
      if (cfgRes?.ok) {
        const json = await cfgRes.json().catch(() => null)
        if (json?.config) setConfig(prev => ({ ...prev, ...json.config }))
      }
      if (c) setCourts(c)
      if (redsysRes?.ok) {
        const data = await redsysRes.json().catch(() => null)
        if (data) setRedsys(prev => ({ ...prev, ...data, secretKey: '' }))
      }
      if (featRes?.ok) {
        const json = await featRes.json().catch(() => null)
        if (json?.features) setFeatures(prev => ({ ...prev, ...json.features }))
      }
      if (holRes?.ok) {
        const json = await holRes.json().catch(() => null)
        if (json?.holidays) setHolidays(json.holidays)
      }
      if (ptRes?.ok) {
        const json = await ptRes.json().catch(() => null)
        if (json) setPlaytomic(prev => ({
          ...prev,
          email: json.playtomic_email ?? '',
          tenantId: json.playtomic_tenant_id ?? '',
          bookingUrl: json.playtomic_booking_url ?? '',
        }))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [clubId, userId])

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
      toast.error('Error al subir la foto: ' + (err.message ?? err))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function saveConfig() {
    setSaving(true)
    setSaveError('')
    const res = await fetch('/api/admin/club-config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setSaveError(j.error ?? 'Error al guardar')
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
    const { data, error } = await supabase
      .from('courts')
      .insert({ name: newCourt.name.trim(), type: newCourt.type, is_active: true, club_id: clubId })
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
    const { error } = await supabase.from('courts').update({ is_active: !active }).eq('id', id)
    if (error) {
      toast.error('No se pudo actualizar la pista')
      return
    }
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
    const { error } = await supabase.from('courts').delete().eq('id', id)
    if (error) {
      toast.error('No se pudo eliminar la pista (puede tener clases asociadas)')
      return
    }
    setCourts((prev) => prev.filter((c) => c.id !== id))
    toast.success('Pista eliminada')
  }

  async function saveRedsys() {
    setRedsysSaving(true)
    setRedsysError('')
    const res = await fetch('/api/club/redsys', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantCode: redsys.merchantCode,
        secretKey: redsys.secretKey || undefined,
        terminal: redsys.terminal,
        env: redsys.env,
      }),
    })
    setRedsysSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setRedsysError(j.error ?? 'Error al guardar')
      return
    }
    setRedsys(prev => ({
      ...prev,
      secretKey: '',
      hasSecretKey: prev.hasSecretKey || !!prev.secretKey,
      secretKeyMasked: prev.secretKey ? '••••••••' + prev.secretKey.slice(-4) : prev.secretKeyMasked,
    }))
    setShowSecretKey(false)
    setRedsysSaved(true)
    setTimeout(() => setRedsysSaved(false), 2000)
  }

  async function addHoliday() {
    if (!newHoliday || holidays.includes(newHoliday)) return
    const updated = [...holidays, newHoliday].sort()
    setHolidaysSaving(true)
    const res = await fetch('/api/admin/club-holidays', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holidays: updated }),
    })
    setHolidaysSaving(false)
    if (res.ok) {
      setHolidays(updated)
      setNewHoliday('')
    }
  }

  async function removeHoliday(date: string) {
    const updated = holidays.filter(d => d !== date)
    setHolidaysSaving(true)
    const res = await fetch('/api/admin/club-holidays', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holidays: updated }),
    })
    setHolidaysSaving(false)
    if (res.ok) setHolidays(updated)
  }

  async function saveFeatures() {
    setFeaturesSaving(true)
    setFeaturesError('')
    const res = await fetch('/api/admin/club-features', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features),
    })
    setFeaturesSaving(false)
    if (res.ok) {
      setFeaturesSaved(true)
      setTimeout(() => setFeaturesSaved(false), 2000)
      router.refresh()
    } else {
      const j = await res.json().catch(() => ({}))
      setFeaturesError(j.error ?? 'Error al guardar')
    }
  }

  if (loading) return <div className="text-gray-400">Cargando...</div>

  const initials = (profile?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  type Tab = 'perfil' | 'pistas' | 'precios' | 'modulos' | 'pagos' | 'playtomic'
  const tabs: { id: Tab; label: string }[] = [
    { id: 'perfil', label: 'Perfil' },
    { id: 'pistas', label: 'Pistas' },
    { id: 'precios', label: 'Precios' },
    { id: 'modulos', label: 'Módulos' },
    { id: 'pagos', label: 'Pagos' },
    ...(features.enable_pista_viva ? [{ id: 'playtomic' as Tab, label: '⚡ Playtomic' }] : []),
  ]

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 rounded-xl bg-gray-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Perfil */}
      {activeTab === 'perfil' && (
        <div className="space-y-5">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-900">Mi perfil</h2>
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.name} className="h-20 w-20 rounded-full object-cover ring-2 ring-brand-500" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 ring-2 ring-brand-500">
                    <span className="text-2xl font-bold text-brand-600">{initials}</span>
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
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
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
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-1 font-semibold text-gray-900">Días festivos</h2>
            <p className="mb-4 text-xs text-gray-400">Las clases no se imparten estos días. No aparecerán en el calendario ni en los huecos disponibles.</p>
            <div className="mb-4 space-y-2">
              {holidays.length === 0 && <p className="text-sm text-gray-400">No hay días festivos configurados.</p>}
              {holidays.map(date => {
                const label = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                return (
                  <div key={date} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">{label}</p>
                      <p className="text-xs text-gray-400">{date}</p>
                    </div>
                    <button onClick={() => removeHoliday(date)} disabled={holidaysSaving} className="rounded-lg border border-red-100 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40">
                      Eliminar
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2">
              <input type="date" value={newHoliday} onChange={e => setNewHoliday(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addHoliday() }}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
              <button onClick={addHoliday} disabled={holidaysSaving || !newHoliday || holidays.includes(newHoliday)}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
                {holidaysSaving ? 'Guardando...' : 'Añadir'}
              </button>
            </div>
          </div>

          {saveError && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">Error: {saveError}</p>}
          <button onClick={saveConfig} disabled={saving} className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
            {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar cambios'}
          </button>
        </div>
      )}

      {/* Tab: Pistas */}
      {activeTab === 'pistas' && (
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
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                      autoFocus
                    />
                    <select
                      value={editingCourt.type}
                      onChange={(e) => setEditingCourt({ ...editingCourt, type: e.target.value })}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                    >
                      <option value="indoor">Interior</option>
                      <option value="outdoor">Exterior</option>
                    </select>
                    <button onClick={() => saveEditCourt(court.id)} className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600">Guardar</button>
                    <button onClick={() => setEditingCourtId(null)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{court.name}</p>
                      <p className="text-xs text-gray-400">{court.type === 'indoor' ? 'Interior' : 'Exterior'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleCourt(court.id, court.is_active)} className={`rounded-full px-3 py-1 text-xs font-medium ${court.is_active ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-500'}`}>
                        {court.is_active ? 'Activa' : 'Inactiva'}
                      </button>
                      <button onClick={() => startEditCourt(court)} className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">Editar</button>
                      <button onClick={() => deleteCourt(court.id)} className="rounded-lg border border-red-100 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Eliminar</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {courts.length === 0 && <p className="text-sm text-gray-400">No hay pistas. Añade la primera.</p>}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nombre de la pista"
              value={newCourt.name}
              onChange={(e) => setNewCourt({ ...newCourt, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') addCourt() }}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <select value={newCourt.type} onChange={(e) => setNewCourt({ ...newCourt, type: e.target.value })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
              <option value="indoor">Interior</option>
              <option value="outdoor">Exterior</option>
            </select>
            <button onClick={addCourt} disabled={addingCourt || !newCourt.name.trim()} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
              Añadir
            </button>
          </div>
          {courtError && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">Error: {courtError}</p>}
        </div>
      )}

      {/* Tab: Precios */}
      {activeTab === 'precios' && (
        <div className="space-y-5">
          {features.enable_payments && (features.enable_60min || features.enable_90min) && (
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 font-semibold text-gray-900">Precios de clase suelta</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {features.enable_60min && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Clase 1 hora (€)</label>
                    <div className="relative">
                      <input type="number" min={0} step={0.5} value={config.pay_per_class_price_60 / 100}
                        onChange={(e) => setConfig({ ...config, pay_per_class_price_60: Math.round(Number(e.target.value) * 100) })}
                        className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                      <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-gray-400">€</span>
                    </div>
                  </div>
                )}
                {features.enable_90min && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Clase 1h 30 min (€)</label>
                    <div className="relative">
                      <input type="number" min={0} step={0.5} value={config.pay_per_class_price_90 / 100}
                        onChange={(e) => setConfig({ ...config, pay_per_class_price_90: Math.round(Number(e.target.value) * 100) })}
                        className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                      <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-gray-400">€</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {features.enable_bag && (features.enable_60min || features.enable_90min) && (
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 font-semibold text-gray-900">Bonos de clases</h2>
              {features.enable_60min && (
                <>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Bono 1 hora</p>
                  <div className="mb-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Clases por bono</label>
                      <input type="number" min={1} value={config.classes_per_pack_60}
                        onChange={(e) => setConfig({ ...config, classes_per_pack_60: Number(e.target.value) })}
                        className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Precio del bono (€)</label>
                      <div className="relative">
                        <input type="number" min={0} step={0.5} value={config.pack_price_60 / 100}
                          onChange={(e) => setConfig({ ...config, pack_price_60: Math.round(Number(e.target.value) * 100) })}
                          className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
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
                      <input type="number" min={1} value={config.classes_per_pack_90}
                        onChange={(e) => setConfig({ ...config, classes_per_pack_90: Number(e.target.value) })}
                        className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Precio del bono (€)</label>
                      <div className="relative">
                        <input type="number" min={0} step={0.5} value={config.pack_price_90 / 100}
                          onChange={(e) => setConfig({ ...config, pack_price_90: Math.round(Number(e.target.value) * 100) })}
                          className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
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

          {features.enable_bag && (
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-1 font-semibold text-gray-900">Política de cancelación</h2>
              <p className="mb-4 text-xs text-gray-400">Si el alumno cancela con menos de X horas de antelación, el crédito <strong>no</strong> se devuelve.</p>
              <div className="flex items-center gap-3">
                <input type="number" min={0} max={168} value={config.cancellation_hours}
                  onChange={(e) => setConfig({ ...config, cancellation_hours: Number(e.target.value) })}
                  className="w-28 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                <span className="text-sm text-gray-500">horas antes del inicio de la clase</span>
              </div>
            </div>
          )}

          {!features.enable_payments && !features.enable_bag && (
            <p className="text-sm text-gray-400">Activa los módulos de pagos o bolsa de clases en la pestaña Módulos para configurar precios.</p>
          )}

          {saveError && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">Error: {saveError}</p>}
          <button onClick={saveConfig} disabled={saving} className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
            {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar precios'}
          </button>
        </div>
      )}

      {/* Tab: Módulos */}
      {activeTab === 'modulos' && (
        <div className="space-y-5">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-1 font-semibold text-gray-900">Módulos activos</h2>
            <p className="mb-5 text-xs text-gray-400">Activa o desactiva funcionalidades para toda la escuela.</p>
            <div className="space-y-1">
              {([
                { key: 'enable_60min', label: 'Clases de 60 minutos', desc: 'Bolsa 60min, bonos 60min y pago de clase suelta 60min' },
                { key: 'enable_90min', label: 'Clases de 90 minutos', desc: 'Bolsa 90min, bonos 90min y pago de clase suelta 90min' },
                { key: 'enable_payments', label: 'Pagos con tarjeta (Redsys)', desc: 'Flujo de pago online. La bolsa manual sigue funcionando siempre' },
                { key: 'enable_spots', label: 'Huecos libres', desc: 'Los alumnos pueden reservar huecos cuando un compañero falta' },
                { key: 'enable_bag', label: 'Bolsa de clases', desc: 'Saldo de clases disponibles y gestión de bonos' },
                { key: 'enable_chat', label: 'Chat de soporte', desc: 'Chat entre alumnos/monitores y la administración' },
                { key: 'enable_materials', label: 'Material didáctico', desc: 'PDFs y contenido formativo por nivel' },
                { key: 'enable_objectives', label: 'Objetivos y progreso', desc: 'Checklists de progreso asignados por el monitor' },
                { key: 'enable_tournaments', label: 'Torneos', desc: 'Gestión de torneos e inscripciones de alumnos' },
                { key: 'enable_intensivos', label: 'Semanas intensivas', desc: 'Clases intensivas de pago único por semana' },
              ] as { key: keyof typeof features; label: string; desc: string }[]).map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between gap-4 rounded-lg px-3 py-3 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{label}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFeatures(prev => ({ ...prev, [key]: !prev[key] }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${features[key] ? 'bg-brand-500' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${features[key] ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
            </div>
            {featuresError && <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{featuresError}</p>}
            <button onClick={saveFeatures} disabled={featuresSaving} className="mt-5 rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
              {featuresSaving ? 'Guardando...' : featuresSaved ? '¡Guardado!' : 'Guardar módulos'}
            </button>
          </div>

        </div>
      )}

      {/* Tab: Pagos */}
      {activeTab === 'pagos' && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-semibold text-gray-900">TPV Redsys</h2>
          <p className="mb-5 text-xs text-gray-400">Credenciales del terminal de pago de tu banco. Cada club tiene las suyas.</p>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Código de comercio</label>
                <input type="text" value={redsys.merchantCode} onChange={e => setRedsys({ ...redsys, merchantCode: e.target.value })}
                  placeholder="Ej: 999008881" className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Terminal</label>
                <input type="text" value={redsys.terminal} onChange={e => setRedsys({ ...redsys, terminal: e.target.value })}
                  placeholder="001" className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Clave secreta SHA-256 (Base64)
                {redsys.hasSecretKey && !showSecretKey && <span className="ml-2 font-normal text-xs text-gray-400">{redsys.secretKeyMasked}</span>}
              </label>
              {showSecretKey ? (
                <div className="flex gap-2">
                  <input type="text" value={redsys.secretKey} onChange={e => setRedsys({ ...redsys, secretKey: e.target.value })}
                    placeholder="Pega aquí la clave del panel Redsys"
                    className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-mono focus:border-brand-500 focus:outline-none" />
                  <button onClick={() => { setShowSecretKey(false); setRedsys(prev => ({ ...prev, secretKey: '' })) }}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50">Cancelar</button>
                </div>
              ) : (
                <button onClick={() => setShowSecretKey(true)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                  {redsys.hasSecretKey ? 'Cambiar clave secreta' : 'Introducir clave secreta'}
                </button>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Entorno</label>
              <div className="flex gap-3">
                {[{ value: 'test', label: 'Pruebas (test)' }, { value: 'production', label: 'Producción (real)' }].map(opt => (
                  <button key={opt.value} onClick={() => setRedsys({ ...redsys, env: opt.value })}
                    className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${redsys.env === opt.value ? opt.value === 'production' ? 'bg-brand-500 text-white' : 'bg-blue-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {redsys.env === 'production' && <p className="mt-2 text-xs font-medium text-orange-600">Entorno real: los pagos serán cobros reales.</p>}
            </div>
            {redsysError && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{redsysError}</p>}
            <button onClick={saveRedsys} disabled={redsysSaving} className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
              {redsysSaving ? 'Guardando...' : redsysSaved ? '¡Guardado!' : 'Guardar TPV'}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Playtomic */}
      {activeTab === 'playtomic' && features.enable_pista_viva && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-semibold text-gray-900">⚡ Pista Viva — Playtomic</h2>
          <p className="mb-5 text-xs text-gray-400">Credenciales para detectar pistas libres y crear partidos abiertos en nombre del club.</p>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Email de tu cuenta Playtomic</label>
              <input type="email" value={playtomic.email} onChange={(e) => setPlaytomic(p => ({ ...p, email: e.target.value }))}
                placeholder="admin@venditto.com" className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Contraseña de Playtomic</label>
              <input type="password" value={playtomic.password} onChange={(e) => setPlaytomic(p => ({ ...p, password: e.target.value }))}
                placeholder="Solo se guarda si introduces una nueva" className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Buscar tu club en Playtomic</label>
              <div className="flex gap-2">
                <input type="text" value={tenantSearch} onChange={(e) => setTenantSearch(e.target.value)}
                  placeholder="Nombre del club en Playtomic..."
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
                <button type="button" onClick={async () => {
                  if (tenantSearch.length < 2) return
                  const res = await fetch(`/api/admin/pista-viva/tenants/search?text=${encodeURIComponent(tenantSearch)}`)
                  const data = await res.json()
                  setTenantResults(data.tenants ?? [])
                }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                  Buscar
                </button>
              </div>
              {tenantResults.length > 0 && (
                <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-2 space-y-1">
                  {tenantResults.map((t) => (
                    <button key={t.tenant_id} type="button"
                      onClick={() => { setPlaytomic(p => ({ ...p, tenantId: t.tenant_id })); setTenantResults([]) }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white">
                      <span className="font-medium text-gray-900">{t.name}</span>
                      {t.address && <span className="ml-2 text-xs text-gray-400">{t.address}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Tenant ID (UUID)</label>
              <input type="text" value={playtomic.tenantId} onChange={(e) => setPlaytomic(p => ({ ...p, tenantId: e.target.value }))}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-mono focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">URL del club en Playtomic</label>
              <input type="url" value={playtomic.bookingUrl} onChange={(e) => setPlaytomic(p => ({ ...p, bookingUrl: e.target.value }))}
                placeholder="https://playtomic.io/tu-club/uuid"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            {playtomicError && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{playtomicError}</p>}
            <div className="flex justify-end">
              <button type="button" disabled={playtomicSaving} onClick={async () => {
                setPlaytomicSaving(true)
                setPlaytomicError('')
                const body: Record<string, string> = {
                  playtomic_email: playtomic.email,
                  playtomic_tenant_id: playtomic.tenantId,
                  playtomic_booking_url: playtomic.bookingUrl,
                }
                if (playtomic.password) body.playtomic_password = playtomic.password
                const res = await fetch('/api/admin/pista-viva/credentials', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body),
                })
                if (!res.ok) {
                  const d = await res.json().catch(() => ({}))
                  setPlaytomicError(d.error ?? 'Error al guardar')
                } else {
                  setPlaytomicSaved(true)
                  setPlaytomic(p => ({ ...p, password: '' }))
                  setTimeout(() => setPlaytomicSaved(false), 2000)
                }
                setPlaytomicSaving(false)
              }} className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
                {playtomicSaving ? 'Guardando...' : playtomicSaved ? '¡Guardado!' : 'Guardar Playtomic'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
