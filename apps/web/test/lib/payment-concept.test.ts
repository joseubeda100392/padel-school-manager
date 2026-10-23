import { describe, it, expect } from 'vitest'
import { paymentConcept, paymentStatus } from '@/lib/payment-concept'

const pay = (type: string, metadata: Record<string, unknown> = {}) => ({ type, created_at: '2026-10-05T10:00:00Z', metadata })

describe('paymentConcept', () => {
  it('la cuota dice el mes que cubre', () => {
    expect(paymentConcept(pay('fixed_group_month', { paid_until: '2026-10-31', method: 'cash' }))).toEqual({ title: 'Cuota de octubre 2026', detail: null })
  })

  it('un adelanto es la cuota del mes adelantado', () => {
    expect(paymentConcept(pay('fixed_group_month', { paid_until: '2026-11-30', advance: true }))).toEqual({ title: 'Cuota de noviembre 2026', detail: 'Adelantada' })
  })

  it('pago de varios grupos: meses distintos y número de grupos', () => {
    expect(paymentConcept(pay('fixed_group_month', { items: [{ paid_until: '2026-09-30' }, { paid_until: '2026-10-31' }] })))
      .toEqual({ title: 'Cuota de septiembre y octubre 2026', detail: '2 grupos' })
  })

  it('meses de años distintos', () => {
    expect(paymentConcept(pay('fixed_group_month', { items: [{ paid_until: '2026-12-31' }, { paid_until: '2027-01-31' }] })).title)
      .toBe('Cuota de diciembre 2026 y enero 2027')
  })

  it('cuota antigua sin mes guardado', () => {
    expect(paymentConcept(pay('fixed_group_month', {})).title).toBe('Cuota mensual')
  })

  it('pago automático', () => {
    expect(paymentConcept(pay('mandate_charge', { paid_until: '2026-10-31' }))).toEqual({ title: 'Cuota de octubre 2026', detail: 'Pago automático' })
  })

  it('cargo suelto con su concepto', () => {
    expect(paymentConcept(pay('manual_charge', { concept: 'Cuota de octubre (grupo martes)' }))).toEqual({ title: 'Cargo suelto', detail: 'Cuota de octubre (grupo martes)' })
  })

  it('bono y clase suelta', () => {
    expect(paymentConcept(pay('class_pack', { classes_per_pack: 10, pack_type: '90' }))).toEqual({ title: 'Bono de clases', detail: '10 clases de 1 h 30' })
    expect(paymentConcept(pay('single_class', { class_date: '2026-10-14' }))).toEqual({ title: 'Clase suelta', detail: '14 de octubre 2026' })
  })

  it('pago con tarjeta que no se terminó', () => {
    expect(paymentConcept({ ...pay('fixed_group_month', {}), status: 'pending' }).title).toBe('Pago con tarjeta sin terminar')
    expect(paymentConcept({ ...pay('fixed_group_month', {}), status: 'failed' }).title).toBe('Pago con tarjeta rechazado')
    expect(paymentConcept({ ...pay('fixed_group_month', { paid_until: '2026-10-31' }), status: 'succeeded' }).title).toBe('Cuota de octubre 2026')
  })
})

describe('paymentStatus', () => {
  const now = Date.parse('2026-10-23T12:00:00Z')
  it('un pendiente reciente está en curso y uno viejo sin terminar', () => {
    expect(paymentStatus({ status: 'pending', created_at: '2026-10-23T11:30:00Z' }, now).label).toBe('En curso')
    expect(paymentStatus({ status: 'pending', created_at: '2026-10-14T10:00:00Z' }, now).label).toBe('Sin terminar')
  })
  it('cobrado y fallido', () => {
    expect(paymentStatus({ status: 'succeeded', created_at: '' }).label).toBe('Cobrado')
    expect(paymentStatus({ status: 'failed', created_at: '' }).label).toBe('Fallido')
  })
})
