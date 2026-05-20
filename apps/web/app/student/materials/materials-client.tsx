'use client'

import { useState } from 'react'
import { FileText, ChevronDown, ChevronUp, ExternalLink, Eye } from 'lucide-react'

interface Material {
  id: string
  title: string
  description: string | null
  file_url: string | null
  created_at: string
}

interface Props {
  materials: Material[]
  levelName: string | null
  levelColor: string | null
}

function MaterialCard({ m }: { m: Material }) {
  const [expanded, setExpanded] = useState(false)
  const isPdf = m.file_url?.toLowerCase().includes('.pdf') ||
    m.file_url?.toLowerCase().includes('pdf') ||
    true // treat all as pdf-like for preview

  return (
    <div className="rounded-2xl bg-white overflow-hidden shadow-sm border border-[var(--color-outline-variant)] transition-shadow hover:shadow-md">
      {/* Card header */}
      <div className="flex items-center gap-4 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50">
          <FileText className="h-5 w-5 text-red-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 truncate">{m.title}</p>
          {m.description && (
            <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{m.description}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            {new Date(m.created_at).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-4 pb-4">
        {m.file_url && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-outline-variant)] py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Eye className="h-4 w-4" />
            {expanded ? 'Ocultar preview' : 'Ver preview'}
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
        {m.file_url && (
          <a
            href={m.file_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir
          </a>
        )}
      </div>

      {/* Inline PDF preview */}
      {expanded && m.file_url && (
        <div className="border-t border-[var(--color-outline-variant)]">
          <div className="relative bg-gray-100" style={{ height: '480px' }}>
            <iframe
              src={`${m.file_url}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
              className="h-full w-full"
              title={m.title}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
            {/* Fallback overlay — shown via CSS if iframe errors, no JS needed */}
            <div className="pointer-events-none absolute inset-0 hidden items-center justify-center bg-gray-50 text-sm text-gray-500 [&_*]:pointer-events-auto iframe-error:flex">
              <div className="text-center">
                <FileText className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                <p>No se puede previsualizar este archivo.</p>
                <a href={m.file_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[var(--color-primary)] underline">
                  Abrir en nueva pestaña
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function MaterialsClient({ materials, levelName, levelColor }: Props) {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-gray-900">Material didáctico</h1>
        <p className="text-sm text-gray-500">
          {levelName ? (
            <>
              PDFs para tu nivel:{' '}
              <span className="font-medium" style={{ color: levelColor ?? undefined }}>
                {levelName}
              </span>
            </>
          ) : (
            'PDFs disponibles'
          )}
        </p>
      </div>

      {materials.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm border border-[var(--color-outline-variant)]">
          <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="font-medium text-gray-500">No hay materiales disponibles para tu nivel todavía.</p>
          <p className="mt-1 text-xs text-gray-400">Tu monitor los irá subiendo próximamente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {materials.map(m => (
            <MaterialCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  )
}
