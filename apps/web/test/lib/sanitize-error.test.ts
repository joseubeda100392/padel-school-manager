import { describe, it, expect } from 'vitest'
import { sanitizeDbError } from '@/lib/sanitize-error'

describe('sanitizeDbError', () => {
  it('returns generic message when error is null', () => {
    expect(sanitizeDbError(null)).toBe('Error interno del servidor')
  })

  it('returns generic message when error is undefined', () => {
    expect(sanitizeDbError(undefined)).toBe('Error interno del servidor')
  })

  it('returns duplicate message for code 23505', () => {
    expect(sanitizeDbError({ code: '23505' })).toBe('Ya existe un registro con esos datos')
  })

  it('returns FK violation message for code 23503', () => {
    expect(sanitizeDbError({ code: '23503' })).toBe('Referencia no válida')
  })

  it('returns not-null violation message for code 23502', () => {
    expect(sanitizeDbError({ code: '23502' })).toBe('Faltan datos requeridos')
  })

  it('never exposes raw DB error message', () => {
    const result = sanitizeDbError({ message: 'relation "users" does not exist', code: '42P01' })
    expect(result).not.toContain('relation')
    expect(result).not.toContain('users')
    expect(result).toBe('Error interno del servidor')
  })
})
