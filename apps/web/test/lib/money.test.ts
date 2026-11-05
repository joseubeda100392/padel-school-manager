import { describe, it, expect } from 'vitest'
import { centsToEurosText, eurosToCents } from '@/lib/money'

describe('eurosToCents', () => {
  it('acepta coma y punto', () => {
    expect(eurosToCents('46,5')).toBe(4650)
    expect(eurosToCents('46.50')).toBe(4650)
    expect(eurosToCents(' 60 ')).toBe(6000)
  })

  it('a medio escribir con coma no falla', () => {
    expect(eurosToCents('46,')).toBe(4600)
  })

  it('null si está vacío, no es un número o es negativo', () => {
    expect(eurosToCents('')).toBeNull()
    expect(eurosToCents('abc')).toBeNull()
    expect(eurosToCents('-5')).toBeNull()
  })
})

describe('centsToEurosText', () => {
  it('con coma y sin ,00', () => {
    expect(centsToEurosText(4650)).toBe('46,50')
    expect(centsToEurosText(6000)).toBe('60')
  })
})
