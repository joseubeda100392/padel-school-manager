'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
          setError('No se encontraron filas válidas. ¿Es el Excel exportado desde "↓ Descargar Excel"?')
          return
        }
        if (!parsed.some((r) => r.start_time)) {
          setError('El archivo no tiene las columnas de hora exacta (start_time/end_time) — usa el Excel tal y como se descargó, sin borrar columnas.')
          return
        }

        setRows(parsed)
      } catch {
        setError('No se pudo leer el archivo. Asegúrate de que es el .xlsx exportado desde "↓ Descargar Excel".')
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
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/schedule" className="text-sm text-gray-500 hover:text-gray-700">← Clases</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Restaurar calendario</h1>
      </div>

      <div className="mb-4 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-2 font-semibold text-gray-900">Cómo funciona</h2>
        <p className="text-sm text-gray-500">
          Sube el mismo fichero <strong>.xlsx</strong> que descargaste con "↓ Descargar Excel" en la pantalla de Clases.
          Las clases que ya existan de forma idéntica se saltan automáticamente, sin duplicarse.
        </p>
      </div>

      <div className="mb-4 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-900">Sube el fichero Excel</h2>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 px-6 py-10 transition hover:border-green-400 hover:bg-brand-50">
          <span className="text-3xl mb-2">📂</span>
          <span className="text-sm font-medium text-gray-700">Haz clic para seleccionar el archivo</span>
          <span className="mt-1 text-xs text-gray-400">.xlsx</span>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleFile}
          />
        </label>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      </div>

      {rows.length > 0 && !results && (
        <div className="mb-4 rounded-xl bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="font-semibold text-gray-900">Confirma los datos</h2>
              <p className="text-sm text-gray-500">{rows.length} clases listas para restaurar</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60 sm:w-auto"
              >
                {importing ? `Restaurando... ${progress.done}/${progress.total}` : `Restaurar ${rows.length} clases`}
              </button>
              {importing && (
                <div className="h-1.5 w-48 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-1.5 rounded-full bg-brand-500 transition-all"
                    style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Pista</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Monitor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Nivel</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Día</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.pista}</td>
                    <td className="px-4 py-3 text-gray-600">{r.monitor}</td>
                    <td className="px-4 py-3 text-gray-500">{r.nivel || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{r.dia}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {r.start_time ? formatTime(r.start_time) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results && (
        <div className="rounded-xl bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Resultado</h2>
            <div className="mt-1 flex flex-wrap gap-4 text-sm">
              <span className="text-brand-600">✓ {ok.length} creadas</span>
              {skipped.length > 0 && <span className="text-gray-500">— {skipped.length} ya existían</span>}
              {errors.length > 0 && <span className="text-red-600">✗ {errors.length} errores</span>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Clase</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results.map((r, i) => (
                  <tr key={i} className={r.status === 'error' ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 text-gray-600">{r.label}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        r.status === 'ok' ? 'bg-brand-100 text-brand-600' : r.status === 'skipped' ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-700'
                      }`}>
                        {r.status === 'ok' ? '✓ Creada' : r.status === 'skipped' ? '— Ya existía' : '✗ Error'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.error ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
            <button
              onClick={() => { router.refresh(); router.push('/dashboard/schedule') }}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              Ver calendario
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
