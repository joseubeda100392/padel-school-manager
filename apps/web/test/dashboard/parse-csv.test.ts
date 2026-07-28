import { describe, it, expect } from 'vitest'

// Mirrors implementation in apps/web/app/dashboard/students/import/page.tsx
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
      if (inQuotes && clean[i + 1] === '"') { currentField += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === delim && !inQuotes) {
      currentRow.push(currentField); currentField = ''
    } else if (ch === '\r' && clean[i + 1] === '\n' && !inQuotes) {
      i++; currentRow.push(currentField); rows.push(currentRow); currentRow = []; currentField = ''
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      currentRow.push(currentField); rows.push(currentRow); currentRow = []; currentField = ''
    } else {
      currentField += ch
    }
  }
  if (currentField || currentRow.length > 0) { currentRow.push(currentField); rows.push(currentRow) }
  return rows.filter(r => r.some(f => f.trim()))
}

describe('parseCSV', () => {
  it('parses a basic CSV with header and one data row', () => {
    const csv = 'nombre,email\nMaría,maria@test.com'
    const result = parseCSV(csv)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(['nombre', 'email'])
    expect(result[1]).toEqual(['María', 'maria@test.com'])
  })

  it('handles Windows CRLF line endings', () => {
    const csv = 'nombre,email\r\nCarlos,carlos@test.com\r\n'
    const result = parseCSV(csv)
    expect(result).toHaveLength(2)
    expect(result[1][1]).toBe('carlos@test.com')
  })

  it('handles quoted fields containing commas', () => {
    const csv = 'nombre,email\n"García, María",maria@test.com'
    const result = parseCSV(csv)
    expect(result[1][0]).toBe('García, María')
    expect(result[1][1]).toBe('maria@test.com')
  })

  it('handles escaped double quotes inside quoted fields', () => {
    const csv = 'nombre,nota\n"dijo ""hola""",ok'
    const result = parseCSV(csv)
    expect(result[1][0]).toBe('dijo "hola"')
  })

  it('skips fully empty lines', () => {
    const csv = 'nombre,email\n\nMaría,maria@test.com\n\n'
    const result = parseCSV(csv)
    expect(result).toHaveLength(2)
  })

  it('returns empty array for empty input', () => {
    expect(parseCSV('')).toHaveLength(0)
    expect(parseCSV('   \n  \n')).toHaveLength(0)
  })

  it('parses all five expected columns', () => {
    const csv = 'nombre,email,telefono,nivel,password\nAna,ana@test.com,612345678,Iniciación,clave123'
    const result = parseCSV(csv)
    expect(result[1]).toEqual(['Ana', 'ana@test.com', '612345678', 'Iniciación', 'clave123'])
  })

  it('auto-detects semicolon delimiter (Spanish Excel export)', () => {
    const csv = 'nombre;email;telefono;nivel;password\nAna;ana@test.com;612345678;Iniciación;clave123'
    const result = parseCSV(csv)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(['nombre', 'email', 'telefono', 'nivel', 'password'])
    expect(result[1]).toEqual(['Ana', 'ana@test.com', '612345678', 'Iniciación', 'clave123'])
  })

  it('strips UTF-8 BOM added by Excel', () => {
    const csv = '﻿nombre,email\nAna,ana@test.com'
    const result = parseCSV(csv)
    expect(result[0][0]).toBe('nombre')
    expect(result[1]).toEqual(['Ana', 'ana@test.com'])
  })

  it('handles semicolons with CRLF (Spanish Excel typical export)', () => {
    const csv = 'nombre;email;telefono\r\nAdrian Carpintero;carpingeta24@gmail.com;+34 658552865\r\nADRIAN GARCIA;hachese@gmail.com;670022149\r\n'
    const result = parseCSV(csv)
    expect(result).toHaveLength(3)
    expect(result[1][0]).toBe('Adrian Carpintero')
    expect(result[1][1]).toBe('carpingeta24@gmail.com')
    expect(result[2][0]).toBe('ADRIAN GARCIA')
  })
})
