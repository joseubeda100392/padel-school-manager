import { describe, it, expect } from 'vitest'
import { getHolidaySet } from '@/lib/club-holidays'

describe('getHolidaySet', () => {
  it('returns the configured holiday dates', () => {
    const set = getHolidaySet({ holidays: ['2026-10-12', '2026-11-02'] })
    expect(set.has('2026-10-12')).toBe(true)
    expect(set.has('2026-11-02')).toBe(true)
    expect(set.has('2026-10-13')).toBe(false)
  })

  it('returns an empty set when config is missing', () => {
    expect(getHolidaySet(null).size).toBe(0)
    expect(getHolidaySet(undefined).size).toBe(0)
    expect(getHolidaySet({}).size).toBe(0)
  })

  it('ignores malformed holidays values', () => {
    expect(getHolidaySet({ holidays: ' 2026-10-12' }).size).toBe(0)
    expect([...getHolidaySet({ holidays: ['2026-10-12', 42, null] })]).toEqual(['2026-10-12'])
  })
})
