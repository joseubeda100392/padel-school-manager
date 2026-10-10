'use client'

import { toast } from 'sonner'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CircleCheck, CircleOff, CircleX, Download, FileText, FileUp, Info, Loader2, Search, TriangleAlert, Zap } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader, SectionTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Notice, Skeleton } from '@/components/ui/feedback'
import { Avatar } from '@/components/ui/list'
import { useConfirm } from '@/components/ui/confirm'
import { formatLongDate } from '@/lib/format-date'
import { cn } from '@/lib/utils'

function downloadCsv(filename: string, rows: Record<string, unknown>[], columns?: { key: string; header: string }[]) {
  if (!rows.length) return
  const keys = columns?.map((c) => c.key) ?? Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((k) => set.add(k))
    return set
  }, new Set<string>()))
  const headers = columns?.map((c) => c.header) ?? keys
  const escapeCell = (value: unknown) => {
    const str = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
    return `"${str.replace(/"/g, '""')}"`
  }
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => keys.map((k) => escapeCell(row[k])).join(',')),
  ]
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

type PlaytomicPreviewPlayer = {
  name: string; email: string | null; phone: string | null; gender: string | null
  level: number | null; birthDate: string | null; lastActivity: string | null
  acceptsMarketing: boolean | null; otherSports: string | null; benefits: string | null
  walletBalance: string | null; status: string
}

const PLAYTOMIC_PLAYER_COLUMNS: { key: keyof PlaytomicPreviewPlayer; header: string }[] = [
  { key: 'name', header: 'Nombre' },
  { key: 'email', header: 'Email' },
  { key: 'phone', header: 'Teléfono' },
  { key: 'gender', header: 'Género (MALE / FEMALE / HIDDEN, dato de Playtomic)' },
  { key: 'level', header: 'Nivel de pádel (escala Playtomic, aprox. 0 a 7)' },
  { key: 'birthDate', header: 'Fecha de nacimiento' },
  { key: 'lastActivity', header: 'Última actividad en Playtomic (última reserva o registro)' },
  { key: 'acceptsMarketing', header: 'Acepta comunicaciones comerciales (consentimiento dado a Playtomic, no a nosotros)' },
  { key: 'otherSports', header: 'Otros deportes con nivel (aparte de pádel)' },
  { key: 'benefits', header: 'Bonos / beneficios activos en Playtomic' },
  { key: 'walletBalance', header: 'Saldo en el monedero de Playtomic' },
  { key: 'status', header: 'Estado en PSM (se_crearia / ya_existe / sin_email)' },
]

interface AppConfig {
  pay_per_class_price_60: number
  pay_per_class_price_90: number
  whole_class_price_60: number
  whole_class_price_90: number
  pack_price_60: number
  classes_per_pack_60: number
  pack_price_90: number
  classes_per_pack_90: number
  school_name: string
  cancellation_hours: number
  falta_advance_months: number
  max_recovery_classes: number
  billing_start_date: string
  standard_discount_cents: number
  price_per_class_with_court_60: number
  price_per_class_with_court_90: number
  price_per_class_without_court_60: number
  price_per_class_without_court_90: number
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
  legal_company_name: string
  legal_cif: string
  legal_address: string
  legal_email: string
  legal_phone: string
}

const defaults: AppConfig = {
  pay_per_class_price_60: 1200,
  pay_per_class_price_90: 1500,
  whole_class_price_60: 4800,
  whole_class_price_90: 6000,
  pack_price_60: 9000,
  classes_per_pack_60: 10,
  pack_price_90: 12000,
  classes_per_pack_90: 10,
  school_name: 'Mi Escuela de Pádel',
  cancellation_hours: 24,
  falta_advance_months: 0,
  max_recovery_classes: 0,
  billing_start_date: '',
  standard_discount_cents: 4000,
  price_per_class_with_court_60: 0,
  price_per_class_with_court_90: 0,
  price_per_class_without_court_60: 0,
  price_per_class_without_court_90: 0,
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
  legal_company_name: '',
  legal_cif: '',
  legal_address: '',
  legal_email: '',
  legal_phone: '',
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
    <Field label={label}>
      <div className="relative">
        <Input
          type="text"
          inputMode="decimal"
          onFocus={e => e.target.select()}
          value={displayPrice(value)}
          onChange={e => onChange(priceVal(e.target.value))}
          className="pr-8 tabular-nums"
        />
        <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-body text-ink-3">€</span>
      </div>
    </Field>
  )
}

function CountField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <Field label={label}>
      <Input
        type="text"
        inputMode="numeric"
        onFocus={e => e.target.select()}
        value={displayInt(value)}
        onChange={e => onChange(intVal(e.target.value))}
        className="tabular-nums"
      />
    </Field>
  )
}

