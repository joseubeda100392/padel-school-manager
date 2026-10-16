import { describe, it, expect } from 'vitest'
import { planMandateItems, nextChargeDate, type MandateEnrollment } from '@/lib/mandate-charge'

const enr = (id: string, price: number, paid_until: string | null, start_date = '2026-09-01', extra: Partial<MandateEnrollment> = {}): MandateEnrollment => ({
  id, monthly_price: price, paid_until, start_date, price_per_class_cents: null, discount_classes_pending: 0, ...extra,
})
const plan = (enrollments: MandateEnrollment[], mode: 'init' | 'monthly', classValidation = false) =>
  planMandateItems({ enrollments, mode, currentMonth: '2026-10', classValidation })

describe('planMandateItems: cobro mensual', () => {
  it('alumno en dos grupos (caso Laura): cobra los dos y cada uno avanza su mes', () => {
    const items = plan([enr('miercoles', 8000, '2026-09-30'), enr('lunes', 4000, null, '2026-10-01')], 'monthly')
    expect(items).toEqual([
      { enrollment_id: 'miercoles', amount: 8000, paid_until: '2026-10-31', discount_cents: 0 },
      { enrollment_id: 'lunes', amount: 4000, paid_until: '2026-10-31', discount_cents: 0 },
    ])
    expect(items.reduce((s, i) => s + i.amount, 0)).toBe(12000)
  })

  it('un grupo ya pagado en efectivo este mes: solo se cobra el otro', () => {
    const items = plan([enr('pagado', 8000, '2026-10-31'), enr('debe', 4000, '2026-09-30')], 'monthly')
    expect(items.map(i => i.enrollment_id)).toEqual(['debe'])
  })

  it('mes siguiente adelantado: no se cobra nada', () => {
    expect(plan([enr('adelantado', 8000, '2026-11-30')], 'monthly')).toEqual([])
  })

  it('va atrasado: se cobra un mes y avanza desde lo pagado, no salta a fin de este mes', () => {
    expect(plan([enr('atrasado', 8000, '2026-08-31')], 'monthly')).toEqual([
      { enrollment_id: 'atrasado', amount: 8000, paid_until: '2026-09-30', discount_cents: 0 },
    ])
  })

  it('grupo que empieza el mes que viene: todavía no se cobra', () => {
    expect(plan([enr('futuro', 8000, null, '2026-11-01')], 'monthly')).toEqual([])
  })

  it('cuota de 0 €: no se cobra', () => {
    expect(plan([enr('beca', 0, '2026-09-30')], 'monthly')).toEqual([])
  })

  it('clases no dadas con el módulo de validación: se descuentan', () => {
    const e = enr('validacion', 8000, '2026-09-30', '2026-09-01', { price_per_class_cents: 1000, discount_classes_pending: 2 })
    expect(plan([e], 'monthly', true)).toEqual([{ enrollment_id: 'validacion', amount: 6000, paid_until: '2026-10-31', discount_cents: 2000 }])
    expect(plan([e], 'monthly', false)[0].amount).toBe(8000)
  })

  it('el descuento nunca deja la cuota en negativo', () => {
    const e = enr('mucho', 3000, '2026-09-30', '2026-09-01', { price_per_class_cents: 2000, discount_classes_pending: 4 })
    expect(plan([e], 'monthly', true)[0].amount).toBe(0)
  })
})

describe('planMandateItems: alta', () => {
  it('al día en todos sus grupos: el alta cobra el mes siguiente de cada uno (Redsys necesita un primer cobro)', () => {
    expect(plan([enr('al-dia', 8000, '2026-10-31')], 'init')).toEqual([
      { enrollment_id: 'al-dia', amount: 8000, paid_until: '2026-11-30', discount_cents: 0 },
    ])
  })

  it('grupo que empieza el mes que viene: el alta cobra su primer mes', () => {
    expect(plan([enr('futuro', 8000, null, '2026-11-01')], 'init')[0].paid_until).toBe('2026-11-30')
  })

  it('un grupo debe el mes y otro está pagado: el alta cobra solo el que debe', () => {
    expect(plan([enr('pagado', 8000, '2026-10-31'), enr('debe', 4000, null, '2026-10-01')], 'init')).toEqual([
      { enrollment_id: 'debe', amount: 4000, paid_until: '2026-10-31', discount_cents: 0 },
    ])
  })

  it('dos grupos pendientes: el alta cobra la cuota de los dos', () => {
    expect(plan([enr('a', 8000, '2026-09-30'), enr('b', 4000, null, '2026-10-01')], 'init').map(i => i.paid_until)).toEqual(['2026-10-31', '2026-10-31'])
  })
})

describe('nextChargeDate', () => {
  const at = (iso: string) => new Date(iso)
  it('día de cobro aún por llegar este mes', () => {
    expect(nextChargeDate(20, at('2026-10-16T10:00:00Z'))).toBe('2026-10-20')
  })
  it('día de cobro ya pasado o es hoy: el mes siguiente', () => {
    expect(nextChargeDate(1, at('2026-10-16T10:00:00Z'))).toBe('2026-11-01')
    expect(nextChargeDate(16, at('2026-10-16T10:00:00Z'))).toBe('2026-11-16')
  })
  it('cambio de año', () => {
    expect(nextChargeDate(5, at('2026-12-20T10:00:00Z'))).toBe('2027-01-05')
  })
  it('usa la fecha de Madrid: 31-oct 23:30 UTC ya es 1-nov en España', () => {
    expect(nextChargeDate(1, at('2026-10-31T23:30:00Z'))).toBe('2026-12-01')
  })
})
