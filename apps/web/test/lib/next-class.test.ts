import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getNextOccurrence, getUpcomingOccurrences } from '@/lib/next-class'

// Railway corre en UTC. Con el reloj del servidor en UTC, una clase de las 17:30 de España creada en
// verano (15:30 UTC) caía a las 16:30 en invierno y a partir de esa hora la app daba la de la semana siguiente.
describe('con el servidor en UTC (como Railway)', () => {
  const originalTz = process.env.TZ
  beforeAll(() => { process.env.TZ = 'UTC' })
  afterAll(() => { process.env.TZ = originalTz })

  // Viernes 17:30 en España, creada el 4-9-2026 (horario de verano → 15:30 UTC).
  const FRIDAY_1730 = '2026-09-04T15:30:00+00:00'

  it('en invierno, a las 16:35 de España la clase de las 17:30 de hoy sigue siendo la próxima', () => {
    const now = new Date('2026-11-06T15:35:00Z')
    expect(getNextOccurrence(FRIDAY_1730, new Set(), now)?.toISOString()).toBe('2026-11-06T16:30:00.000Z')
  })

  it('una vez empezada, la próxima es la de la semana siguiente a las 17:30 de España', () => {
    const now = new Date('2026-11-06T16:31:00Z')
    expect(getNextOccurrence(FRIDAY_1730, new Set(), now)?.toISOString()).toBe('2026-11-13T16:30:00.000Z')
  })

  it('en verano mantiene las 17:30 de España', () => {
    const now = new Date('2026-09-11T14:00:00Z')
    expect(getNextOccurrence(FRIDAY_1730, new Set(), now)?.toISOString()).toBe('2026-09-11T15:30:00.000Z')
  })

  it('las próximas fechas mantienen las 17:30 de España al cruzar el cambio de hora', () => {
    const now = new Date('2026-10-20T10:00:00Z')
    expect(getUpcomingOccurrences(FRIDAY_1730, now, 3).map(d => d.toISOString())).toEqual([
      '2026-10-23T15:30:00.000Z',
      '2026-10-30T16:30:00.000Z',
      '2026-11-06T16:30:00.000Z',
    ])
  })

  it('una clase de las 00:30 de España (día anterior en UTC) cae en su día de España', () => {
    const SATURDAY_0030 = '2026-11-06T23:30:00+00:00' // sábado 7-11 a las 00:30 en España
    const now = new Date('2026-11-10T10:00:00Z')
    expect(day(getNextOccurrence(SATURDAY_0030, new Set(), now))).toBe('2026-11-14')
  })

  it('no devuelve fechas anteriores al inicio de la clase', () => {
    const now = new Date('2026-08-01T10:00:00Z')
    expect(getNextOccurrence(FRIDAY_1730, new Set(), now)?.toISOString()).toBe('2026-09-04T15:30:00.000Z')
  })

  it('salta los festivos', () => {
    const now = new Date('2026-11-06T15:35:00Z')
    expect(getNextOccurrence(FRIDAY_1730, new Set(['2026-11-06']), now)?.toISOString()).toBe('2026-11-13T16:30:00.000Z')
  })
})

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
