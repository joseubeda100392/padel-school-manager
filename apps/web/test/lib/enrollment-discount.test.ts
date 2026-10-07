import { describe, it, expect, vi } from 'vitest'
import {
  applyStandardDiscount,
  removeStandardDiscount,
  resetEnrollmentDiscountAfterPayment,
} from '@/lib/enrollment-discount'

describe('applyStandardDiscount', () => {
  it('subtracts the discount from the student own fee, not the group fee', () => {
    expect(applyStandardDiscount(8500, 4000)).toBe(4500)
    expect(applyStandardDiscount(8000, 4000)).toBe(4000)
  })

  it('returns null when the fee is lower than the discount', () => {
    expect(applyStandardDiscount(3000, 4000)).toBeNull()
  })

  it('allows a fee equal to the discount (free month)', () => {
    expect(applyStandardDiscount(4000, 4000)).toBe(0)
  })
})

describe('removeStandardDiscount', () => {
  it('adds the discount back to the student own fee', () => {
    expect(removeStandardDiscount(4500, 4000)).toBe(8500)
  })

  it('round-trips with applyStandardDiscount', () => {
    const original = 16000
    const discounted = applyStandardDiscount(original, 4000)!
    expect(removeStandardDiscount(discounted, 4000)).toBe(original)
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
  return { client: { from } as never, update }
}

describe('resetEnrollmentDiscountAfterPayment', () => {
  it('restores the student own fee after the discounted month is paid', async () => {
    const { client, update } = fakeAdmin(
      { discount_applied: true, monthly_price: 4500, club_id: 'club-1' },
      { standard_discount_cents: 4000 },
    )
    await resetEnrollmentDiscountAfterPayment(client, 'enr-1')
    expect(update).toHaveBeenCalledWith({ monthly_price: 8500, discount_applied: false })
  })

  it('uses the default 40 € discount when the club has no config', async () => {
    const { client, update } = fakeAdmin({ discount_applied: true, monthly_price: 4000, club_id: 'club-1' }, null)
    await resetEnrollmentDiscountAfterPayment(client, 'enr-1')
    expect(update).toHaveBeenCalledWith({ monthly_price: 8000, discount_applied: false })
  })

  it('does nothing when the enrollment has no discount', async () => {
    const { client, update } = fakeAdmin({ discount_applied: false, monthly_price: 8500, club_id: 'club-1' }, null)
    await resetEnrollmentDiscountAfterPayment(client, 'enr-1')
    expect(update).not.toHaveBeenCalled()
  })
})
