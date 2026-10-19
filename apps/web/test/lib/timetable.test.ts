import { describe, it, expect } from 'vitest'
import { timetableRange, classesBySlot, freeCourtsBySlot } from '@/lib/timetable'

const c = (id: string, start: string, end: string, courtId: string | null = id) => {
  const toMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5))
  return { id, dayIndex: 0, startMin: toMin(start), endMin: toMin(end), courtId }
}

describe('timetableRange', () => {
  it('por defecto de 9:00 a 00:00', () => {
    expect(timetableRange([c('a', '18:00', '19:00')])).toEqual({ startMin: 540, endMin: 1440 })
  })
  it('se amplía si una clase empieza antes de las 9:00', () => {
    expect(timetableRange([c('a', '08:30', '09:30')]).startMin).toBe(510)
  })
})

describe('classesBySlot', () => {
  const range = { startMin: 18 * 60, endMin: 20 * 60 }
  it('pone cada clase en la media hora en que empieza', () => {
    const slots = classesBySlot([c('a', '19:00', '20:00'), c('b', '18:00', '19:00'), c('c', '18:00', '19:30')], range)
    expect(slots.map(s => s.map(x => x.id))).toEqual([['b', 'c'], [], ['a'], []])
  })
  it('una clase a las 18:15 va en la franja de las 18:00, después de las de en punto', () => {
    const slots = classesBySlot([c('a', '18:15', '19:15'), c('b', '18:00', '19:00')], range)
    expect(slots[0].map(x => x.id)).toEqual(['b', 'a'])
  })
})

describe('freeCourtsBySlot', () => {
  const range = { startMin: 18 * 60, endMin: 20 * 60 } // 18:00, 18:30, 19:00, 19:30
  it('resta las pistas ocupadas en cada media hora', () => {
    const free = freeCourtsBySlot([c('a', '18:00', '19:00', 'p1'), c('b', '18:30', '19:30', 'p2')], 3, range)
    expect(free).toEqual([2, 1, 2, 3])
  })
  it('dos grupos en la misma pista (uno en formación) restan una sola pista', () => {
    const free = freeCourtsBySlot([c('a', '18:00', '19:00', 'p1'), c('b', '18:00', '19:00', 'p1')], 3, range)
    expect(free[0]).toBe(2)
  })
  it('nunca baja de cero', () => {
    const free = freeCourtsBySlot([c('a', '18:00', '19:00', 'p1'), c('b', '18:00', '19:00', 'p2')], 1, range)
    expect(free[0]).toBe(0)
  })
})
