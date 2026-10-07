import { describe, it, expect } from 'vitest'
import { getNextOccurrence } from '@/lib/next-class'

const TZ = 'Europe/Madrid'
const day = (d: Date | null) => (d ? new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d) : null)

// Weekly Monday 10:00 class that started on Monday 5 Oct 2026.
const MONDAY_CLASS = '2026-10-05T10:00:00'

describe('getNextOccurrence', () => {
  it('returns the next weekly occurrence', () => {
    const now = new Date('2026-10-07T12:00:00')
    expect(day(getNextOccurrence(MONDAY_CLASS, new Set(), now))).toBe('2026-10-12')
  })

  it('skips a club holiday and returns the following week', () => {
    const now = new Date('2026-10-07T12:00:00')
    expect(day(getNextOccurrence(MONDAY_CLASS, new Set(['2026-10-12']), now))).toBe('2026-10-19')
  })

  it('skips consecutive holidays', () => {
    const now = new Date('2026-10-07T12:00:00')
    expect(day(getNextOccurrence(MONDAY_CLASS, new Set(['2026-10-12', '2026-10-19']), now))).toBe('2026-10-26')
  })

  it('returns null for an invalid start time', () => {
    expect(getNextOccurrence('', new Set())).toBeNull()
    expect(getNextOccurrence('not-a-date', new Set())).toBeNull()
  })
})
