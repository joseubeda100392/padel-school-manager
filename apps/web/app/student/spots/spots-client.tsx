'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search, Clock, Users, User, Wallet, ChevronRight,
  Bell, History, UserPlus, Package,
} from 'lucide-react'
import { PayButton } from '@/components/pay-button'
import { SpotDetailModal } from './spot-detail-modal'

interface Spot {
  spotType: 'absence' | 'capacity'
  exclusionId: string | null
  excludedDate: string
  scheduleId: string
  dayLabel: string
  startTime: string
  endTime: string
  durationMin: number
  courtName: string
  coachName: string | null
  maxStudents: number
  level: { name: string; color: string } | null
  enrolledCount: number | null
}

// ── helpers ──────────────────────────────────────────────────────────────────

function buildDays(n = 7) {
  const days = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < n; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const label = d.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase().replace('.', '')
    days.push({ iso, label, num: d.getDate(), mon: d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''), isToday: i === 0 })
  }
  return days
}

function spotAccent(spot: Spot) {
  return spot.spotType === 'capacity' ? '#2563eb' : 'var(--color-primary)'
}
function spotBadgeStyle(spot: Spot): React.CSSProperties {
  return spot.spotType === 'capacity'
    ? { background: '#eff6ff', color: '#2563eb' }
    : { background: 'var(--color-primary-light)', color: 'var(--color-primary)' }
}

// ── SpotCard ─────────────────────────────────────────────────────────────────

