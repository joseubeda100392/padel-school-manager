import { describe, it, expect } from 'vitest'
import { carriedOverPaidUntil, type CarryoverPayment } from '@/lib/enrollment-carryover'

const pay = (amount: number, created_at: string, paid_until?: string, advance?: boolean): CarryoverPayment => ({
  amount,
  created_at,
  metadata: { ...(paid_until ? { paid_until } : {}), ...(advance ? { advance } : {}) },
})

const OCT_PAYMENT = pay(8000, '2026-10-08T18:47:00Z', '2026-10-31')

describe('carriedOverPaidUntil', () => {
  it('dobla clase: el pago del mes ya está gastado en su otro grupo, el nuevo queda pendiente (caso Laura Casillas)', () => {
    expect(carriedOverPaidUntil({ payments: [OCT_PAYMENT], otherActivePaidUntil: ['2026-10-31'], monthlyPrice: 8000, currentMonth: '2026-10' })).toBeNull()
  })

  it('cambia de grupo (ya quitado del viejo): el pago pasa al grupo nuevo', () => {
    expect(carriedOverPaidUntil({ payments: [OCT_PAYMENT], otherActivePaidUntil: [], monthlyPrice: 8000, currentMonth: '2026-10' })).toBe('2026-10-31')
  })

  it('pasa a dos grupos nuevos con un solo pago: solo el primero queda pagado', () => {
    const first = carriedOverPaidUntil({ payments: [OCT_PAYMENT], otherActivePaidUntil: [], monthlyPrice: 8000, currentMonth: '2026-10' })
    expect(first).toBe('2026-10-31')
    expect(carriedOverPaidUntil({ payments: [OCT_PAYMENT], otherActivePaidUntil: [first], monthlyPrice: 8000, currentMonth: '2026-10' })).toBeNull()
  })

  it('dobla clase pero ya pagó los dos grupos este mes: el nuevo queda pagado', () => {
    const second = pay(8000, '2026-10-10T10:00:00Z', '2026-10-31')
    expect(carriedOverPaidUntil({ payments: [OCT_PAYMENT, second], otherActivePaidUntil: ['2026-10-31'], monthlyPrice: 8000, currentMonth: '2026-10' })).toBe('2026-10-31')
  })

  it('grupo nuevo más caro que lo pagado: pendiente', () => {
    expect(carriedOverPaidUntil({ payments: [pay(6000, '2026-10-06T10:00:00Z', '2026-10-31')], otherActivePaidUntil: [], monthlyPrice: 8000, currentMonth: '2026-10' })).toBeNull()
  })

  it('cambio de grupo con noviembre adelantado: se trasladan octubre y noviembre', () => {
    const nov = pay(8000, '2026-10-20T10:00:00Z', '2026-11-30')
    expect(carriedOverPaidUntil({ payments: [OCT_PAYMENT, nov], otherActivePaidUntil: [], monthlyPrice: 8000, currentMonth: '2026-10' })).toBe('2026-11-30')
  })

  it('adelanto de octubre pagado en septiembre: cuenta para octubre', () => {
    const advancedInSept = pay(8000, '2026-09-25T10:00:00Z', '2026-10-31')
    expect(carriedOverPaidUntil({ payments: [advancedInSept], otherActivePaidUntil: [], monthlyPrice: 8000, currentMonth: '2026-10' })).toBe('2026-10-31')
  })

  it('pago atrasado de septiembre hecho en octubre: no cubre octubre', () => {
    const lateSept = pay(8000, '2026-10-03T10:00:00Z', '2026-09-30')
    expect(carriedOverPaidUntil({ payments: [lateSept], otherActivePaidUntil: [], monthlyPrice: 8000, currentMonth: '2026-10' })).toBeNull()
  })

  it('pago antiguo sin mes guardado: cubre el mes en que se cobró (hora de Madrid)', () => {
    const legacy = pay(8000, '2026-09-30T23:30:00Z')
    expect(carriedOverPaidUntil({ payments: [legacy], otherActivePaidUntil: [], monthlyPrice: 8000, currentMonth: '2026-10' })).toBe('2026-10-31')
  })

  it('adelanto antiguo sin mes guardado: cubre el mes siguiente, no el actual', () => {
    const legacyAdvance = pay(8000, '2026-10-29T10:00:00Z', undefined, true)
    expect(carriedOverPaidUntil({ payments: [legacyAdvance], otherActivePaidUntil: [], monthlyPrice: 8000, currentMonth: '2026-10' })).toBeNull()
  })

  it('su otro grupo tiene noviembre adelantado y solo hay esos pagos: el nuevo queda pendiente', () => {
    const nov = pay(8000, '2026-10-20T10:00:00Z', '2026-11-30')
    expect(carriedOverPaidUntil({ payments: [OCT_PAYMENT, nov], otherActivePaidUntil: ['2026-11-30'], monthlyPrice: 8000, currentMonth: '2026-10' })).toBeNull()
  })

  it('sin pagos: pendiente', () => {
    expect(carriedOverPaidUntil({ payments: [], otherActivePaidUntil: [], monthlyPrice: 8000, currentMonth: '2026-10' })).toBeNull()
  })

  it('cambio de año: diciembre y enero adelantado', () => {
    const dec = pay(8000, '2026-12-02T10:00:00Z', '2026-12-31')
    const jan = pay(8000, '2026-12-15T10:00:00Z', '2027-01-31')
    expect(carriedOverPaidUntil({ payments: [dec, jan], otherActivePaidUntil: [], monthlyPrice: 8000, currentMonth: '2026-12' })).toBe('2027-01-31')
  })
})
