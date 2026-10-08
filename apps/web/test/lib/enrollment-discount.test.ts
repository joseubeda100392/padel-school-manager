import { describe, it, expect, vi } from 'vitest'
import {
  halfFeeDiscountCents,
  restoreDiscountedPrice,
  resetEnrollmentDiscountAfterPayment,
} from '@/lib/enrollment-discount'

describe('halfFeeDiscountCents', () => {
  it('discounts half of the student own fee', () => {
    expect(halfFeeDiscountCents(8500)).toBe(4250)
    expect(halfFeeDiscountCents(16000)).toBe(8000)
  })

  it('leaves the odd cent to the student', () => {
    expect(halfFeeDiscountCents(8501)).toBe(4250)
    expect(8501 - halfFeeDiscountCents(8501)).toBe(4251)
  })

  it('returns 0 for a free fee', () => {
    expect(halfFeeDiscountCents(0)).toBe(0)
  })
})

describe('restoreDiscountedPrice', () => {
  it('adds back exactly the stored discount', () => {
    expect(restoreDiscountedPrice(4251, 4250, 4000)).toBe(8501)
  })

  it('round-trips with halfFeeDiscountCents for any fee', () => {
    for (const fee of [0, 1, 4999, 8500, 8501, 16000]) {
      const discount = halfFeeDiscountCents(fee)
      expect(restoreDiscountedPrice(fee - discount, discount, 4000)).toBe(fee)
    }
  })

  it('falls back to the legacy fixed discount when none was stored', () => {
    expect(restoreDiscountedPrice(4500, null, 4000)).toBe(8500)
    expect(restoreDiscountedPrice(4500, undefined, 4000)).toBe(8500)
  })
})

function fakeAdmin(enrollment: Record<string, unknown> | null, clubConfig: Record<string, unknown> | null) {
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
  const from = vi.fn((table: string) => {
    if (table === 'group_enrollments') {
      return {
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: enrollment }) }) }),
        update,
      }
    }
    return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { config: clubConfig } }) }) }) }
  })
  return { client: { from } as never, update, from }
}

describe('resetEnrollmentDiscountAfterPayment', () => {
  it('restores the fee using the stored half-fee discount', async () => {
    const { client, update, from } = fakeAdmin(
      { discount_applied: true, discount_cents: 4250, monthly_price: 4250, club_id: 'club-1' },
      { standard_discount_cents: 4000 },
    )
    await resetEnrollmentDiscountAfterPayment(client, 'enr-1')
    expect(update).toHaveBeenCalledWith({ monthly_price: 8500, discount_applied: false, discount_cents: null })
    expect(from).not.toHaveBeenCalledWith('clubs')
  })

  it('restores a legacy discount with the club fixed amount', async () => {
    const { client, update } = fakeAdmin(
      { discount_applied: true, discount_cents: null, monthly_price: 4500, club_id: 'club-1' },
      { standard_discount_cents: 4000 },
    )
    await resetEnrollmentDiscountAfterPayment(client, 'enr-1')
    expect(update).toHaveBeenCalledWith({ monthly_price: 8500, discount_applied: false, discount_cents: null })
  })

  it('uses the default 40 € for a legacy discount when the club has no config', async () => {
    const { client, update } = fakeAdmin({ discount_applied: true, discount_cents: null, monthly_price: 4000, club_id: 'club-1' }, null)
    await resetEnrollmentDiscountAfterPayment(client, 'enr-1')
    expect(update).toHaveBeenCalledWith({ monthly_price: 8000, discount_applied: false, discount_cents: null })
  })

  it('does nothing when the enrollment has no discount', async () => {
    const { client, update } = fakeAdmin({ discount_applied: false, monthly_price: 8500, club_id: 'club-1' }, null)
    await resetEnrollmentDiscountAfterPayment(client, 'enr-1')
    expect(update).not.toHaveBeenCalled()
  })
})
