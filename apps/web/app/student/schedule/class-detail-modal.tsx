'use client'

import { useEffect, useState } from 'react'

interface Material {
  id: string
  title: string
  description: string | null
  file_url: string | null
  created_at: string
}

interface ClassDetailModalProps {
  open: boolean
  onClose: () => void
  scheduleId: string
  levelId: string | null
  dayLabel: string
  startTime: string
  endTime: string
  courtName: string
  level: { name: string; color: string } | null
}

export function ClassDetailModal({
  open, onClose, scheduleId, levelId,
  dayLabel, startTime, endTime, courtName, level,
}: ClassDetailModalProps) {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const params = new URLSearchParams({ scheduleId })
    if (levelId) params.set('levelId', levelId)
    fetch(`/api/materials?${params}`)
      .then(r => r.json())
      .then(d => setMaterials(d.materials ?? []))
      .finally(() => setLoading(false))
  }, [open, scheduleId, levelId])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{ background: '#f8f9ff', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4" style={{ background: 'linear-gradient(135deg, #006b2c, #00873a)' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/70 mb-1">Detalle de clase</p>
              <h2 className="text-[20px] font-extrabold text-white leading-tight">
                {dayLabel}
              </h2>
              <p className="text-[14px] text-white/80 mt-0.5">{startTime} – {endTime}</p>
            </div>
            <button
              onClick={onClose}
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Info pills */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              {courtName}
            </span>
            {level && (
              <span className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
                style={{ backgroundColor: level.color + 'cc' }}>
                {level.name}
              </span>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-5 py-5" style={{ maxHeight: 'calc(90vh - 160px)' }}>

          {/* Materials section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ background: 'rgba(0,107,44,0.1)' }}>
                <svg className="h-4 w-4" style={{ color: '#006b2c' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-[13px] font-extrabold" style={{ color: '#0b1c30' }}>Material de la clase</h3>
            </div>

            {loading ? (
              <div className="space-y-2.5">
                {[1, 2].map(i => (
                  <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: '#e5eeff' }} />
                ))}
              </div>
            ) : materials.length === 0 ? (
              <div className="rounded-2xl border py-8 text-center" style={{ borderColor: '#bdcaba', background: 'rgba(255,255,255,0.6)' }}>
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: '#eff4ff' }}>
                  <svg className="h-5 w-5" style={{ color: '#bdcaba' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <p className="text-[12px] font-medium" style={{ color: '#3e4a3d' }}>Sin material asignado</p>
                <p className="text-[11px] mt-0.5" style={{ color: '#bdcaba' }}>Tu monitor irá añadiendo recursos</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {materials.map(m => (
                  <div key={m.id} className="flex items-center gap-3 rounded-2xl p-3.5"
                    style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', border: '1px solid #bdcaba' }}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: 'rgba(220,38,38,0.08)' }}>
                      <svg className="h-5 w-5" style={{ color: '#dc2626' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold truncate" style={{ color: '#0b1c30' }}>{m.title}</p>
                      {m.description && (
                        <p className="text-[11px] mt-0.5 line-clamp-1" style={{ color: '#3e4a3d' }}>{m.description}</p>
                      )}
                      <p className="text-[10px] mt-0.5" style={{ color: '#bdcaba' }}>
                        {new Date(m.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    {m.file_url && (
                      <a
                        href={m.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-xl px-3 py-2 text-[11px] font-bold text-white transition-opacity hover:opacity-80"
                        style={{ background: '#006b2c' }}
                      >
                        Abrir
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
