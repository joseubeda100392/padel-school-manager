'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'

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
  error?: string
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['nombre', 'email', 'telefono', 'nivel', 'password'],
    ['María García', 'maria@ejemplo.com', '612345678', 'Iniciación', ''],
    ['Carlos López', 'carlos@ejemplo.com', '', 'Intermedio', 'MiClave123'],
  ])
  ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Alumnos')
  XLSX.writeFile(wb, 'plantilla_alumnos.xlsx')
}

export default function ImportStudentsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [results, setResults] = useState<Result[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError('')
    setResults(null)
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        if (raw.length < 2) { setError('El archivo está vacío o no tiene datos.'); return }

        const headers = (raw[0] as string[]).map((h) => String(h).toLowerCase().trim())
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
          .filter((r) => r[iEmail]?.toString().trim())
          .map((r) => ({
            nombre: String(r[iNombre] ?? '').trim(),
            email: String(r[iEmail] ?? '').trim(),
            telefono: iTelefono >= 0 ? String(r[iTelefono] ?? '').trim() : '',
            nivel: iNivel >= 0 ? String(r[iNivel] ?? '').trim() : '',
            password: iPassword >= 0 ? String(r[iPassword] ?? '').trim() : '',
          }))

        setRows(parsed)
      } catch {
        setError('No se pudo leer el archivo. Asegúrate de que es un Excel o CSV válido.')
      }
    }
    reader.readAsBinaryString(file)
  }

  async function handleImport() {
    setImporting(true)
    setError('')
    try {
      const res = await fetch('/api/admin/import-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al importar'); setImporting(false); return }
      setResults(json.results)
      setRows([])
      if (fileRef.current) fileRef.current.value = ''
    } catch {
      setError('No se pudo conectar con el servidor.')
    }
    setImporting(false)
  }

  function downloadResults() {
    if (!results) return
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nombre', 'Email', 'Estado', 'Contraseña temporal', 'Error'],
      ...results.map((r) => [
        r.name ?? '', r.email,
        r.status === 'ok' ? 'Creado' : 'Error',
        r.password ?? '',
        r.error ?? '',
      ]),
    ])
    ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 10 }, { wch: 18 }, { wch: 30 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Resultado')
    XLSX.writeFile(wb, 'resultado_importacion.xlsx')
  }

  const ok = results?.filter((r) => r.status === 'ok') ?? []
  const errors = results?.filter((r) => r.status === 'error') ?? []

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <a href="/dashboard/students" className="text-sm text-gray-500 hover:text-gray-700">← Alumnos</a>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Importar alumnos</h1>
      </div>

      {/* Paso 1: Plantilla */}
      <div className="mb-4 rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-900">1. Descarga la plantilla</h2>
            <p className="mt-1 text-sm text-gray-500">
              Rellena el Excel con los datos de los alumnos. Las columnas <strong>nombre</strong> y <strong>email</strong> son obligatorias.
              Si no pones contraseña, se genera una automáticamente.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-400">
              <span className="rounded-full bg-gray-100 px-3 py-1">nombre <span className="text-red-500">*</span></span>
              <span className="rounded-full bg-gray-100 px-3 py-1">email <span className="text-red-500">*</span></span>
              <span className="rounded-full bg-gray-100 px-3 py-1">telefono</span>
              <span className="rounded-full bg-gray-100 px-3 py-1">nivel</span>
              <span className="rounded-full bg-gray-100 px-3 py-1">password</span>
            </div>
          </div>
          <button
            onClick={downloadTemplate}
            className="shrink-0 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
          >
            ↓ Plantilla Excel
          </button>
        </div>
      </div>

      {/* Paso 2: Subir fichero */}
      <div className="mb-4 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-900">2. Sube el fichero rellenado</h2>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 px-6 py-10 transition hover:border-green-400 hover:bg-green-50">
          <span className="text-3xl mb-2">📂</span>
          <span className="text-sm font-medium text-gray-700">Haz clic para seleccionar el archivo</span>
          <span className="mt-1 text-xs text-gray-400">.xlsx, .xls o .csv</span>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFile}
          />
        </label>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      </div>

      {/* Preview */}
      {rows.length > 0 && !results && (
        <div className="mb-4 rounded-xl bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="font-semibold text-gray-900">3. Confirma los datos</h2>
              <p className="text-sm text-gray-500">{rows.length} alumnos listos para importar</p>
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 sm:w-auto"
            >
              {importing ? 'Importando...' : `Importar ${rows.length} alumnos`}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Teléfono</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Nivel</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Contraseña</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r, i) => (
                  <tr key={i} className={!r.nombre || !r.email ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.nombre || <span className="text-red-500">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{r.email || <span className="text-red-500">—</span>}</td>
                    <td className="px-4 py-3 text-gray-500">{r.telefono || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{r.nivel || '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{r.password || <span className="italic">Auto</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resultados */}
      {results && (
        <div className="rounded-xl bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="font-semibold text-gray-900">Resultado de la importación</h2>
              <div className="mt-1 flex gap-4 text-sm">
                <span className="text-green-700">✓ {ok.length} creados</span>
                {errors.length > 0 && <span className="text-red-600">✗ {errors.length} errores</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={downloadResults}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                ↓ Descargar resultado
              </button>
              <a href="/dashboard/students" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                Ver alumnos
              </a>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Contraseña / Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results.map((r, i) => (
                  <tr key={i} className={r.status === 'error' ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{r.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${r.status === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {r.status === 'ok' ? '✓ Creado' : '✗ Error'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'ok'
                        ? <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">{r.password}</span>
                        : <span className="text-xs text-red-600">{r.error}</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
