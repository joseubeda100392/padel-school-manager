'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { FileSpreadsheet, CircleCheck, CircleX, Minus } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import * as XLSX from 'xlsx'
import { formatTime } from '@/lib/utils'

interface Row {
  pista: string
  monitor: string
  nivel: string
  dia: string
  start_time: string
  end_time: string
  recurrence: 'none' | 'weekly' | 'biweekly'
  recurrence_end_date: string | null
  max_students: number
  type: 'regular' | 'intensivo'
  price_cents: number | null
  court_id?: string
  coach_id?: string
  level_id?: string
}

interface Result {
  row: number
  status: 'ok' | 'skipped' | 'error'
  label: string
  error?: string
}

const RECURRENCE_FROM_LABEL: Record<string, Row['recurrence']> = {
  'ninguna (clase suelta)': 'none',
  'semanal': 'weekly',
  'quincenal': 'biweekly',
}

function toRecurrence(label: string): Row['recurrence'] {
  return RECURRENCE_FROM_LABEL[label.toLowerCase().trim()] ?? 'weekly'
}

export default function RestoreSchedulePage() {
  const [rows, setRows] = useState<Row[]>([])
  const [results, setResults] = useState<Result[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const BATCH_SIZE = 50

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError('')
    setResults(null)
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError('El archivo es demasiado grande (máximo 5 MB)')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result as ArrayBuffer
        const wb = XLSX.read(data, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const raw: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        if (raw.length === 0) { setError('El archivo está vacío.'); return }

        const parsed: Row[] = raw
          .filter((r) => r['Pista'] && r['Monitor'])
          .map((r) => ({
            pista: String(r['Pista'] ?? '').trim(),
            monitor: String(r['Monitor'] ?? '').trim(),
            nivel: String(r['Nivel'] ?? '').trim(),
            dia: String(r['Día'] ?? '').trim(),
            start_time: String(r['start_time'] ?? '').trim(),
            end_time: String(r['end_time'] ?? '').trim(),
            recurrence: toRecurrence(String(r['Recurrencia'] ?? '')),
            recurrence_end_date: String(r['Fin recurrencia'] ?? '').trim() || null,
            max_students: Number(r['Plazas máx']) || 4,
            type: String(r['Tipo'] ?? '').toLowerCase().includes('intensivo') ? 'intensivo' : 'regular',
            price_cents: r['Precio (€)'] ? Math.round(Number(r['Precio (€)']) * 100) : null,
            court_id: String(r['court_id'] ?? '').trim() || undefined,
            coach_id: String(r['coach_id'] ?? '').trim() || undefined,
            level_id: String(r['level_id'] ?? '').trim() || undefined,
          }))

        if (parsed.length === 0) {
          setError('No se encontraron filas válidas. ¿Es el Excel exportado desde «Descargar Excel»?')
          return
        }
        if (!parsed.some((r) => r.start_time)) {
          setError('El archivo no tiene las columnas de hora exacta (start_time/end_time) — usa el Excel tal y como se descargó, sin borrar columnas.')
          return
        }

        setRows(parsed)
      } catch {
        setError('No se pudo leer el archivo. Asegúrate de que es el .xlsx exportado desde «Descargar Excel».')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    setImporting(true)
    setError('')
    setProgress({ done: 0, total: rows.length })

    const allResults: Result[] = []
    const batches: Row[][] = []
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      batches.push(rows.slice(i, i + BATCH_SIZE))
    }

    try {
      for (const batch of batches) {
        const res = await fetch('/api/admin/import-schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: batch }),
        })
        const json = await res.json()
        if (!res.ok) { setError(json.error ?? 'Error al restaurar'); break }
        allResults.push(...json.results)
        setProgress((p) => ({ ...p, done: p.done + batch.length }))
      }
    } catch {
      setError('No se pudo conectar con el servidor.')
    }

    if (allResults.length > 0) {
      setResults(allResults)
      setRows([])
      if (fileRef.current) fileRef.current.value = ''
    }
    setImporting(false)
  }

  const ok = results?.filter((r) => r.status === 'ok') ?? []
  const skipped = results?.filter((r) => r.status === 'skipped') ?? []
  const errors = results?.filter((r) => r.status === 'error') ?? []

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader back={{ href: '/dashboard/schedule/master', label: 'Calendario maestro' }} title="Restaurar calendario" />

      <Card>
        <CardHeader
          title="Cómo funciona"
          description={
            <>
              Sube el mismo fichero <strong className="font-medium text-ink-2">.xlsx</strong> que descargaste con «Descargar Excel» en el calendario maestro.
              Las clases que ya existan de forma idéntica se saltan automáticamente, sin duplicarse.
            </>
          }
        />
        <CardBody>
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-control border-2 border-dashed border-line-strong/60 px-6 py-10 text-center transition-colors hover:border-accent-ink hover:bg-accent-soft focus-within:border-accent-ink">
            <FileSpreadsheet className="mb-2 h-8 w-8 text-ink-3" aria-hidden />
            <span className="text-label text-ink">Seleccionar el archivo Excel</span>
            <span className="mt-1 text-meta text-ink-3">Formato .xlsx, máximo 5 MB</span>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="sr-only"
              onChange={handleFile}
            />
          </label>
          {error && <p role="alert" className="mt-3 text-meta font-medium text-danger-ink">{error}</p>}
        </CardBody>
      </Card>

      {rows.length > 0 && !results && (
        <Card className="overflow-hidden">
          <CardHeader
            title="Confirma los datos"
            description={`${rows.length} clases listas para restaurar`}
            action={
              <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                <Button onClick={handleImport} loading={importing} className="w-full sm:w-auto">
                  {importing ? `Restaurando ${progress.done}/${progress.total}` : `Restaurar ${rows.length} clases`}
                </Button>
                {importing && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.06] sm:w-48">
                    <div
                      className="h-1.5 rounded-full bg-accent-ink transition-all"
                      style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                    />
                  </div>
                )}
              </div>
            }
          />
          <div className="mt-4 overflow-x-auto border-t border-line">
            <table className="w-full min-w-[600px] text-body">
              <thead>
                <tr className="bg-surface-2">
                  <th className="px-4 py-3 text-left text-meta font-medium text-ink-3">Pista</th>
                  <th className="px-4 py-3 text-left text-meta font-medium text-ink-3">Monitor</th>
                  <th className="px-4 py-3 text-left text-meta font-medium text-ink-3">Nivel</th>
                  <th className="px-4 py-3 text-left text-meta font-medium text-ink-3">Día</th>
                  <th className="px-4 py-3 text-left text-meta font-medium text-ink-3">Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 text-label text-ink">{r.pista}</td>
                    <td className="px-4 py-3 text-ink-2">{r.monitor}</td>
                    <td className="px-4 py-3 text-ink-3">{r.nivel || '—'}</td>
                    <td className="px-4 py-3 text-ink-3">{r.dia}</td>
                    <td className="px-4 py-3 tabular-nums text-ink-3">
                      {r.start_time ? formatTime(r.start_time) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {results && (
        <Card className="overflow-hidden">
          <CardHeader
            title="Resultado"
            description={
              <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-body">
                <span className="inline-flex items-center gap-1 text-accent-ink"><CircleCheck className="h-4 w-4" aria-hidden />{ok.length} creadas</span>
                {skipped.length > 0 && <span className="inline-flex items-center gap-1 text-ink-3"><Minus className="h-4 w-4" aria-hidden />{skipped.length} ya existían</span>}
                {errors.length > 0 && <span className="inline-flex items-center gap-1 text-danger-ink"><CircleX className="h-4 w-4" aria-hidden />{errors.length} con error</span>}
              </span>
            }
          />
          <div className="mt-4 overflow-x-auto border-t border-line">
            <table className="w-full min-w-[500px] text-body">
              <thead>
                <tr className="bg-surface-2">
                  <th className="px-4 py-3 text-left text-meta font-medium text-ink-3">Clase</th>
                  <th className="px-4 py-3 text-left text-meta font-medium text-ink-3">Estado</th>
                  <th className="px-4 py-3 text-left text-meta font-medium text-ink-3">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {results.map((r, i) => (
                  <tr key={i} className={r.status === 'error' ? 'bg-danger-soft' : undefined}>
                    <td className="px-4 py-3 text-ink-2">{r.label}</td>
                    <td className="px-4 py-3">
                      <Badge tone={r.status === 'ok' ? 'success' : r.status === 'skipped' ? 'neutral' : 'danger'}>
                        {r.status === 'ok' ? <CircleCheck className="h-3.5 w-3.5" aria-hidden /> : r.status === 'skipped' ? <Minus className="h-3.5 w-3.5" aria-hidden /> : <CircleX className="h-3.5 w-3.5" aria-hidden />}
                        {r.status === 'ok' ? 'Creada' : r.status === 'skipped' ? 'Ya existía' : 'Error'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-meta text-ink-3">{r.error ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-4 py-4 sm:px-5">
            <Button
              onClick={() => { router.refresh(); router.push('/dashboard/schedule/master') }}
              className="w-full sm:w-auto"
            >
              Ver calendario
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
