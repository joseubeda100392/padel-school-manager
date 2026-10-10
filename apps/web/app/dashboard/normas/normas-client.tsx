'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { CircleCheck, FileText, FileUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Notice, Skeleton } from '@/components/ui/feedback'

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
      toast.error('Error al subir el PDF. Inténtalo de nuevo.')
      setUploading(false)
      return
    }

    const featRes = await fetch('/api/admin/club-features').then(r => r.json()).catch(() => ({}))
    const updatedFeatures = { ...(featRes?.features ?? {}), terms_pdf_url: path, enable_terms: true }
    const res = await fetch('/api/admin/club-features', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedFeatures),
    })

    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''

    if (res.ok) {
      setPdfUrl(path)
      setEnabled(true)
      toast.success('PDF de condiciones actualizado')
    } else {
      toast.error('PDF subido pero no se guardó la URL')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-56 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="PDF de condiciones"
          description="Sube el documento con las normas de la escuela. Los alumnos y monitores podrán consultarlo desde su área."
        />
        <CardBody className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            aria-label="Archivo PDF de condiciones"
            onChange={handleUpload}
          />

          {pdfUrl ? (
            <div className="flex flex-wrap items-center gap-3 rounded-control border border-accent/30 bg-accent-soft px-4 py-3">
              <FileText className="h-5 w-5 shrink-0 text-accent-ink" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-label text-accent-ink">PDF subido correctamente</p>
                <p className="truncate text-meta text-ink-3">{pdfUrl.split('/').pop()?.split('?')[0]}</p>
              </div>
              <a
                href="/api/pdf/normas"
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                Ver PDF
              </a>
            </div>
          ) : (
            <div className="flex h-28 items-center justify-center rounded-control border border-dashed border-line-strong/60 bg-surface-2">
              <p className="text-body text-ink-2">Todavía no has subido ningún PDF</p>
            </div>
          )}

          <Button
            variant={pdfUrl ? 'secondary' : 'primary'}
            onClick={() => fileRef.current?.click()}
            loading={uploading}
            className="w-full sm:w-auto"
          >
            {!uploading && <FileUp className="h-4 w-4" aria-hidden />}
            {uploading ? 'Subiendo…' : pdfUrl ? 'Cambiar PDF' : 'Subir PDF'}
          </Button>
        </CardBody>
      </Card>

      {enabled && (
        <Notice tone="success" icon={<CircleCheck />}>
          El módulo de condiciones está <strong>activo</strong>. Los alumnos verán este documento en su sección Normas.
        </Notice>
      )}
    </div>
  )
}
