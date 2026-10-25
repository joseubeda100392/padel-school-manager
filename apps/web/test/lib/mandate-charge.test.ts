import { describe, it, expect } from 'vitest'
import { planMandateItems, planAdvanceItems, nextChargeDate, withReplacements, type MandateEnrollment } from '@/lib/mandate-charge'

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

  it('va atrasado: cobra cada mes que debe hasta el actual, desde lo pagado', () => {
    expect(plan([enr('atrasado', 8000, '2026-08-31')], 'monthly')).toEqual([
      { enrollment_id: 'atrasado', amount: 8000, paid_until: '2026-09-30', discount_cents: 0 },
      { enrollment_id: 'atrasado', amount: 8000, paid_until: '2026-10-31', discount_cents: 0 },
    ])
  })

  it('se une a otro grupo a mitad de mes (caso Laura): el día 1 se cobra el mes pendiente y el nuevo, sin quedar un mes por detrás', () => {
    const items = planMandateItems({
      enrollments: [enr('miercoles', 8000, '2026-10-31'), enr('lunes', 4000, null, '2026-10-01')],
      mode: 'monthly', currentMonth: '2026-11', classValidation: false,
    })
    expect(items.map(i => `${i.enrollment_id}:${i.paid_until}`)).toEqual(['miercoles:2026-11-30', 'lunes:2026-10-31', 'lunes:2026-11-30'])
    expect(items.reduce((s, i) => s + i.amount, 0)).toBe(16000)
  })

  it('el descuento por clases no dadas se aplica solo una vez aunque cobre varios meses', () => {
    const e = enr('validacion', 8000, '2026-08-31', '2026-09-01', { price_per_class_cents: 1000, discount_classes_pending: 2 })
    expect(plan([e], 'monthly', true).map(i => i.amount)).toEqual([6000, 8000])
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

describe('planAdvanceItems: adelantar el mes siguiente de todos los grupos', () => {
  const adv = (enrollments: MandateEnrollment[]) => planAdvanceItems({ enrollments, currentMonth: '2026-10', classValidation: false })

  it('al día en sus dos grupos: adelanta noviembre de los dos', () => {
    expect(adv([enr('a', 8000, '2026-10-31'), enr('b', 4000, '2026-10-31', '2026-10-01')]).map(i => `${i.enrollment_id}:${i.paid_until}:${i.amount}`))
      .toEqual(['a:2026-11-30:8000', 'b:2026-11-30:4000'])
  })

  it('debe el mes en curso de algún grupo: no se ofrece adelantar', () => {
    expect(adv([enr('a', 8000, '2026-10-31'), enr('b', 4000, null, '2026-10-01')])).toEqual([])
  })

  it('un grupo ya tiene noviembre adelantado: solo adelanta el otro', () => {
    expect(adv([enr('a', 8000, '2026-11-30'), enr('b', 4000, '2026-10-31', '2026-10-01')]).map(i => i.enrollment_id)).toEqual(['b'])
  })

  it('todos con noviembre adelantado: nada que adelantar', () => {
    expect(adv([enr('a', 8000, '2026-11-30')])).toEqual([])
  })
})

describe('grupo que deja (baja o cambio de grupo programado)', () => {
  it('adelantar el mes que viene no cobra el grupo que deja a fin de mes', () => {
    const items = planAdvanceItems({
      enrollments: [enr('viejo', 8000, '2026-10-31', '2026-09-01', { end_date: '2026-10-31' }), enr('nuevo', 6000, null, '2026-11-01')],
      currentMonth: '2026-10', classValidation: false,
    })
    expect(items.map(i => i.enrollment_id)).toEqual(['nuevo'])
  })

  it('el cobro mensual sí cobra el último mes en que sigue', () => {
    expect(plan([enr('viejo', 8000, '2026-09-30', '2026-09-01', { end_date: '2026-10-31' })], 'monthly').map(i => i.paid_until)).toEqual(['2026-10-31'])
  })
})

describe('cambio de grupo o clase editada a partir de un día: un cobro por mes', () => {
  it('cambio a mitad de noviembre: noviembre se cobra una vez, en el grupo nuevo', () => {
    const list = withReplacements([
      enr('viejo', 8000, '2026-10-31', '2026-09-01'),
      enr('nuevo', 8000, '2026-10-31', '2026-11-15', { replaces_enrollment_id: 'viejo' }),
    ], new Map())
    expect(list.find(e => e.id === 'viejo')!.end_date).toBe('2026-10-31')
    const items = planMandateItems({ enrollments: list, mode: 'monthly', currentMonth: '2026-11', classValidation: false })
    expect(items.map(i => `${i.enrollment_id}:${i.paid_until}`)).toEqual(['nuevo:2026-11-30'])
  })

  it('si noviembre ya se pagó en el grupo viejo, no se vuelve a cobrar en el nuevo', () => {
    const list = withReplacements([
      enr('nuevo', 8000, null, '2026-11-15', { replaces_enrollment_id: 'viejo' }),
    ], new Map([['viejo', '2026-11-30']]))
    expect(planMandateItems({ enrollments: list, mode: 'monthly', currentMonth: '2026-11', classValidation: false })).toEqual([])
  })

  it('cambio inmediato (la nueva hereda el inicio de la vieja): la vieja no cobra nada', () => {
    const list = withReplacements([
      enr('viejo', 8000, '2026-09-30', '2026-09-01', { end_date: '2026-10-24' }),
      enr('nuevo', 8000, '2026-09-30', '2026-09-01', { replaces_enrollment_id: 'viejo' }),
    ], new Map())
    const items = planMandateItems({ enrollments: list, mode: 'monthly', currentMonth: '2026-10', classValidation: false })
    expect(items.map(i => i.enrollment_id)).toEqual(['nuevo'])
  })
})
