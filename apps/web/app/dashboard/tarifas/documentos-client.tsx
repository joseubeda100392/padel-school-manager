'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface Doc {
  key: 'tarifas_pdf_url' | 'calendario_pdf_url' | 'terms_pdf_url'
  label: string
  description: string
  apiPath: string
  storagePath: string
}

const DOCS: Doc[] = [
  {
    key: 'tarifas_pdf_url',
    label: 'Tarifas',
    description: 'Precios de clases, bonos y pago suelto',
    apiPath: '/api/pdf/tarifas',
    storagePath: 'tarifas',
  },
  {
    key: 'calendario_pdf_url',
    label: 'Calendario',
    description: 'Calendario de la temporada del club',
    apiPath: '/api/pdf/calendario',
    storagePath: 'calendario',
  },
  {
    key: 'terms_pdf_url',
    label: 'Normas',
    description: 'Normas y condiciones de uso de la escuela',
    apiPath: '/api/pdf/normas',
    storagePath: 'terms',
  },
]

export function DocumentosClient({ clubId, isAdmin = false }: { clubId: string | null; isAdmin?: boolean }) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    fetch('/api/admin/club-features')
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(data => {
        if (data?.features) {
          const parsed: Record<string, string> = {}
          for (const doc of DOCS) {
            const v = data.features[doc.key]
            if (typeof v === 'string' && v) parsed[doc.key] = v
          }
          setUrls(parsed)
        }
        setLoading(false)
      })
  }, [])

  async function handleUpload(doc: Doc, file: File) {
    setUploading(doc.key)
    const supabase = createClient()
    const path = `${doc.storagePath}/${clubId ?? 'global'}/${Date.now()}.pdf`
    const { error: upErr } = await supabase.storage
      .from('materials')
      .upload(path, file, { upsert: true, contentType: 'application/pdf' })

    if (upErr) {
      toast.error('Error al subir el PDF. Inténtalo de nuevo.')
      setUploading(null)
      return
    }

    const featRes = await fetch('/api/admin/club-features').then(r => r.json()).catch(() => ({}))
    const updatedFeatures = { ...(featRes?.features ?? {}), [doc.key]: path }
    const res = await fetch('/api/admin/club-features', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedFeatures),
    })

    setUploading(null)
    const ref = fileRefs.current[doc.key]
    if (ref) ref.value = ''

    if (res.ok) {
      setUrls(prev => ({ ...prev, [doc.key]: path }))
      toast.success(`PDF de ${doc.label} actualizado`)
    } else {
      toast.error('PDF subido pero no se guardó la URL')
    }
  }

  if (loading) return <div className="text-sm text-gray-400">Cargando...</div>

  return (
    <div className="space-y-4">
      {DOCS.map(doc => {
        const hasUrl = !!urls[doc.key]
        const isUploading = uploading === doc.key

        return (
          <div key={doc.key} className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-gray-900">{doc.label}</h2>
                <p className="mt-0.5 text-xs text-gray-400">{doc.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {hasUrl && (
                  <a
                    href={doc.apiPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Ver PDF
                  </a>
                )}
                {isAdmin && (
                  <>
                    <input
                      ref={el => { fileRefs.current[doc.key] = el }}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) handleUpload(doc, file)
                      }}
                    />
                    <button
                      onClick={() => fileRefs.current[doc.key]?.click()}
                      disabled={isUploading}
                      className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
                    >
                      {isUploading ? 'Subiendo...' : hasUrl ? 'Cambiar PDF' : '+ Subir PDF'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {hasUrl ? (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-green-100 bg-green-50 px-4 py-3">
                <span className="text-xl">📄</span>
                <p className="text-sm font-medium text-green-700">PDF disponible</p>
              </div>
            ) : (
              <div className="mt-4 flex h-20 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-400">
                  {isAdmin ? 'Sin PDF subido aún' : 'No disponible todavía'}
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
