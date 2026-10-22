import { describe, it, expect } from 'vitest'
import { isActiveOn, peakOccupancyFrom, dayBefore, firstOfNextMonth, rosterForMonth, upcomingMonths } from '@/lib/enrollment-window'

describe('isActiveOn', () => {
  it('counts both ends of the window as inside', () => {
    const e = { start_date: '2026-11-01', end_date: '2026-11-30' }
    expect(isActiveOn(e, '2026-11-01')).toBe(true)
    expect(isActiveOn(e, '2026-11-30')).toBe(true)
    expect(isActiveOn(e, '2026-10-31')).toBe(false)
    expect(isActiveOn(e, '2026-12-01')).toBe(false)
  })

  it('treats missing dates as open-ended', () => {
    expect(isActiveOn({}, '2030-01-01')).toBe(true)
  })
})

describe('peakOccupancyFrom', () => {
  it('frees the spots of students leaving before the date', () => {
    const group = [{}, {}, { end_date: '2026-10-31' }, { end_date: '2026-10-31' }]
    expect(peakOccupancyFrom(group, '2026-11-01')).toBe(2)
  })

  it('counts a later future starter that would overlap', () => {
    const group = [{}, {}, {}, { start_date: '2026-12-01' }]
    expect(peakOccupancyFrom(group, '2026-11-01')).toBe(4)
  })

  it('ignores a future starter whose spot is freed by then', () => {
    const group = [{}, {}, { end_date: '2026-11-30' }, { start_date: '2026-12-01' }]
    expect(peakOccupancyFrom(group, '2026-11-01')).toBe(3)
  })

  it('is 0 for an empty group', () => {
    expect(peakOccupancyFrom([], '2026-11-01')).toBe(0)
  })
})

describe('date helpers', () => {
  it('dayBefore crosses month and year boundaries', () => {
    expect(dayBefore('2026-11-01')).toBe('2026-10-31')
    expect(dayBefore('2027-01-01')).toBe('2026-12-31')
  })

  it('firstOfNextMonth rolls the year in December', () => {
    expect(firstOfNextMonth('2026-10-22')).toBe('2026-11-01')
    expect(firstOfNextMonth('2026-12-31')).toBe('2027-01-01')
  })
})

describe('rosterForMonth', () => {
  const today = '2026-10-22'
  const group = [
    { id: 'stays' },
    { id: 'leavesOct', end_date: '2026-10-31' },
    { id: 'leavesNov', end_date: '2026-11-30' },
    { id: 'joinsNov', start_date: '2026-11-01' },
    { id: 'joinsDec', start_date: '2026-12-01' },
    { id: 'gone', end_date: '2026-10-15' },
  ]
  const ids = (month: string) => rosterForMonth(group, month, today).map(r => `${r.entry.id}:${r.change?.kind ?? '-'}`)

  it('shows this month from today, with who leaves at month end', () => {
    expect(ids('2026-10')).toEqual(['stays:-', 'leavesOct:out', 'leavesNov:-'])
  })

  it('shows next month with joiners and leavers marked', () => {
    expect(ids('2026-11')).toEqual(['stays:-', 'leavesNov:out', 'joinsNov:in'])
  })

  it('keeps earlier joiners without a mark in later months', () => {
    expect(ids('2026-12')).toEqual(['stays:-', 'joinsNov:-', 'joinsDec:in'])
  })
})

describe('upcomingMonths', () => {
  it('rolls over the year', () => {
    expect(upcomingMonths('2026-11-15', 3)).toEqual(['2026-11', '2026-12', '2027-01'])
  })
})
