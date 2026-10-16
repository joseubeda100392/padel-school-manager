import { describe, it, expect } from 'vitest'
import { findBillingDiscrepancies, type AuditEnrollment, type AuditPayment } from '@/lib/billing-audit'

const CLUB = 'r3'
const clubs = { [CLUB]: { name: 'R3', billing_start_date: '2026-08-31' } }

const enr = (student: string, start: string, paid_until: string | null, price = 8000): AuditEnrollment => ({
  student_id: student, student_name: student, club_id: CLUB, start_date: start,
  enrolled_at: '2026-07-29T10:00:00Z', paid_until, monthly_price: price,
})
const pay = (student: string, created_at: string, paid_until?: string, advance?: boolean): AuditPayment => ({
  user_id: student, club_id: CLUB, created_at,
  metadata: { ...(paid_until ? { paid_until } : {}), ...(advance ? { advance } : {}) },
})

describe('findBillingDiscrepancies', () => {
  it('primer pago tardío que saltó septiembre (caso Alejandro Herrera): octubre sin pago', () => {
    const r = findBillingDiscrepancies([enr('alejandro', '2026-09-01', '2026-10-31')], [pay('alejandro', '2026-09-28T12:45:00Z')], clubs)
    expect(r).toEqual([expect.objectContaining({ student_id: 'alejandro', kind: 'cubierto_sin_pago', months: ['2026-10'] })])
  })

  it('cambio de grupo con el mes siguiente regalado (caso Igor Butnaro): octubre sin pago', () => {
    const r = findBillingDiscrepancies(
      [enr('igor', '2026-10-01', '2026-10-31')],
      [pay('igor', '2026-09-14T12:55:00Z', '2026-09-30'), pay('igor', '2026-09-14T13:25:00Z', '2026-09-30')],
      clubs,
    )
    expect(r).toEqual([expect.objectContaining({ kind: 'cubierto_sin_pago', months: ['2026-10'] })])
  })

  it('dobla clase con el segundo grupo dado por pagado (caso Laura Casillas): octubre sin segundo pago', () => {
    const r = findBillingDiscrepancies(
      [enr('laura', '2026-09-01', '2026-10-31'), enr('laura', '2026-10-01', '2026-10-31')],
      [pay('laura', '2026-09-14T13:03:00Z', '2026-09-30'), pay('laura', '2026-10-08T18:47:00Z', '2026-10-31')],
      clubs,
    )
    expect(r).toEqual([expect.objectContaining({ kind: 'cubierto_sin_pago', months: ['2026-10'] })])
  })

  it('adelanto de octubre sin mes guardado (caso Cristina Narvaez): cuadra', () => {
    const r = findBillingDiscrepancies(
      [enr('cristina', '2026-09-01', '2026-10-31', 5400)],
      [pay('cristina', '2026-09-14T13:26:00Z', '2026-09-30'), pay('cristina', '2026-09-29T21:19:00Z', undefined, true)],
      clubs,
    )
    expect(r).toEqual([])
  })

  it('pago de 0 € cuenta como mes saldado (caso Santiago Pulpón): cuadra', () => {
    const r = findBillingDiscrepancies(
      [enr('santi', '2026-09-01', '2026-10-31', 100)],
      [pay('santi', '2026-09-14T12:44:00Z', '2026-09-30'), pay('santi', '2026-10-07T22:14:00Z', '2026-10-31')],
      clubs,
    )
    expect(r).toEqual([])
  })

  it('alumno sin cuota (0 €) sin pagos: no se avisa', () => {
    expect(findBillingDiscrepancies([enr('beca', '2026-09-01', '2026-10-31', 0)], [], clubs)).toEqual([])
  })

  it('pago que no llegó a marcar la cuota: pago sin reflejar', () => {
    const r = findBillingDiscrepancies([enr('webhook', '2026-09-01', '2026-09-30')], [pay('webhook', '2026-09-10T10:00:00Z', '2026-09-30'), pay('webhook', '2026-10-02T10:00:00Z', '2026-10-31')], clubs)
    expect(r).toEqual([expect.objectContaining({ kind: 'pago_sin_reflejar', months: ['2026-10'] })])
  })

  it('meses anteriores al inicio de cobros del club no cuentan', () => {
    const r = findBillingDiscrepancies(
      [enr('julio', '2026-07-01', '2026-09-30')],
      [pay('julio', '2026-08-31T10:00:00Z', '2026-08-31'), pay('julio', '2026-09-05T10:00:00Z', '2026-09-30')],
      clubs,
    )
    expect(r).toEqual([])
  })

  it('cobro automático con tarjeta que paga dos grupos (items): cuenta como dos pagos', () => {
    const mandateCharge: AuditPayment = {
      user_id: 'laura', club_id: CLUB, created_at: '2026-10-01T07:00:00Z',
      metadata: { paid_until: '2026-10-31', items: [{ paid_until: '2026-10-31' }, { paid_until: '2026-10-31' }] },
    }
    const r = findBillingDiscrepancies(
      [enr('laura', '2026-09-01', '2026-10-31'), enr('laura', '2026-10-01', '2026-10-31')],
      [pay('laura', '2026-09-14T13:03:00Z', '2026-09-30'), mandateCharge],
      clubs,
    )
    expect(r).toEqual([])
  })

  it('clubs fuera de la lista (pruebas) se ignoran', () => {
    const other = { ...enr('demo', '2026-07-01', '2026-10-31'), club_id: 'x7-pinto' }
    expect(findBillingDiscrepancies([other], [], clubs)).toEqual([])
  })
})
