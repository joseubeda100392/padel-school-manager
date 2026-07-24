'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

export function NormasClient({ clubId }: { clubId: string | null }) {
  const [pdfUrl, setPdfUrl] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/admin/club-features')
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(data => {
        if (data?.features) {
          setEnabled(!!data.features.enable_terms)
          setPdfUrl(typeof data.features.terms_pdf_url === 'string' ? data.features.terms_pdf_url : '')
        }
        setLoading(false)
      })
  }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    const supabase = createClient()
    const path = `terms/${clubId ?? 'global'}/${Date.now()}.pdf`
    const { error: upErr } = await supabase.storage
      .from('materials')
      .upload(path, file, { upsert: true, contentType: 'application/pdf' })

    if (upErr) {
      toast.error('Error al subir el PDF: ' + upErr.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('materials').getPublicUrl(path)

    const featRes = await fetch('/api/admin/club-features').then(r => r.json()).catch(() => ({}))
    const updatedFeatures = { ...(featRes?.features ?? {}), terms_pdf_url: publicUrl, enable_terms: true }
    const res = await fetch('/api/admin/club-features', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedFeatures),
    })

    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''

    if (res.ok) {
      setPdfUrl(publicUrl)
      setEnabled(true)
      toast.success('PDF de condiciones actualizado')
    } else {
      toast.error('PDF subido pero no se guardó la URL')
    }
  }

  if (loading) return <div className="text-sm text-gray-400">Cargando...</div>

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-1 font-semibold text-gray-900">PDF de condiciones</h2>
        <p className="mb-5 text-xs text-gray-400">
          Sube el documento con las normas de la escuela. Los alumnos y monitores podrán consultarlo desde su área.
        </p>

        <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />

        {pdfUrl ? (
          <>
            <div className="mb-4 flex items-center gap-4 rounded-xl border border-green-100 bg-green-50 px-5 py-4">
              <span className="text-2xl">📄</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-green-700">PDF subido correctamente</p>
                <p className="truncate text-xs text-gray-400">{pdfUrl.split('/').pop()?.split('?')[0]}</p>
              </div>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
              >
                Ver PDF
              </a>
            </div>
            <div className="mb-4 overflow-hidden rounded-xl border border-gray-100">
              <iframe
                src={pdfUrl}
                className="h-64 w-full border-0"
                title="Vista previa condiciones"
              />
            </div>
          </>
        ) : (
          <div className="mb-4 flex h-28 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-400">Sin PDF subido aún</p>
          </div>
        )}

        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {uploading ? 'Subiendo...' : pdfUrl ? 'Cambiar PDF' : '+ Subir PDF'}
        </button>
      </div>

      {enabled && (
        <div className="rounded-xl border border-brand-100 bg-brand-50 px-5 py-4">
          <p className="text-sm text-brand-700">
            ✓ El módulo de condiciones está <strong>activo</strong>. Los alumnos verán este documento en su sección Normas.
          </p>
        </div>
      )}
    </div>
  )
}
