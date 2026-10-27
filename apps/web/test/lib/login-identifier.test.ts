import { describe, it, expect } from 'vitest'
import { normalizePhone, parseLoginIdentifier, placeholderEmailFor, isPlaceholderEmail, phoneSearchPattern } from '@/lib/login-identifier'

describe('normalizePhone', () => {
  it('deja 9 cifras aunque venga con espacios, guiones o prefijo', () => {
    expect(normalizePhone('649 44 26 01')).toBe('649442601')
    expect(normalizePhone('+34 649-44-26-01')).toBe('649442601')
    expect(normalizePhone('0034649442601')).toBe('649442601')
    expect(normalizePhone('34649442601')).toBe('649442601')
  })
  it('rechaza lo que no es un teléfono español', () => {
    expect(normalizePhone('12345')).toBeNull()
    expect(normalizePhone('149442601')).toBeNull()
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
  })
})

describe('parseLoginIdentifier', () => {
  it('con @ es email, en minúsculas', () => {
    expect(parseLoginIdentifier('  Ana@Gmail.com ')).toEqual({ kind: 'email', email: 'ana@gmail.com' })
  })
  it('sin @ y con 9 cifras es teléfono', () => {
    expect(parseLoginIdentifier('682 264 588')).toEqual({ kind: 'phone', phone: '682264588' })
  })
  it('ni email ni teléfono válido', () => {
    expect(parseLoginIdentifier('sergio')).toBeNull()
  })
})

describe('email interno de quien no tiene email', () => {
  it('se forma con el teléfono y se reconoce', () => {
    const email = placeholderEmailFor('+34 605 799 582')
    expect(email).toBe('605799582@sin-email.epadelschool.app')
    expect(isPlaceholderEmail(email)).toBe(true)
    expect(isPlaceholderEmail('ana@gmail.com')).toBe(false)
    expect(placeholderEmailFor('abc')).toBeNull()
  })
})

describe('phoneSearchPattern', () => {
  it('admite cualquier separador entre cifras', () => {
    expect(phoneSearchPattern('649442601')).toBe('%6%4%9%4%4%2%6%0%1')
  })
})