function SpotCard({ spot, balance60, balance90, onViewDetail }: {
  spot: Spot
  balance60: number
  balance90: number
  onViewDetail: () => void
}) {
  const router = useRouter()
  const [booking, setBooking] = useState(false)
  const [booked, setBooked] = useState(false)
  const [error, setError] = useState('')

  const freePlaces = spot.enrolledCount !== null ? spot.maxStudents - spot.enrolledCount : 1
  const isFull = freePlaces <= 0
  const durationType: '60' | '90' = spot.durationMin >= 80 ? '90' : '60'
  const hasBalance = durationType === '90' ? balance90 > 0 : (balance60 > 0 || balance90 > 0)
  const accent = spotAccent(spot)

  const dateLabel = new Date(spot.excludedDate + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  async function handleUseBag() {
    if (!confirm(`¿Confirmas usar 1 clase de tu bolsa para el ${dateLabel}?`)) return
    setBooking(true); setError('')
    const endpoint = spot.spotType === 'absence' ? '/api/bookings/spot' : '/api/bookings/capacity-spot'
    const body = spot.spotType === 'absence'
      ? { exclusionId: spot.exclusionId, scheduleId: spot.scheduleId }
      : { scheduleId: spot.scheduleId, date: spot.excludedDate }
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    if (res.ok) { setBooked(true); router.refresh() } else setError(json.error ?? 'Error al reservar')
    setBooking(false)
  }

  if (booked) {
    return (
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--color-primary-light)', borderColor: 'rgba(0,107,44,0.2)' }}>
        <div className="h-1.5" style={{ background: 'var(--color-primary)' }} />
        <div className="p-4 flex items-center gap-3">
          <svg className="h-5 w-5 shrink-0" style={{ color: 'var(--color-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-bold capitalize" style={{ color: 'var(--color-primary)' }}>Plaza reservada</p>
            <p className="text-xs mt-0.5 text-gray-500">{spot.startTime} – {spot.endTime} · {spot.courtName}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden hover:shadow-lg transition-all group flex flex-col"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)' }}>
      <div className="h-1.5" style={{ background: accent }} />
      <div className="p-4 flex-1 flex flex-col">

        {/* Badge + title + duration */}
        <div className="flex justify-between items-start mb-3 gap-2">
          <div className="min-w-0">
            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase mb-1.5"
              style={spotBadgeStyle(spot)}>
              {spot.spotType === 'capacity' ? 'Plaza libre' : 'Hueco por falta'}
            </span>
            <h3 className="font-semibold text-[15px] leading-snug capitalize"
              style={{ color: 'var(--color-on-surface)' }}>{dateLabel}</h3>
          </div>
          <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
            {spot.durationMin} min
          </span>
        </div>

        {/* Info grid 2×2 */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4 shrink-0" style={{ color: accent }} />
            <span>{spot.startTime} – {spot.endTime}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 shrink-0" style={{ color: accent }} />
            {spot.enrolledCount !== null
              ? isFull
                ? <span className="font-semibold text-red-500">Completo</span>
                : <span className="text-gray-500">{spot.enrolledCount} / {spot.maxStudents} plazas</span>
              : <span className="text-gray-400">—</span>}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <User className="h-4 w-4 shrink-0" style={{ color: accent }} />
            <span className="truncate">{spot.coachName ?? 'Sin monitor'}</span>
          </div>
          <div className="flex items-center gap-2">
            {spot.level
              ? <span className="px-2 py-0.5 rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: spot.level.color }}>{spot.level.name}</span>
              : <span className="text-xs text-gray-400">—</span>}
          </div>
        </div>

        {/* Occupancy bar */}
        {spot.enrolledCount !== null && (
          <div className="mb-4 h-1 w-full rounded-full overflow-hidden bg-gray-100">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.round((spot.enrolledCount / spot.maxStudents) * 100))}%`, background: isFull ? '#ef4444' : accent, opacity: 0.7 }} />
          </div>
        )}

        {/* CTA row */}
        <div className="mt-auto flex items-center gap-2">
          <button
            onClick={onViewDetail}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-50"
            style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}
          >
            <ChevronRight className="h-4 w-4" />
            Detalle
          </button>

          <div className="flex-1">
            {isFull ? (
              <button disabled className="w-full rounded-lg py-2 text-sm font-bold cursor-not-allowed"
                style={{ background: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
                Lista de espera
              </button>
            ) : hasBalance ? (
              <button onClick={handleUseBag} disabled={booking}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50 !bg-[#006b2c] hover:!bg-[#005a25]"
                style={{ background: 'var(--color-primary)' }}>
                {booking
                  ? <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  : 'Reservar con bolsa'}
              </button>
            ) : (
              <PayButton
                type="single_class"
                scheduleId={spot.scheduleId}
                exclusionId={spot.exclusionId ?? undefined}
                classDate={spot.excludedDate}
                label="Pagar clase"
                className="w-full rounded-lg py-2 text-sm font-bold text-white text-center block !bg-[#006b2c] hover:!bg-[#005a25]"
              />
            )}
          </div>
        </div>

        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        {!hasBalance && durationType === '90' && balance60 > 0 && (
          <p className="mt-1 text-xs" style={{ color: 'var(--color-warning)' }}>Bono 60 min no válido para clase de 90 min</p>
        )}
      </div>
    </div>
  )
}

// ── Right sidebar ─────────────────────────────────────────────────────────────

function RightSidebar({ userName, levelName, levelColor, balance60, balance90, unreadCount }: {
  userName: string
  levelName: string | null
  levelColor: string | null
  balance60: number
  balance90: number
  unreadCount: number
}) {
  const initials = userName
    ? userName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'A'
  const totalBag = balance60 + balance90
  const bagMax = Math.max(totalBag * 2, 10) // visual max for the bar

  return (
    <aside className="hidden xl:flex w-80 shrink-0 flex-col gap-5">
      {/* Profile card */}
      <div className="rounded-2xl border p-5 flex flex-col items-center text-center"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)' }}>
        <div className="relative mb-3">
          <div className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>
            {initials}
          </div>
          <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center border-2 border-white"
            style={{ background: 'var(--color-primary)' }}>
            <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <p className="font-bold text-[15px]" style={{ color: 'var(--color-on-surface)' }}>{userName || 'Alumno'}</p>
        {levelName && (
          <span className="mt-2 inline-block px-3 py-1 rounded-full text-[11px] font-bold text-white"
            style={{ backgroundColor: levelColor ?? 'var(--color-primary)' }}>
            {levelName}
          </span>
        )}
      </div>

      {/* Bag widget */}
      <div className="rounded-2xl border p-5 relative overflow-hidden"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)' }}>
        {/* subtle dot pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(var(--color-primary) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="relative">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>Bolsa de clases</span>
            <Wallet className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
          </div>
          <div className="text-3xl font-bold mb-1" style={{ color: 'var(--color-on-surface)' }}>{totalBag}</div>
          <p className="text-xs mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>
            {balance60 > 0 && `${balance60} × 60 min`}
            {balance60 > 0 && balance90 > 0 && ' · '}
            {balance90 > 0 && `${balance90} × 90 min`}
            {totalBag === 0 && 'Sin clases disponibles'}
          </p>
          {/* balance bar */}
          <div className="h-1.5 w-full rounded-full overflow-hidden mt-3 mb-4 bg-gray-100">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.round((totalBag / bagMax) * 100))}%`, background: totalBag > 0 ? 'var(--color-primary)' : '#e5e7eb' }} />
          </div>
          <Link href="/student/bag"
            className="flex items-center justify-center gap-1.5 w-full rounded-xl border py-2 text-sm font-bold transition-all hover:opacity-90"
            style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
            <Package className="h-4 w-4" />
            Gestionar bolsa
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {unreadCount > 0 && (
        <div className="rounded-2xl border p-4"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)' }}>
              Notificaciones
            </p>
            <Link href="/student/notifications"
              className="text-[11px] font-semibold"
              style={{ color: 'var(--color-primary)' }}>
              Ver todas
            </Link>
          </div>
          <Link href="/student/notifications"
            className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-gray-50"
            style={{ border: '1px solid var(--color-outline-variant)' }}>
            <div className="h-8 w-8 rounded-full flex items-center justify-center bg-blue-100 shrink-0">
              <Bell className="h-4 w-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold" style={{ color: 'var(--color-on-surface)' }}>
                {unreadCount} notificación{unreadCount !== 1 ? 'es' : ''} sin leer
              </p>
              <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>Toca para verlas</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
          </Link>
        </div>
      )}

      {/* Quick access */}
      <div className="rounded-2xl border p-4"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>
          Acceso rápido
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { href: '/student/schedule', icon: History, label: 'Mi agenda' },
            { href: '/student/notifications', icon: Bell, label: 'Alertas' },
            { href: '/student/bag', icon: Package, label: 'Mi bolsa' },
            { href: '/student/chat', icon: UserPlus, label: 'Soporte' },
          ].map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all hover:border-[var(--color-primary)] hover:bg-gray-50"
              style={{ borderColor: 'var(--color-outline-variant)' }}>
              <Icon className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
              <span className="text-[11px] font-medium" style={{ color: 'var(--color-on-surface)' }}>{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  )
}

// ── SpotsClient ───────────────────────────────────────────────────────────────

export function SpotsClient({
  spots, balance60, balance90, totalBag,
  userName = '', levelName, levelColor, unreadCount = 0,
}: {
  spots: Spot[]
  balance60: number
  balance90: number
  totalBag: number
  userName?: string
  levelName?: string | null
  levelColor?: string | null
  unreadCount?: number
}) {
  const router = useRouter()
  const days = useMemo(() => buildDays(7), [])

  const [selectedDate, setSelectedDate] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null)
  const [modalBooking, setModalBooking] = useState(false)
  const [modalBooked, setModalBooked] = useState(false)
  const [modalError, setModalError] = useState('')

  const levels = useMemo(() => {
    const seen = new Map<string, { name: string; color: string }>()
    spots.forEach(s => { if (s.level) seen.set(s.level.name, s.level) })
    return Array.from(seen.values())
  }, [spots])

  const filtered = useMemo(() => spots.filter(s => {
    if (selectedDate !== 'all' && s.excludedDate !== selectedDate) return false
    if (levelFilter !== 'all' && s.level?.name !== levelFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!s.courtName.toLowerCase().includes(q) && !s.coachName?.toLowerCase().includes(q) &&
        !s.level?.name.toLowerCase().includes(q) && !s.dayLabel.toLowerCase().includes(q)) return false
    }
    return true
  }), [spots, selectedDate, levelFilter, search])

  function openModal(spot: Spot) {
    setSelectedSpot(spot); setModalBooking(false); setModalBooked(false); setModalError('')
  }

  async function handleModalUseBag() {
    if (!selectedSpot) return
    const dateLabel = new Date(selectedSpot.excludedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!confirm(`¿Confirmas usar 1 clase de tu bolsa para el ${dateLabel}?`)) return
    setModalBooking(true); setModalError('')
    const endpoint = selectedSpot.spotType === 'absence' ? '/api/bookings/spot' : '/api/bookings/capacity-spot'
    const body = selectedSpot.spotType === 'absence'
      ? { exclusionId: selectedSpot.exclusionId, scheduleId: selectedSpot.scheduleId }
      : { scheduleId: selectedSpot.scheduleId, date: selectedSpot.excludedDate }
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    if (res.ok) { setModalBooked(true); router.refresh() } else setModalError(json.error ?? 'Error al reservar')
    setModalBooking(false)
  }

  return (
    <div className="flex gap-6 items-start">
      {/* ── Main content ── */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="mb-6">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-primary)' }}>
            Reserva tu plaza
          </span>
          <div className="flex items-center justify-between gap-3 mt-0.5">
            <h1 className="font-heading text-2xl font-bold" style={{ color: 'var(--color-on-surface)' }}>
              Sesiones Disponibles
            </h1>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${spots.length > 0 ? '' : 'text-gray-400 bg-gray-100'}`}
              style={spots.length > 0 ? { background: 'var(--color-primary-light)', color: 'var(--color-primary)' } : {}}>
              {spots.length} sesión{spots.length !== 1 ? 'es' : ''}
            </span>
          </div>
        </div>

        {/* Bag balance pill (mobile: shown here; desktop: in sidebar) */}
        {totalBag > 0 && (
          <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-5 xl:hidden"
            style={{ background: 'var(--color-primary-light)', border: '1px solid rgba(0,107,44,0.18)' }}>
            <Wallet className="h-5 w-5 shrink-0" style={{ color: 'var(--color-primary)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
              Bolsa:{' '}
              {balance60 > 0 && <><strong>{balance60}</strong> × 60 min</>}
              {balance60 > 0 && balance90 > 0 && ' · '}
              {balance90 > 0 && <><strong>{balance90}</strong> × 90 min</>}
            </p>
          </div>
        )}

        {/* Date picker strip */}
        <div className="flex gap-2.5 overflow-x-auto pb-3 mb-5 -mx-1 px-1">
          <button onClick={() => setSelectedDate('all')}
            className="flex flex-col items-center min-w-[64px] py-2.5 rounded-xl border text-sm font-bold transition-all"
            style={selectedDate === 'all'
              ? { background: 'var(--color-primary)', borderColor: 'var(--color-primary)', color: '#fff' }
              : { background: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
            <span className="text-[9px] uppercase font-bold opacity-80 tracking-wide">Todos</span>
            <span className="text-lg font-bold leading-tight">—</span>
          </button>
          {days.map(d => (
            <button key={d.iso} onClick={() => setSelectedDate(d.iso)}
              className="flex flex-col items-center min-w-[64px] py-2.5 rounded-xl border transition-all"
              style={selectedDate === d.iso
                ? { background: 'var(--color-primary)', borderColor: 'var(--color-primary)', color: '#fff' }
                : { background: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
              <span className="text-[9px] uppercase font-bold opacity-80 tracking-wide">{d.isToday ? 'HOY' : d.label}</span>
              <span className="text-xl font-bold leading-tight">{d.num}</span>
              <span className="text-[10px] font-medium opacity-70">{d.mon}</span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2.5 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por pista, monitor o nivel..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm outline-none transition-all"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)' }} />
          </div>
          {levels.length > 1 && (
            <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)' }}>
              <option value="all">Todos los niveles</option>
              {levels.map(l => <option key={l.name} value={l.name}>{l.name}</option>)}
            </select>
          )}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="rounded-xl p-10 text-center border"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)' }}>
            <p className="text-2xl mb-2">🎾</p>
            <p className="font-medium text-gray-500">No hay sesiones disponibles para este filtro.</p>
            <p className="mt-1 text-xs text-gray-400">Prueba con otra fecha o cambia los filtros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filtered.map(spot => (
              <SpotCard
                key={`${spot.spotType}-${spot.scheduleId}-${spot.excludedDate}`}
                spot={spot}
                balance60={balance60}
                balance90={balance90}
                onViewDetail={() => openModal(spot)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Right sidebar (desktop only) ── */}
      <RightSidebar
        userName={userName}
        levelName={levelName ?? null}
        levelColor={levelColor ?? null}
        balance60={balance60}
        balance90={balance90}
        unreadCount={unreadCount}
      />

      {/* Detail modal */}
      {selectedSpot && (
        <SpotDetailModal
          spot={selectedSpot}
          open={!!selectedSpot}
          onClose={() => setSelectedSpot(null)}
          balance60={balance60}
          balance90={balance90}
          booking={modalBooking}
          booked={modalBooked}
          error={modalError}
          onUseBag={handleModalUseBag}
        />
      )}
    </div>
  )
}