function SaveBar({ onSave, saving, saved, error, label }: { onSave: () => void; saving: boolean; saved: boolean; error: string; label: string }) {
  return (
    <div className="space-y-2">
      {error && <p role="alert" className="text-meta font-medium text-danger-ink">No se ha podido guardar: {error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onSave} loading={saving} className="w-full sm:w-auto">
          {saving ? 'Guardando…' : label}
        </Button>
        <span role="status" className="inline-flex items-center gap-1.5 text-label text-accent-ink">
          {saved && (
            <>
              <CircleCheck className="h-4 w-4" aria-hidden />
              Guardado
            </>
          )}
        </span>
      </div>
    </div>
  )
}

export function SettingsClient({ clubId, userId, clubSlug }: { clubId: string | null; userId: string; clubSlug: string | null }) {
  const router = useRouter()
  const confirm = useConfirm()
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
  const termsFileRef = useRef<HTMLInputElement>(null)
  const [uploadingTerms, setUploadingTerms] = useState(false)

  const [features, setFeatures] = useState({
    enable_60min: true, enable_90min: true, enable_payments: true,
    enable_spots: true, enable_bag: true, enable_chat: true,
    enable_materials: true, enable_objectives: true,
    enable_tournaments: true, enable_intensivos: true,
    enable_pista_viva: false,
    enable_class_validation: false,
    cash_only_payments: false,
    enable_private_lessons: false,
    enable_terms: false,
    terms_pdf_url: '',
  })
  const [featuresSaving, setFeaturesSaving] = useState(false)
  const [featuresSaved, setFeaturesSaved] = useState(false)
  const [featuresError, setFeaturesError] = useState('')

  const [redsys, setRedsys] = useState({ merchantCode: '', secretKey: '', terminal: '001', env: 'test', secretKeyMasked: '', hasSecretKey: false })
  const [redsysSaving, setRedsysSaving] = useState(false)
  const [redsysSaved, setRedsysSaved] = useState(false)
  const [redsysError, setRedsysError] = useState('')
  const [showSecretKey, setShowSecretKey] = useState(false)

  const [playtomic, setPlaytomic] = useState({ email: '', password: '', tenantId: '', bookingUrl: '', clientId: '', clientSecret: '' })
  const [playtomicSaving, setPlaytomicSaving] = useState(false)
  const [playtomicSaved, setPlaytomicSaved] = useState(false)
  const [playtomicError, setPlaytomicError] = useState('')
  const [tenantSearch, setTenantSearch] = useState('')
  const [tenantResults, setTenantResults] = useState<{ tenant_id: string; name: string; address: string }[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: number; message: string } | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractedPlayers, setExtractedPlayers] = useState<PlaytomicPreviewPlayer[]>([])
  const [extractDone, setExtractDone] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [holidays, setHolidays] = useState<string[]>([])
  const [newHoliday, setNewHoliday] = useState('')
  const [holidaysSaving, setHolidaysSaving] = useState(false)

  const [activeTab, setActiveTab] = useState<'perfil' | 'pistas' | 'modulos' | 'pagos' | 'tarifas' | 'playtomic'>('perfil')

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
        if (json?.features) setFeatures(prev => ({
          ...prev,
          ...json.features,
          terms_pdf_url: typeof json.features.terms_pdf_url === 'string' ? json.features.terms_pdf_url : '',
        }))
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
          clientId: json.playtomic_client_id ?? '',
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
    if (!(await confirm({ title: 'Eliminar esta pista', description: 'Esta acción no se puede deshacer.', confirmLabel: 'Eliminar pista', destructive: true }))) return
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

  async function handleTermsPdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingTerms(true)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/admin/upload-terms', { method: 'POST', body: formData })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast.error('Error al subir el PDF: ' + (j.error ?? 'Error desconocido'))
      setUploadingTerms(false)
      return
    }
    const { publicUrl } = await res.json()
    const updatedFeatures = { ...features, terms_pdf_url: publicUrl }
    setFeatures(updatedFeatures)
    const saveRes = await fetch('/api/admin/club-features', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedFeatures) })
    setUploadingTerms(false)
    if (termsFileRef.current) termsFileRef.current.value = ''
    if (saveRes.ok) toast.success('PDF subido y guardado')
    else toast.error('PDF subido pero no se guardó la URL')
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6" aria-busy="true">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  type Tab = 'perfil' | 'pistas' | 'modulos' | 'pagos' | 'tarifas' | 'playtomic'
  const tabs: { id: Tab; label: string }[] = [
    { id: 'perfil', label: 'Perfil' },
    { id: 'pistas', label: 'Pistas' },
    { id: 'modulos', label: 'Módulos' },
    { id: 'pagos', label: 'Pagos' },
    { id: 'tarifas', label: 'Tarifas' },
    ...(features.enable_pista_viva ? [{ id: 'playtomic' as Tab, label: 'Playtomic' }] : []),
  ]

  function handleTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = -1
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next < 0) return
    e.preventDefault()
    setActiveTab(tabs[next].id)
    document.getElementById(`settings-tab-${tabs[next].id}`)?.focus()
  }

  const moduleItems = [
    { key: 'enable_60min', label: 'Clases de 60 minutos', desc: 'Bolsa 60min, bonos 60min y pago de clase suelta 60min' },
    { key: 'enable_90min', label: 'Clases de 90 minutos', desc: 'Bolsa 90min, bonos 90min y pago de clase suelta 90min' },
    { key: 'enable_payments', label: 'Pagos con tarjeta (Redsys)', desc: 'Flujo de pago online. La bolsa manual sigue funcionando siempre' },
    { key: 'enable_spots', label: 'Huecos libres', desc: 'Los alumnos pueden reservar huecos cuando un compañero falta' },
    { key: 'enable_bag', label: 'Bolsa de clases', desc: 'Saldo de clases disponibles y gestión de bonos' },
    { key: 'enable_chat', label: 'Chat de soporte', desc: 'Chat entre alumnos/monitores y la administración' },
    { key: 'enable_materials', label: 'Materia didáctica', desc: 'PDFs y contenido formativo por nivel' },
    { key: 'enable_objectives', label: 'Objetivos y progreso', desc: 'Checklists de progreso asignados por el monitor' },
    { key: 'enable_tournaments', label: 'Torneos', desc: 'Gestión de torneos e inscripciones de alumnos' },
    { key: 'enable_intensivos', label: 'Semanas intensivas', desc: 'Clases intensivas de pago único por semana' },
    { key: 'enable_terms', label: 'Condiciones de uso', desc: 'Los alumnos deben aceptar las condiciones antes de acceder a la app' },
    { key: 'enable_class_validation', label: 'Validación de clases', desc: 'El profesor marca si se dio la clase, el admin confirma — cobro por clases realmente dadas y nómina de profesores' },
    { key: 'cash_only_payments', label: 'Solo efectivo (sin TPV)', desc: 'Bloquea el pago por app (Redsys) y muestra un aviso de pagar en efectivo — para cuando el club aún no tiene su TPV configurado' },
    { key: 'enable_private_lessons', label: 'Clases particulares y tarifas de alumno externo', desc: 'Añade en Tarifas los precios de clase particular, clase/bono para alumnos externos, y en la ficha de alumno el marcador de "externo"' },
  ] as { key: keyof typeof features; label: string; desc: string }[]

  const hasTermsPdf = typeof features.terms_pdf_url === 'string' && !!features.terms_pdf_url
  const showClassPrices = features.enable_60min || features.enable_90min

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader title="Configuración" description="Datos del club, módulos, pagos y tarifas." />

      <div role="tablist" aria-label="Secciones de configuración" className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        {tabs.map((t, index) => {
          const selected = activeTab === t.id
          return (
            <button
              key={t.id}
              id={`settings-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`settings-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveTab(t.id)}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
              className={cn(
                '-mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-4 text-label transition-colors',
                selected ? 'border-accent-ink text-ink' : 'border-transparent text-ink-2 hover:text-ink',
              )}
            >
              {t.id === 'playtomic' && <Zap className="h-4 w-4" aria-hidden />}
              {t.label}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`settings-panel-${activeTab}`}
        aria-labelledby={`settings-tab-${activeTab}`}
        tabIndex={0}
        className="space-y-5 focus-visible:outline-none"
      >
      {/* Tab: Perfil */}
      {activeTab === 'perfil' && (
        <>
          <Card>
            <CardHeader title="Mi perfil" />
            <CardBody>
              <div className="flex flex-wrap items-center gap-5">
                <div className="relative shrink-0">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.name} className="h-20 w-20 rounded-full object-cover ring-2 ring-line" />
                  ) : (
                    <Avatar name={profile?.name ?? '?'} className="h-20 w-20 text-title" />
                  )}
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-ink/40">
                      <Loader2 className="h-5 w-5 animate-spin text-chrome-ink" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-heading text-ink">{profile?.name}</p>
                  <p className="mb-3 text-meta text-ink-3">{profile?.email}</p>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" aria-label="Foto de perfil" onChange={handleAvatarChange} />
                  <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} loading={uploading}>
                    {uploading ? 'Subiendo…' : 'Cambiar foto'}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Información general" />
            <CardBody className="space-y-4">
              <Field label="Nombre de la escuela">
                <Input type="text" value={config.school_name} onChange={(e) => setConfig({ ...config, school_name: e.target.value })} />
              </Field>
              <SaveBar onSave={saveConfig} saving={saving} saved={saved} error={saveError} label="Guardar cambios" />
            </CardBody>
          </Card>
        </>
      )}

      {/* Tab: Pistas */}
      {activeTab === 'pistas' && (
        <Card>
          <CardHeader title="Pistas" description="Las pistas que ofrece el club. Desactiva una para que no se pueda asignar a clases nuevas." />
          <CardBody className="space-y-4">
            {courts.length === 0 ? (
              <p className="text-body text-ink-2">No hay pistas. Añade la primera.</p>
            ) : (
              <ul className="divide-y divide-line rounded-control border border-line">
                {courts.map((court) => (
                  <li key={court.id} className="px-4 py-3">
                    {editingCourtId === court.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="text"
                          aria-label="Nombre de la pista"
                          value={editingCourt.name}
                          onChange={(e) => setEditingCourt({ ...editingCourt, name: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditCourt(court.id); if (e.key === 'Escape') setEditingCourtId(null) }}
                          className="min-w-40 flex-1"
                          autoFocus
                        />
                        <Select
                          aria-label="Tipo de pista"
                          value={editingCourt.type}
                          onChange={(e) => setEditingCourt({ ...editingCourt, type: e.target.value })}
                          className="w-auto"
                        >
                          <option value="indoor">Interior</option>
                          <option value="outdoor">Exterior</option>
                        </Select>
                        <Button size="sm" onClick={() => saveEditCourt(court.id)}>Guardar</Button>
                        <Button size="sm" variant="secondary" onClick={() => setEditingCourtId(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-label text-ink">{court.name}</p>
                          <p className="text-meta text-ink-3">{court.type === 'indoor' ? 'Interior' : 'Exterior'}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            aria-pressed={court.is_active}
                            onClick={() => toggleCourt(court.id, court.is_active)}
                          >
                            {court.is_active ? <CircleCheck className="h-4 w-4 text-accent-ink" aria-hidden /> : <CircleOff className="h-4 w-4" aria-hidden />}
                            {court.is_active ? 'Activa' : 'Inactiva'}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => startEditCourt(court)}>Editar</Button>
                          <Button size="sm" variant="danger-ghost" onClick={() => deleteCourt(court.id)}>Eliminar</Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Input
                type="text"
                aria-label="Nombre de la nueva pista"
                placeholder="Nombre de la pista"
                value={newCourt.name}
                onChange={(e) => setNewCourt({ ...newCourt, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') addCourt() }}
                className="min-w-40 flex-1"
              />
              <Select aria-label="Tipo de la nueva pista" value={newCourt.type} onChange={(e) => setNewCourt({ ...newCourt, type: e.target.value })} className="w-auto">
                <option value="indoor">Interior</option>
                <option value="outdoor">Exterior</option>
              </Select>
              <Button onClick={addCourt} loading={addingCourt} disabled={!newCourt.name.trim()}>
                Añadir pista
              </Button>
            </div>
            {courtError && <p role="alert" className="text-meta font-medium text-danger-ink">Error: {courtError}</p>}
          </CardBody>
        </Card>
      )}

      {/* Tab: Módulos */}
      {activeTab === 'modulos' && (
        <>
          <Card>
            <CardHeader title="Módulos activos" description="Activa o desactiva funcionalidades para toda la escuela." />
            <CardBody className="space-y-4">
              <ul className="divide-y divide-line">
                {moduleItems.filter(f => f.key !== 'terms_pdf_url').map(({ key, label, desc }) => (
                  <li key={key}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!features[key]}
                      aria-labelledby={`module-${key}-label`}
                      aria-describedby={`module-${key}-desc`}
                      onClick={() => setFeatures(prev => ({ ...prev, [key]: !prev[key] }))}
                      className="flex min-h-14 w-full items-center justify-between gap-4 rounded-control px-1 py-3 text-left transition-colors hover:bg-ink/[0.03]"
                    >
                      <span className="min-w-0">
                        <span id={`module-${key}-label`} className="block text-label text-ink">{label}</span>
                        <span id={`module-${key}-desc`} className="block text-meta text-ink-3">{desc}</span>
                      </span>
                      <span
                        aria-hidden
                        className={cn('relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200', features[key] ? 'bg-accent-ink' : 'bg-line-strong')}
                      >
                        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-card transition-transform duration-200', features[key] ? 'translate-x-[22px]' : 'translate-x-0.5')} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <SaveBar onSave={saveFeatures} saving={featuresSaving} saved={featuresSaved} error={featuresError} label="Guardar módulos" />
            </CardBody>
          </Card>

          {features.enable_terms && (
            <Card>
              <CardHeader
                title="Condiciones de uso: PDF"
                description="Sube el documento PDF con las condiciones. Los alumnos lo verán antes de poder acceder a la app."
              />
              <CardBody className="space-y-4">
                <input ref={termsFileRef} type="file" accept="application/pdf" className="hidden" aria-label="Archivo PDF de condiciones" onChange={handleTermsPdfUpload} />

                {hasTermsPdf ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-control border border-accent/30 bg-accent-soft px-4 py-3">
                    <FileText className="h-5 w-5 shrink-0 text-accent-ink" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-label text-accent-ink">PDF subido correctamente</p>
                      <p className="truncate text-meta text-ink-3">{features.terms_pdf_url.split('/').pop()?.split('?')[0]}</p>
                    </div>
                    <a href="/api/pdf/normas" target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                      Ver PDF
                    </a>
                  </div>
                ) : (
                  <div className="flex h-28 items-center justify-center rounded-control border border-dashed border-line-strong/60 bg-surface-2">
                    <p className="text-body text-ink-2">Todavía no has subido ningún PDF</p>
                  </div>
                )}

                <Button variant="secondary" onClick={() => termsFileRef.current?.click()} loading={uploadingTerms}>
                  {!uploadingTerms && <FileUp className="h-4 w-4" aria-hidden />}
                  {uploadingTerms ? 'Subiendo…' : hasTermsPdf ? 'Cambiar PDF' : 'Subir PDF'}
                </Button>
              </CardBody>
            </Card>
          )}
        </>
      )}

      {/* Tab: Pagos */}
      {activeTab === 'pagos' && (
        <>
          <Card>
            <CardHeader
              title="Datos legales"
              description="Tu banco los pide al dar de alta el TPV: razón social, CIF y contacto para las páginas públicas de política de devolución y cancelación, privacidad y cookies."
            />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Razón social">
                  <Input type="text" value={config.legal_company_name} onChange={e => setConfig({ ...config, legal_company_name: e.target.value })} placeholder="Ej: PAD&FIT SERVICES S.L" autoComplete="organization" />
                </Field>
                <Field label="CIF / NIF">
                  <Input type="text" value={config.legal_cif} onChange={e => setConfig({ ...config, legal_cif: e.target.value })} placeholder="Ej: B-86289824" />
                </Field>
              </div>
              <Field label="Dirección">
                <Input type="text" value={config.legal_address} onChange={e => setConfig({ ...config, legal_address: e.target.value })} placeholder="Calle, número, código postal, localidad" autoComplete="street-address" />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Email de contacto">
                  <Input type="email" inputMode="email" value={config.legal_email} onChange={e => setConfig({ ...config, legal_email: e.target.value })} placeholder="contacto@tuclub.com" autoComplete="email" />
                </Field>
                <Field label="Teléfono">
                  <Input type="tel" inputMode="tel" value={config.legal_phone} onChange={e => setConfig({ ...config, legal_phone: e.target.value })} placeholder="620108533" autoComplete="tel" />
                </Field>
              </div>
              <SaveBar onSave={saveConfig} saving={saving} saved={saved} error={saveError} label="Guardar datos legales" />
              {clubSlug && (
                <div className="rounded-control bg-surface-2 p-4 text-meta text-ink-2">
                  <p className="mb-1.5 text-label text-ink">Enlaces para el banco</p>
                  <ul className="space-y-1.5">
                    {[
                      ['Aviso legal', 'aviso-legal'],
                      ['Condiciones de compra, cancelación y devolución', 'condiciones'],
                      ['Privacidad', 'privacidad'],
                      ['Cookies', 'cookies'],
                    ].map(([label, path]) => (
                      <li key={path}>
                        {label}:{' '}
                        <a
                          href={`https://epadelschool.app/legal/${clubSlug}/${path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all font-mono text-accent-ink underline hover:no-underline"
                        >
                          https://epadelschool.app/legal/{clubSlug}/{path}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="TPV Redsys" description="Credenciales del terminal de pago de tu banco. Cada club tiene las suyas." />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Código de comercio">
                  <Input type="text" value={redsys.merchantCode} onChange={e => setRedsys({ ...redsys, merchantCode: e.target.value })} placeholder="Ej: 999008881" autoComplete="off" />
                </Field>
                <Field label="Terminal">
                  <Input type="text" value={redsys.terminal} onChange={e => setRedsys({ ...redsys, terminal: e.target.value })} placeholder="001" autoComplete="off" />
                </Field>
              </div>

              <div role="group" aria-labelledby="redsys-key-label" className="flex flex-col gap-1.5">
                <span id="redsys-key-label" className="text-label text-ink">
                  Clave secreta SHA-256 (Base64)
                  {redsys.hasSecretKey && !showSecretKey && <span className="ml-2 font-mono text-meta font-normal text-ink-3">{redsys.secretKeyMasked}</span>}
                </span>
                {showSecretKey ? (
                  <div className="flex flex-wrap gap-2">
                    <Input
                      type="text"
                      aria-labelledby="redsys-key-label"
                      value={redsys.secretKey}
                      onChange={e => setRedsys({ ...redsys, secretKey: e.target.value })}
                      placeholder="Pega aquí la clave del panel Redsys"
                      autoComplete="off"
                      className="min-w-40 flex-1 font-mono"
                    />
                    <Button variant="secondary" onClick={() => { setShowSecretKey(false); setRedsys(prev => ({ ...prev, secretKey: '' })) }}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Button variant="secondary" onClick={() => setShowSecretKey(true)}>
                      {redsys.hasSecretKey ? 'Cambiar clave secreta' : 'Introducir clave secreta'}
                    </Button>
                  </div>
                )}
              </div>

              <fieldset>
                <legend className="text-label text-ink">Entorno</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[{ value: 'test', label: 'Pruebas (test)' }, { value: 'production', label: 'Producción (real)' }].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={redsys.env === opt.value}
                      onClick={() => setRedsys({ ...redsys, env: opt.value })}
                      className={cn(
                        'min-h-11 rounded-full border px-4 text-label transition-colors',
                        redsys.env === opt.value
                          ? 'border-accent-ink bg-accent-soft text-accent-ink'
                          : 'border-line-strong/60 bg-surface text-ink-2 hover:bg-surface-2',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {redsys.env === 'production' && (
                  <Notice tone="warn" icon={<TriangleAlert />} className="mt-3">
                    Entorno real: los pagos serán cobros reales.
                  </Notice>
                )}
              </fieldset>

              <SaveBar onSave={saveRedsys} saving={redsysSaving} saved={redsysSaved} error={redsysError} label="Guardar TPV" />
            </CardBody>
          </Card>
        </>
      )}

      {/* Tab: Tarifas */}
      {activeTab === 'tarifas' && (
        <>
          {(features.enable_payments || features.enable_bag) && <SectionTitle>Precios</SectionTitle>}

          {features.enable_payments && showClassPrices && (
            <Card>
              <CardHeader title="Clase suelta" />
              <CardBody>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {features.enable_60min && (
                    <PriceField label="Clase 1 hora (€)" value={config.pay_per_class_price_60} onChange={v => setConfig({ ...config, pay_per_class_price_60: v })} />
                  )}
                  {features.enable_90min && (
                    <PriceField label="Clase 1h 30min (€)" value={config.pay_per_class_price_90} onChange={v => setConfig({ ...config, pay_per_class_price_90: v })} />
                  )}
                </div>
              </CardBody>
            </Card>
          )}

          {features.enable_payments && showClassPrices && (
            <Card>
              <CardHeader
                title="Clase entera"
                description="Un alumno paga la clase completa en vez de cada uno su plaza. Útil para grupos que reparten el pago entre ellos fuera de la app."
              />
              <CardBody>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {features.enable_60min && (
                    <PriceField label="Clase entera 1 hora (€)" value={config.whole_class_price_60} onChange={v => setConfig({ ...config, whole_class_price_60: v })} />
                  )}
                  {features.enable_90min && (
                    <PriceField label="Clase entera 1h 30min (€)" value={config.whole_class_price_90} onChange={v => setConfig({ ...config, whole_class_price_90: v })} />
                  )}
                </div>
              </CardBody>
            </Card>
          )}

          {features.enable_class_validation && showClassPrices && (
            <Card>
              <CardHeader
                title="Precio por clase (validación de clases)"
                description="Se usa para calcular el descuento de las clases no dadas, según si el alumno usa pista del club o la suya propia."
              />
              <CardBody className="space-y-5">
                <div>
                  <p className="mb-2 text-label text-ink-2">Con pista</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {features.enable_60min && (
                      <PriceField label="Con pista, 1 hora (€)" value={config.price_per_class_with_court_60} onChange={v => setConfig({ ...config, price_per_class_with_court_60: v })} />
                    )}
                    {features.enable_90min && (
                      <PriceField label="Con pista, 1h 30min (€)" value={config.price_per_class_with_court_90} onChange={v => setConfig({ ...config, price_per_class_with_court_90: v })} />
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-label text-ink-2">Sin pista</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {features.enable_60min && (
                      <PriceField label="Sin pista, 1 hora (€)" value={config.price_per_class_without_court_60} onChange={v => setConfig({ ...config, price_per_class_without_court_60: v })} />
                    )}
                    {features.enable_90min && (
                      <PriceField label="Sin pista, 1h 30min (€)" value={config.price_per_class_without_court_90} onChange={v => setConfig({ ...config, price_per_class_without_court_90: v })} />
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {features.enable_bag && showClassPrices && (
            <Card>
              <CardHeader title="Bonos de clases" />
              <CardBody className="space-y-5">
                {features.enable_60min && (
                  <div>
                    <p className="mb-2 text-label text-ink-2">Bono 1 hora</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <CountField label="Clases por bono (1 hora)" value={config.classes_per_pack_60} onChange={v => setConfig({ ...config, classes_per_pack_60: v })} />
                      <PriceField label="Precio del bono de 1 hora (€)" value={config.pack_price_60} onChange={v => setConfig({ ...config, pack_price_60: v })} />
                    </div>
                    <p className="mt-2 text-meta tabular-nums text-ink-3">
                      Precio por clase: {config.classes_per_pack_60 > 0 ? ((config.pack_price_60 / config.classes_per_pack_60) / 100).toFixed(2) : '0.00'} €
                    </p>
                  </div>
                )}
                {features.enable_90min && (
                  <div>
                    <p className="mb-2 text-label text-ink-2">Bono 1h 30min</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <CountField label="Clases por bono (1h 30min)" value={config.classes_per_pack_90} onChange={v => setConfig({ ...config, classes_per_pack_90: v })} />
                      <PriceField label="Precio del bono de 1h 30min (€)" value={config.pack_price_90} onChange={v => setConfig({ ...config, pack_price_90: v })} />
                    </div>
                    <p className="mt-2 text-meta tabular-nums text-ink-3">
                      Precio por clase: {config.classes_per_pack_90 > 0 ? ((config.pack_price_90 / config.classes_per_pack_90) / 100).toFixed(2) : '0.00'} €
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {features.enable_private_lessons && (
            <Card>
              <CardHeader
                title="Alumno externo"
                description='Tarifas para alumnos marcados como "externo" en su ficha. No ven los huecos libres de las clases fijas de la escuela.'
              />
              <CardBody className="space-y-5">
                <div>
                  <p className="mb-2 text-label text-ink-2">Clase suelta externa</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {features.enable_60min && (
                      <PriceField label="Clase 1 hora (€)" value={config.pay_per_class_price_60_external} onChange={v => setConfig({ ...config, pay_per_class_price_60_external: v })} />
                    )}
                    {features.enable_90min && (
                      <PriceField label="Clase 1h 30min (€)" value={config.pay_per_class_price_90_external} onChange={v => setConfig({ ...config, pay_per_class_price_90_external: v })} />
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-label text-ink-2">Bono externo</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {features.enable_60min && (
                      <>
                        <CountField label="Bono 1h: clases por bono" value={config.classes_per_pack_60_external} onChange={v => setConfig({ ...config, classes_per_pack_60_external: v })} />
                        <PriceField label="Bono 1h: precio (€)" value={config.pack_price_60_external} onChange={v => setConfig({ ...config, pack_price_60_external: v })} />
                      </>
                    )}
                    {features.enable_90min && (
                      <>
                        <CountField label="Bono 1h30: clases por bono" value={config.classes_per_pack_90_external} onChange={v => setConfig({ ...config, classes_per_pack_90_external: v })} />
                        <PriceField label="Bono 1h30: precio (€)" value={config.pack_price_90_external} onChange={v => setConfig({ ...config, pack_price_90_external: v })} />
                      </>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {features.enable_private_lessons && (
            <Card>
              <CardHeader
                title="Clase particular"
                description="Clase 1 a 1 con un monitor. Cualquier alumno puede pedirla, de la escuela o externo. Si el monitor tiene marcada la tarifa premium en su ficha, se aplica el precio premium."
              />
              <CardBody className="space-y-5">
                {(['60', '90'] as const).map(dur => (
                  <div key={dur}>
                    <p className="mb-2 text-label text-ink-2">{dur === '60' ? 'Clase particular 1 hora' : 'Clase particular 1h 30min'}</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <PriceField
                        label="Alumno de la escuela (€)"
                        value={config[`private_lesson_price_${dur}` as keyof AppConfig] as number}
                        onChange={v => setConfig({ ...config, [`private_lesson_price_${dur}`]: v })}
                      />
                      <PriceField
                        label="Alumno externo (€)"
                        value={config[`private_lesson_price_${dur}_external` as keyof AppConfig] as number}
                        onChange={v => setConfig({ ...config, [`private_lesson_price_${dur}_external`]: v })}
                      />
                      <PriceField
                        label="Alumno de la escuela, monitor premium (€)"
                        value={config[`private_lesson_price_${dur}_premium` as keyof AppConfig] as number}
                        onChange={v => setConfig({ ...config, [`private_lesson_price_${dur}_premium`]: v })}
                      />
                      <PriceField
                        label="Alumno externo, monitor premium (€)"
                        value={config[`private_lesson_price_${dur}_premium_external` as keyof AppConfig] as number}
                        onChange={v => setConfig({ ...config, [`private_lesson_price_${dur}_premium_external`]: v })}
                      />
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {features.enable_private_lessons && (
            <Card>
              <CardHeader title="Bono de clase particular" description="Pack de créditos que solo valen para clases particulares." />
              <CardBody className="space-y-6">
                {(['60', '90'] as const).map(dur => (
                  <div key={dur}>
                    <p className="mb-2 text-label text-ink-2">{dur === '60' ? 'Bono particular 1 hora' : 'Bono particular 1h 30min'}</p>
                    <div className="space-y-3">
                      {([
                        { suffix: '', label: 'Alumno de la escuela' },
                        { suffix: '_external', label: 'Alumno externo' },
                        { suffix: '_premium', label: 'Alumno de la escuela, monitor premium' },
                        { suffix: '_premium_external', label: 'Alumno externo, monitor premium' },
                      ] as const).map(({ suffix, label }) => (
                        <div key={suffix} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <CountField
                            label={`${label}: clases por bono`}
                            value={config[`private_lesson_pack_classes_${dur}${suffix}` as keyof AppConfig] as number}
                            onChange={v => setConfig({ ...config, [`private_lesson_pack_classes_${dur}${suffix}`]: v })}
                          />
                          <PriceField
                            label={`${label}: precio (€)`}
                            value={config[`private_lesson_pack_price_${dur}${suffix}` as keyof AppConfig] as number}
                            onChange={v => setConfig({ ...config, [`private_lesson_pack_price_${dur}${suffix}`]: v })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          <SectionTitle>Clases y faltas</SectionTitle>

          {features.enable_bag && (
            <Card>
              <CardHeader title="Política de cancelación" />
              <CardBody>
                <Field label="Horas de antelación" hint="Si el alumno cancela con menos de estas horas, el crédito no se devuelve.">
                  <div className="flex items-center gap-3">
                    <Input
                      type="text"
                      inputMode="numeric"
                      onFocus={e => e.target.select()}
                      value={displayInt(config.cancellation_hours)}
                      onChange={e => setConfig({ ...config, cancellation_hours: intVal(e.target.value) })}
                      className="w-28 tabular-nums"
                    />
                    <span className="text-body text-ink-2">horas antes del inicio</span>
                  </div>
                </Field>
              </CardBody>
            </Card>
          )}

          {features.enable_bag && (
            <Card>
              <CardHeader title="Antelación para registrar falta" />
              <CardBody>
                <Field
                  label="Meses de antelación"
                  hint="Con cuántos meses de adelanto puede un alumno registrar su falta y sumar la clase a su bolsa ya. En 0, se queda como ahora (unos 2 meses vista)."
                >
                  <div className="flex items-center gap-3">
                    <Input
                      type="text"
                      inputMode="numeric"
                      onFocus={e => e.target.select()}
                      value={displayInt(config.falta_advance_months)}
                      onChange={e => setConfig({ ...config, falta_advance_months: intVal(e.target.value) })}
                      className="w-28 tabular-nums"
                    />
                    <span className="text-body text-ink-2">meses vista (0 = actual)</span>
                  </div>
                </Field>
              </CardBody>
            </Card>
          )}

          {!features.enable_payments && !features.enable_bag && (
            <Notice tone="neutral" icon={<Info />}>
              Activa los módulos de pagos o bolsa en{' '}
              <button type="button" onClick={() => setActiveTab('modulos')} className="font-medium text-accent-ink underline hover:no-underline">Módulos</button>
              {' '}para configurar precios.
            </Notice>
          )}

          <Card>
            <CardHeader title="Clases de recuperación" />
            <CardBody>
              <Field
                label="Máximo de clases pendientes"
                hint="Máximo de clases de recuperación pendientes acumuladas por alumno. Las clases de bono no cuentan. Pon 0 para no aplicar límite."
              >
                <div className="flex items-center gap-3">
                  <Input
                    type="text"
                    inputMode="numeric"
                    onFocus={e => e.target.select()}
                    value={displayInt(config.max_recovery_classes)}
                    onChange={e => setConfig({ ...config, max_recovery_classes: intVal(e.target.value) })}
                    className="w-28 tabular-nums"
                  />
                  <span className="text-body text-ink-2">
                    {config.max_recovery_classes === 0 ? 'sin límite' : 'clases máximo'}
                  </span>
                </div>
              </Field>
            </CardBody>
          </Card>

          <SectionTitle>Calendario y facturación</SectionTitle>

          <Card>
            <CardHeader
              title="Días festivos"
              description="Las clases no se imparten estos días. No aparecerán en el calendario ni en los huecos disponibles."
            />
            <CardBody className="space-y-4">
              {holidays.length === 0 ? (
                <p className="text-body text-ink-2">No hay días festivos configurados.</p>
              ) : (
                <ul className="divide-y divide-line rounded-control border border-line">
                  {holidays.map(date => (
                    <li key={date} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-label text-ink">{formatLongDate(date)}</p>
                        <p className="text-meta tabular-nums text-ink-3">{date}</p>
                      </div>
                      <Button variant="danger-ghost" size="sm" onClick={() => removeHoliday(date)} disabled={holidaysSaving}>
                        Eliminar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Nuevo día festivo" className="min-w-40 flex-1">
                  <Input type="date" value={newHoliday} onChange={e => setNewHoliday(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addHoliday() }} />
                </Field>
                <Button onClick={addHoliday} loading={holidaysSaving} disabled={!newHoliday || holidays.includes(newHoliday)}>
                  Añadir festivo
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Inicio de facturación"
              description="Si el curso no empieza en enero, indica la fecha a partir de la cual se muestra el estado de pago mensual. Antes de esa fecha no aparecerá la columna de cobro en los grupos fijos."
            />
            <CardBody className="space-y-2">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Fecha de inicio">
                  <Input type="date" value={config.billing_start_date} onChange={e => setConfig({ ...config, billing_start_date: e.target.value })} />
                </Field>
                {config.billing_start_date && (
                  <Button variant="ghost" onClick={() => setConfig({ ...config, billing_start_date: '' })}>
                    Quitar fecha
                  </Button>
                )}
              </div>
              {config.billing_start_date && (
                <p className="text-meta text-accent-ink">
                  Los pagos se mostrarán a partir del {formatLongDate(config.billing_start_date, { weekday: false })} de {config.billing_start_date.slice(0, 4)}.
                </p>
              )}
            </CardBody>
          </Card>

          <SaveBar onSave={saveConfig} saving={saving} saved={saved} error={saveError} label="Guardar tarifas" />
        </>
      )}

      {/* Tab: Playtomic */}
      {activeTab === 'playtomic' && features.enable_pista_viva && (
        <div id="playtomic" className="space-y-5">
          <Card>
            <CardHeader
              title="Pista Viva: Playtomic"
              description="Credenciales oficiales de Playtomic (Client ID y Secret) para detectar partidos abiertos con jugadores pendientes."
            />
            <CardBody className="space-y-4">
              <Field label="Email de tu cuenta Playtomic">
                <Input type="email" inputMode="email" value={playtomic.email} onChange={(e) => setPlaytomic(p => ({ ...p, email: e.target.value }))} autoComplete="off" placeholder="admin@venditto.com" />
              </Field>
              <Field label="Contraseña de Playtomic" hint="Solo se guarda si introduces una nueva.">
                <Input type="password" value={playtomic.password} onChange={(e) => setPlaytomic(p => ({ ...p, password: e.target.value }))} autoComplete="new-password" />
              </Field>
              <div>
                <Field label="Buscar tu club en Playtomic">
                  <div className="flex flex-wrap gap-2">
                    <Input
                      type="text"
                      value={tenantSearch}
                      onChange={(e) => setTenantSearch(e.target.value)}
                      placeholder="Nombre del club en Playtomic"
                      className="min-w-40 flex-1"
                    />
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        if (tenantSearch.length < 2) return
                        const res = await fetch(`/api/admin/pista-viva/tenants/search?text=${encodeURIComponent(tenantSearch)}`)
                        const data = await res.json()
                        setTenantResults(data.tenants ?? [])
                      }}
                    >
                      <Search className="h-4 w-4" aria-hidden />
                      Buscar
                    </Button>
                  </div>
                </Field>
                {tenantResults.length > 0 && (
                  <ul className="mt-2 divide-y divide-line rounded-control border border-line">
                    {tenantResults.map((t) => (
                      <li key={t.tenant_id}>
                        <button
                          type="button"
                          onClick={() => { setPlaytomic(p => ({ ...p, tenantId: t.tenant_id })); setTenantResults([]) }}
                          className="min-h-11 w-full px-3 py-2 text-left transition-colors hover:bg-ink/[0.03]"
                        >
                          <span className="text-label text-ink">{t.name}</span>
                          {t.address && <span className="ml-2 text-meta text-ink-3">{t.address}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Field label="Tenant ID (UUID)">
                <Input type="text" value={playtomic.tenantId} onChange={(e) => setPlaytomic(p => ({ ...p, tenantId: e.target.value }))} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono" />
              </Field>
              <Field label="URL del club en Playtomic">
                <Input type="url" inputMode="url" value={playtomic.bookingUrl} onChange={(e) => setPlaytomic(p => ({ ...p, bookingUrl: e.target.value }))} placeholder="https://playtomic.io/tu-club/uuid" />
              </Field>
              <SaveBar
                saving={playtomicSaving}
                saved={playtomicSaved}
                error={playtomicError}
                label="Guardar Playtomic"
                onSave={async () => {
                  setPlaytomicSaving(true)
                  setPlaytomicError('')
                  const body: Record<string, string> = {
                    playtomic_email: playtomic.email,
                    playtomic_tenant_id: playtomic.tenantId,
                    playtomic_booking_url: playtomic.bookingUrl,
                  }
                  if (playtomic.password) body.playtomic_password = playtomic.password
                  if (playtomic.clientId) body.playtomic_client_id = playtomic.clientId
                  if (playtomic.clientSecret) body.playtomic_client_secret = playtomic.clientSecret
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
                    setPlaytomic(p => ({ ...p, password: '', clientSecret: '' }))
                    setTimeout(() => setPlaytomicSaved(false), 2000)
                  }
                  setPlaytomicSaving(false)
                }}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Importar jugadores desde Playtomic"
              description="Usa la API oficial de Playtomic para traer todos los jugadores del club y crearlos automáticamente como alumnos en PSM. Necesitas las credenciales de desarrollador de Playtomic (Client ID y Secret)."
            />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Client ID">
                  <Input type="text" value={playtomic.clientId} onChange={(e) => setPlaytomic(p => ({ ...p, clientId: e.target.value }))} placeholder="clb_xxxxxxxxxxxxxxxx" className="font-mono" autoComplete="off" />
                </Field>
                <Field label="Client Secret" hint="Solo se guarda si introduces uno nuevo.">
                  <Input type="password" value={playtomic.clientSecret} onChange={(e) => setPlaytomic(p => ({ ...p, clientSecret: e.target.value }))} autoComplete="new-password" />
                </Field>
              </div>

              {extractError && <p role="alert" className="text-meta font-medium text-danger-ink">{extractError}</p>}

              {extracting && (
                <p role="status" className="text-body text-ink-2 tabular-nums">Extrayendo… {extractedPlayers.length} jugadores traídos hasta ahora</p>
              )}

              {extractedPlayers.length > 0 && (
                <div className="rounded-control border border-dashed border-line-strong/60 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-label text-ink tabular-nums">
                      {extractedPlayers.length} jugadores {extractDone ? 'traídos en total' : 'traídos hasta ahora (extracción en curso)'}:{' '}
                      {extractedPlayers.filter((p) => p.status === 'se_crearia').length} se crearían,{' '}
                      {extractedPlayers.filter((p) => p.status === 'ya_existe').length} ya existen,{' '}
                      {extractedPlayers.filter((p) => p.status === 'sin_email').length} sin email
                    </p>
                    {extractDone && (
                      <Button variant="secondary" size="sm" onClick={() => downloadCsv('playtomic-jugadores.csv', extractedPlayers, PLAYTOMIC_PLAYER_COLUMNS)}>
                        <Download className="h-4 w-4" aria-hidden />
                        Descargar CSV ({extractedPlayers.length})
                      </Button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-auto rounded-control border border-line">
                    <table className="w-full min-w-[1400px] text-meta">
                      <thead className="sticky top-0 bg-surface-2">
                        <tr>
                          {PLAYTOMIC_PLAYER_COLUMNS.map((c) => (
                            <th key={c.key} scope="col" className="whitespace-nowrap px-3 py-2 text-left font-medium text-ink-3">{c.header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {extractedPlayers.map((p, i) => (
                          <tr key={i}>
                            {PLAYTOMIC_PLAYER_COLUMNS.map((c) => (
                              <td key={c.key} className="whitespace-nowrap px-3 py-1.5 text-ink-2">
                                {c.key === 'status' ? (
                                  <>
                                    {p.status === 'se_crearia' && <Badge tone="success"><CircleCheck className="h-3.5 w-3.5" aria-hidden />Se crearía</Badge>}
                                    {p.status === 'ya_existe' && <Badge tone="neutral">Ya existe</Badge>}
                                    {p.status === 'sin_email' && <Badge tone="danger"><CircleX className="h-3.5 w-3.5" aria-hidden />Sin email</Badge>}
                                  </>
                                ) : c.key === 'acceptsMarketing' ? (
                                  p.acceptsMarketing === null ? '—' : p.acceptsMarketing ? 'Sí' : 'No'
                                ) : (
                                  String(p[c.key] ?? '—')
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importResult && (
                <Notice
                  tone={importResult.errors > 0 && importResult.imported === 0 ? 'danger' : 'success'}
                  icon={importResult.errors > 0 && importResult.imported === 0 ? <CircleX /> : <CircleCheck />}
                >
                  {importResult.message}
                </Notice>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  loading={extracting}
                  onClick={async () => {
                    setExtracting(true)
                    setExtractError('')
                    setExtractDone(false)
                    setExtractedPlayers([])
                    let cursorId: string | null = null
                    let hasMore = true
                    const acc: PlaytomicPreviewPlayer[] = []
                    const MAX_BATCHES = 300 // salvaguarda, cubre de sobra los ~22.000 reales
                    for (let i = 0; i < MAX_BATCHES && hasMore; i++) {
                      const res: Response = await fetch('/api/admin/playtomic/players-page', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cursorId }),
                      })
                      const data: any = await res.json().catch(() => ({ error: 'Error de conexión' }))
                      if (!res.ok) {
                        setExtractError(data.error ?? 'Error')
                        break
                      }
                      acc.push(...(data.players ?? []))
                      setExtractedPlayers([...acc])
                      cursorId = data.nextCursorId ?? null
                      hasMore = !!data.hasMore
                    }
                    setExtractDone(true)
                    setExtracting(false)
                  }}
                >
                  {extracting ? 'Extrayendo…' : 'Extraer y ver jugadores de Playtomic'}
                </Button>

                <Button
                  loading={importing}
                  onClick={async () => {
                    setImporting(true)
                    setImportResult(null)
                    const res = await fetch('/api/admin/playtomic/import-players', { method: 'POST' })
                    const data = await res.json().catch(() => ({ error: 'Error de conexión' }))
                    if (!res.ok) setImportResult({ imported: 0, skipped: 0, errors: 1, message: data.error ?? 'Error' })
                    else setImportResult(data)
                    setImporting(false)
                  }}
                >
                  {importing ? 'Importando jugadores…' : 'Importar jugadores de Playtomic'}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
      </div>
    </div>
  )
}
