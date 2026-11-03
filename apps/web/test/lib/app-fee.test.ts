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

describe('ventana y solo lectura', () => {
  const nov = { start_month: '2026-11-01', amount: 99 }

  it('la ventana sale desde el día 11', () => {
    expect(appFeeStatus(nov, [], '2026-11-10')!.reminder).toBe(false)
    expect(appFeeStatus(nov, [], '2026-11-11')!.reminder).toBe(true)
  })

  it('solo lectura desde el día 16 y solo si el club lo tiene activado', () => {
    expect(appFeeStatus(nov, [], '2026-11-20')!.locked).toBe(false)
    const lock = { ...nov, lock_when_overdue: true }
    expect(appFeeStatus(lock, [], '2026-11-15')!.locked).toBe(false)
    expect(appFeeStatus(lock, [], '2026-11-16')!.locked).toBe(true)
  })

  it('avisar de la transferencia quita la ventana y el solo lectura', () => {
    const lock = { ...nov, lock_when_overdue: true }
    const s = appFeeStatus(lock, [{ month: '2026-11-01', notified_at: '2026-11-17T10:00:00Z', paid_at: null }], '2026-11-20')!
    expect([s.reminder, s.locked]).toEqual([false, false])
  })

  it('el aviso de transferencia caduca a los 5 días si no se marca pagado', () => {
    const lock = { ...nov, lock_when_overdue: true }
    const rec = [{ month: '2026-11-01', notified_at: '2026-11-17T10:00:00Z', paid_at: null }]
    expect(appFeeStatus(lock, rec, '2026-11-22')!.notified).toBe(true)
    const s = appFeeStatus(lock, rec, '2026-11-23')!
    expect([s.notified, s.reminder, s.locked]).toEqual([false, true, true])
  })

  it('el primer plazo de R3 también retrasa la ventana', () => {
    const r3 = { ...plan, first_due_date: '2026-11-05' }
    expect(appFeeStatus(r3, [], '2026-11-10')!.reminder).toBe(false)
    expect(appFeeStatus(r3, [], '2026-11-11')!.reminder).toBe(true)
  })
})

describe('madridToday', () => {
  it('usa la fecha de Madrid, no la UTC', () => {
    expect(madridToday(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11-01')
  })
})
