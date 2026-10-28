import { describe, it, expect } from 'vitest'
import { billingMonthStr, feeMonthOptions, splitAmount } from '@/lib/fee-months'

describe('feeMonthOptions', () => {
  it('con un mes pendiente ofrece ese mes y el siguiente adelantado', () => {
    const o = feeMonthOptions('2026-09-30', '2026-09-01', '2026-10')
    expect(o.map(x => [x.label, x.paidUntil, x.advance])).toEqual([
      ['octubre 2026', '2026-10-31', false],
      ['octubre y noviembre 2026', '2026-11-30', true],
    ])
  })

  it('con el mes pagado solo ofrece el siguiente, marcado como adelantado', () => {
    const o = feeMonthOptions('2026-10-31', '2026-09-01', '2026-10')
    expect(o).toEqual([{ months: 1, paidUntil: '2026-11-30', label: 'noviembre 2026', advance: true }])
  })

  it('con dos meses debidos los ofrece en orden', () => {
    const o = feeMonthOptions('2026-08-31', '2026-09-01', '2026-10')
    expect(o.map(x => x.label)).toEqual(['septiembre 2026', 'septiembre y octubre 2026', 'septiembre, octubre y noviembre 2026'])
  })

  it('sin pagos empieza por el mes de alta', () => {
    const o = feeMonthOptions(null, '2026-11-01', '2026-10')
    expect(o).toEqual([{ months: 1, paidUntil: '2026-11-30', label: 'noviembre 2026', advance: true }])
  })

  it('cruza de año', () => {
    const o = feeMonthOptions('2026-11-30', '2026-09-01', '2026-12')
    expect(o.map(x => x.label)).toEqual(['diciembre 2026', 'diciembre 2026 y enero 2027'])
  })
})

describe('splitAmount', () => {
  it('reparte y deja el resto en el primer mes', () => {
    expect(splitAmount(10000, 3)).toEqual([3334, 3333, 3333])
    expect(splitAmount(6800, 1)).toEqual([6800])
    expect(splitAmount(0, 2)).toEqual([0, 0])
  })
})

describe('billingMonthStr', () => {
  it('a mitad de mes es el mes en curso y en los últimos días el siguiente', () => {
    expect(billingMonthStr(new Date('2026-10-15T10:00:00Z'))).toBe('2026-10')
    expect(billingMonthStr(new Date('2026-10-28T10:00:00Z'))).toBe('2026-11')
    expect(billingMonthStr(new Date('2026-12-30T10:00:00Z'))).toBe('2027-01')
  })
})
