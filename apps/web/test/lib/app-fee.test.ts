import { describe, it, expect } from 'vitest'
import { appFeeStatus, madridToday, pendingAppFeeMonths } from '@/lib/app-fee'

const plan = { start_month: '2026-10-01', amount: 99 }

describe('pendingAppFeeMonths', () => {
  it('debe desde el mes de inicio hasta el actual', () => {
    expect(pendingAppFeeMonths(plan, [], '2026-11-03')).toEqual(['2026-10', '2026-11'])
  })

  it('no cuenta los meses pagados', () => {
    const records = [{ month: '2026-10-01', notified_at: null, paid_at: '2026-11-04T10:00:00Z' }]
    expect(pendingAppFeeMonths(plan, records, '2026-11-03')).toEqual(['2026-11'])
  })

  it('antes del mes de inicio no debe nada', () => {
    expect(pendingAppFeeMonths({ start_month: '2026-12-01', amount: 99 }, [], '2026-11-30')).toEqual([])
  })

  it('cruza de año', () => {
    expect(pendingAppFeeMonths({ start_month: '2026-12-01', amount: 99 }, [], '2027-01-02')).toEqual(['2026-12', '2027-01'])
  })
})

describe('appFeeStatus', () => {
  it('suma los meses y vence el día 5 del primero', () => {
    const s = appFeeStatus(plan, [], '2026-11-03')!
    expect(s).toMatchObject({ label: 'octubre y noviembre 2026', total: 198, dueDate: '2026-10-05', overdue: true, notified: false })
  })

  it('el mes en curso no está vencido hasta pasado el día 5', () => {
    const paidOct = [{ month: '2026-10-01', notified_at: null, paid_at: '2026-10-04T10:00:00Z' }]
    expect(appFeeStatus(plan, paidOct, '2026-11-05')!.overdue).toBe(false)
    expect(appFeeStatus(plan, paidOct, '2026-11-06')!.overdue).toBe(true)
  })

  it('un primer plazo posterior retrasa el vencimiento de los meses anteriores', () => {
    const r3 = { ...plan, first_due_date: '2026-11-05' }
    expect(appFeeStatus(r3, [], '2026-11-03')).toMatchObject({ total: 198, dueDate: '2026-11-05', overdue: false })
    expect(appFeeStatus(r3, [], '2026-11-06')!.overdue).toBe(true)
  })

  it('al día devuelve null', () => {
    const records = ['2026-10-01', '2026-11-01'].map(month => ({ month, notified_at: null, paid_at: '2026-11-04T10:00:00Z' }))
    expect(appFeeStatus(plan, records, '2026-11-20')).toBeNull()
  })

  it('avisado solo si el club avisó de todos los meses pendientes', () => {
    const one = [{ month: '2026-10-01', notified_at: '2026-11-03T10:00:00Z', paid_at: null }]
    expect(appFeeStatus(plan, one, '2026-11-03')!.notified).toBe(false)
    const both = [...one, { month: '2026-11-01', notified_at: '2026-11-03T10:00:00Z', paid_at: null }]
    expect(appFeeStatus(plan, both, '2026-11-03')!.notified).toBe(true)
  })
})

describe('madridToday', () => {
  it('usa la fecha de Madrid, no la UTC', () => {
    expect(madridToday(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11-01')
  })
})
