'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { FileText, FileUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/feedback'

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

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {DOCS.map(doc => {
        const hasUrl = !!urls[doc.key]
        const isUploading = uploading === doc.key

        return (
          <Card key={doc.key}>
            <CardHeader
              title={doc.label}
              description={doc.description}
              action={
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  {hasUrl && (
                    <a
                      href={doc.apiPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({ variant: 'secondary', className: 'flex-1 sm:flex-none' })}
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
                        aria-label={`Archivo PDF de ${doc.label}`}
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) handleUpload(doc, file)
                        }}
                      />
                      <Button
                        onClick={() => fileRefs.current[doc.key]?.click()}
                        loading={isUploading}
                        variant={hasUrl ? 'secondary' : 'primary'}
                        className="flex-1 sm:flex-none"
                      >
                        {!isUploading && <FileUp className="h-4 w-4" aria-hidden />}
                        {isUploading ? 'Subiendo…' : hasUrl ? 'Cambiar PDF' : 'Subir PDF'}
                      </Button>
                    </>
                  )}
                </div>
              }
            />

            <div className="p-4 pt-3 sm:p-5 sm:pt-3">
              {hasUrl ? (
                <Badge tone="success" className="gap-2 px-3 py-1.5">
                  <FileText className="h-4 w-4" aria-hidden />
                  PDF disponible
                </Badge>
              ) : (
                <div className="flex h-20 items-center justify-center rounded-control border border-dashed border-line-strong/60 bg-surface-2">
                  <p className="text-body text-ink-2">
                    {isAdmin ? 'Todavía no has subido ningún PDF' : 'No disponible todavía'}
                  </p>
                </div>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
