import { describe, it, expect } from 'vitest'
import { timetableRange, placeDay, freeCourtsBySlot } from '@/lib/timetable'

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

describe('placeDay', () => {
  it('clases que no se pisan van cada una a lo ancho', () => {
    const placed = placeDay([c('a', '18:00', '19:00'), c('b', '19:00', '20:00')])
    expect(placed.map(p => [p.item.id, p.lane, p.lanes])).toEqual([['a', 0, 1], ['b', 0, 1]])
  })
  it('dos clases a la misma hora en pistas distintas van una al lado de otra', () => {
    const placed = placeDay([c('a', '18:00', '19:00'), c('b', '18:00', '19:00')])
    expect(placed.map(p => [p.lane, p.lanes])).toEqual([[0, 2], [1, 2]])
  })
  it('una clase de 1 h 30 que pisa a otras dos reparte bien los carriles', () => {
    const placed = placeDay([c('a', '18:00', '19:30'), c('b', '18:00', '19:00'), c('c', '19:00', '20:00')])
    const byId = Object.fromEntries(placed.map(p => [p.item.id, p]))
    expect(byId.a.lanes).toBe(2)
    expect(byId.b.lane).not.toBe(byId.a.lane)
    expect(byId.c.lane).not.toBe(byId.a.lane)
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
