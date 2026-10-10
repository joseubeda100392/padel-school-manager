'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { CircleAlert, CircleCheck, Download, FileUp } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/feedback'

interface Row {
  nombre: string
  email: string
  telefono: string
  nivel: string
  password: string
}

interface Result {
  name?: string
  email: string
  status: 'ok' | 'error'
  password?: string
  warning?: string
  error?: string
}

function detectDelimiter(firstLine: string): string {
  const semicolons = (firstLine.match(/;/g) ?? []).length
  const commas = (firstLine.match(/,/g) ?? []).length
  const tabs = (firstLine.match(/\t/g) ?? []).length
  if (semicolons >= commas && semicolons >= tabs && semicolons > 0) return ';'
  if (tabs >= commas && tabs > 0) return '\t'
  return ','
}

function parseCSV(text: string): string[][] {
  const clean = text.startsWith('﻿') ? text.slice(1) : text
  const firstLine = clean.split(/\r?\n/)[0]
  const delim = detectDelimiter(firstLine)

  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (ch === '"') {
      if (inQuotes && clean[i + 1] === '"') {
        currentField += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === delim && !inQuotes) {
      currentRow.push(currentField)
      currentField = ''
    } else if (ch === '\r' && clean[i + 1] === '\n' && !inQuotes) {
      i++
      currentRow.push(currentField)
      rows.push(currentRow)
      currentRow = []
      currentField = ''
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      currentRow.push(currentField)
      rows.push(currentRow)
      currentRow = []
      currentField = ''
    } else {
      currentField += ch
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField)
    rows.push(currentRow)
  }

  return rows.filter(r => r.some(f => f.trim()))
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['nombre', 'email', 'telefono', 'nivel', 'password'],
    ['María García', 'maria@ejemplo.com', '612345678', 'Iniciación', ''],
    ['Carlos López', 'carlos@ejemplo.com', '', 'Intermedio', 'MiClave123'],
  ])
  ws['!cols'] = [{ wch: 28 }, { wch: 32 }, { wch: 16 }, { wch: 16 }, { wch: 16 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Alumnos')
  XLSX.writeFile(wb, 'plantilla_alumnos.xlsx')
}

export default function ImportStudentsPage() {
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

    if (file.size > 2 * 1024 * 1024) {
      setError('El archivo es demasiado grande (máximo 2 MB)')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        const raw = parseCSV(text)

        if (raw.length < 2) { setError('El archivo está vacío o no tiene datos.'); return }

        const headers = raw[0].map((h) => h.toLowerCase().trim())
        const iNombre = headers.indexOf('nombre')
        const iEmail = headers.indexOf('email')
        const iTelefono = headers.indexOf('telefono')
        const iNivel = headers.indexOf('nivel')
        const iPassword = headers.indexOf('password')

        if (iNombre === -1 || iEmail === -1) {
          setError('El archivo debe tener columnas "nombre" y "email".')
          return
        }

        const parsed: Row[] = raw.slice(1)
          .filter((r) => r[iEmail]?.trim())
          .map((r) => ({
            nombre: (r[iNombre] ?? '').trim(),
            email: (r[iEmail] ?? '').trim(),
            telefono: iTelefono >= 0 ? (r[iTelefono] ?? '').trim() : '',
            nivel: iNivel >= 0 ? (r[iNivel] ?? '').trim() : '',
            password: iPassword >= 0 ? (r[iPassword] ?? '').trim() : '',
          }))

        setRows(parsed)
      } catch {
        setError('No se pudo leer el archivo. Asegúrate de que es un CSV válido.')
      }
    }
    reader.readAsText(file)
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
        const res = await fetch('/api/admin/import-students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: batch }),
        })
        const json = await res.json()
        if (!res.ok) { setError(json.error ?? 'Error al importar'); break }
        allResults.push(...json.results)
        setProgress(p => ({ ...p, done: p.done + batch.length }))
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

  function downloadResults() {
    if (!results) return
    const rows = results.map(r => ({
      Nombre: r.name ?? '',
      Email: r.email,
      Estado: r.status === 'ok' ? 'Creado' : 'Error',
      'Contraseña temporal': r.status === 'ok' ? (r.password ?? '') : '',
      Error: r.status === 'error' ? (r.error ?? '') : '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 28 }, { wch: 32 }, { wch: 10 }, { wch: 20 }, { wch: 36 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Resultado')
    XLSX.writeFile(wb, 'resultado_importacion.xlsx')
  }

  const ok = results?.filter((r) => r.status === 'ok') ?? []
  const errors = results?.filter((r) => r.status === 'error') ?? []

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader title="Importar alumnos" back={{ href: '/dashboard/students', label: 'Usuarios' }} />

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-heading text-ink">1. Descarga la plantilla</h2>
              <p className="mt-1 text-body text-ink-2">
                Rellena el fichero con los datos de los alumnos. Las columnas <strong>nombre</strong> y <strong>email</strong> son obligatorias.
                Si no pones contraseña, se genera una automáticamente.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Columnas de la plantilla">
                <li><Badge tone="neutral">nombre (obligatoria)</Badge></li>
                <li><Badge tone="neutral">email (obligatoria)</Badge></li>
                <li><Badge tone="neutral">telefono</Badge></li>
                <li><Badge tone="neutral">nivel</Badge></li>
                <li><Badge tone="neutral">password</Badge></li>
              </ul>
            </div>
            <Button variant="secondary" onClick={downloadTemplate} className="w-full sm:w-auto">
              <Download className="h-4 w-4" aria-hidden />
              Descargar plantilla Excel
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="mb-3 text-heading text-ink">2. Sube el fichero CSV</h2>
          <label className="flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed border-line-strong/60 px-6 py-10 text-center transition-colors hover:bg-surface-2 focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2">
            <FileUp aria-hidden className="mb-2 h-7 w-7 text-ink-3" />
            <span className="text-label text-ink">Selecciona el archivo CSV</span>
            <span className="mt-1 text-meta text-ink-3">Máximo 2 MB</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={handleFile}
            />
          </label>
          {error && <Notice tone="danger" icon={<CircleAlert />} className="mt-3">{error}</Notice>}
        </CardBody>
      </Card>

      {rows.length > 0 && !results && (
        <Card className="overflow-hidden">
          <CardHeader
            title="3. Confirma los datos"
            description={`${rows.length} alumnos listos para importar`}
            action={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                <Button onClick={handleImport} loading={importing} className="w-full sm:w-auto">
                  {importing ? `Importando ${progress.done}/${progress.total}` : `Importar ${rows.length} alumnos`}
                </Button>
                {importing && (
                  <div
                    role="progressbar"
                    aria-label="Progreso de la importación"
                    aria-valuemin={0}
                    aria-valuemax={progress.total}
                    aria-valuenow={progress.done}
                    className="h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.07] sm:w-48"
                  >
                    <div
                      className="h-1.5 rounded-full bg-accent-ink"
                      style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                    />
                  </div>
                )}
              </div>
            }
          />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[500px] text-body">
              <thead>
                <tr className="bg-surface-2 text-left text-meta font-medium text-ink-3">
                  <th scope="col" className="px-4 py-3">Nombre</th>
                  <th scope="col" className="px-4 py-3">Email</th>
                  <th scope="col" className="px-4 py-3">Teléfono</th>
                  <th scope="col" className="px-4 py-3">Nivel</th>
                  <th scope="col" className="px-4 py-3">Contraseña</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r, i) => (
                  <tr key={i} className={!r.nombre || !r.email ? 'bg-danger-soft' : ''}>
                    <td className="px-4 py-3 text-label text-ink">{r.nombre || <span className="text-danger-ink">Falta el nombre</span>}</td>
                    <td className="px-4 py-3 text-ink-2">{r.email || <span className="text-danger-ink">Falta el email</span>}</td>
                    <td className="px-4 py-3 tabular-nums text-ink-2">{r.telefono || '—'}</td>
                    <td className="px-4 py-3 text-ink-2">{r.nivel || '—'}</td>
                    <td className="px-4 py-3 text-ink-3">{r.password || <span className="italic">Automática</span>}</td>
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
            title="Resultado de la importación"
            description={
              <span className="flex flex-wrap gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1 text-accent-ink">
                  <CircleCheck className="h-4 w-4" aria-hidden />
                  {ok.length} creados
                </span>
                {errors.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-danger-ink">
                    <CircleAlert className="h-4 w-4" aria-hidden />
                    {errors.length} con error
                  </span>
                )}
              </span>
            }
            action={
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <Button variant="secondary" onClick={downloadResults}>
                  <Download className="h-4 w-4" aria-hidden />
                  Descargar resultado
                </Button>
                <Button onClick={() => { router.refresh(); router.push('/dashboard/students') }}>
                  Ver usuarios
                </Button>
              </div>
            }
          />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[500px] text-body">
              <thead>
                <tr className="bg-surface-2 text-left text-meta font-medium text-ink-3">
                  <th scope="col" className="px-4 py-3">Nombre</th>
                  <th scope="col" className="px-4 py-3">Email</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                  <th scope="col" className="px-4 py-3">Contraseña o error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {results.map((r, i) => (
                  <tr key={i} className={r.status === 'error' ? 'bg-danger-soft' : ''}>
                    <td className="px-4 py-3 text-label text-ink">{r.name ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-2">{r.email}</td>
                    <td className="px-4 py-3">
                      {r.status === 'ok' ? (
                        <Badge tone="success"><CircleCheck className="h-3.5 w-3.5" aria-hidden />Creado</Badge>
                      ) : (
                        <Badge tone="danger"><CircleAlert className="h-3.5 w-3.5" aria-hidden />Error</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'ok'
                        ? <span className="rounded bg-ink/[0.06] px-2 py-0.5 font-mono text-meta text-ink">{r.password}</span>
                        : <span className="text-meta text-danger-ink">{r.error}</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
