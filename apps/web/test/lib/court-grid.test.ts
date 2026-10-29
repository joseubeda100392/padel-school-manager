import { describe, it, expect } from 'vitest'
import { courtGridRange, courtColumns, courtBlocks, shortNames } from '@/lib/court-grid'

const toMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5))
const c = (id: string, dayIndex: number, court: string, start: string, end: string) =>
  ({ id, dayIndex, courtId: court, courtName: `Pista ${court}`, startMin: toMin(start), endMin: toMin(end) })

describe('courtGridRange', () => {
  it('va de la primera clase a la última, en medias horas', () => {
    expect(courtGridRange([c('a', 0, '1', '17:15', '18:30'), c('b', 1, '2', '21:30', '23:00')])).toEqual({ startMin: 17 * 60, endMin: 23 * 60 })
  })
  it('sin clases, de 9:00 a 22:00', () => {
    expect(courtGridRange([])).toEqual({ startMin: 9 * 60, endMin: 22 * 60 })
  })
})

describe('courtColumns', () => {
  const days = [
    { dayIndex: 0, isHoliday: false },
    { dayIndex: 4, isHoliday: false },
    { dayIndex: 5, isHoliday: false },
  ]
  const schoolDays = new Set([0, 4])

  it('una columna por pista con clases ese día, ordenadas por número', () => {
    const cols = courtColumns(days, [c('a', 4, '3', '17:30', '18:30'), c('b', 4, '1', '17:30', '18:30'), c('d', 4, '10', '17:30', '18:30'), c('e', 0, '2', '18:00', '19:00')], schoolDays)
    expect(cols.map(x => `${x.dayIndex}:${x.courtName}`)).toEqual(['0:Pista 2', '4:Pista 1', '4:Pista 3', '4:Pista 10'])
  })
  it('marca la primera columna de cada día y cuántas tiene', () => {
    const cols = courtColumns(days, [c('a', 4, '1', '17:30', '18:30'), c('b', 4, '2', '17:30', '18:30')], schoolDays)
    expect(cols.map(x => [x.firstOfDay, x.daySpan])).toEqual([[true, 1], [true, 2], [false, 2]])
  })
  it('un día de escuela sin clases (festivo o antes de empezar) sale con una sola columna vacía', () => {
    const cols = courtColumns([{ dayIndex: 0, isHoliday: true }], [], schoolDays)
    expect(cols).toEqual([{ key: '0-', dayIndex: 0, courtId: null, courtName: null, firstOfDay: true, daySpan: 1 }])
  })
  it('un día sin escuela y sin clases no sale', () => {
    expect(courtColumns([{ dayIndex: 5, isHoliday: false }], [], schoolDays)).toEqual([])
  })
})

describe('courtBlocks', () => {
  const range = { startMin: 17 * 60, endMin: 23 * 60 }
  it('cada clase ocupa sus medias horas', () => {
    const blocks = courtBlocks([c('a', 0, '1', '17:30', '19:00')], range)
    expect(blocks.map(b => [b.firstSlot, b.lastSlot, b.classes.map(x => x.id)])).toEqual([[1, 4, ['a']]])
  })
  it('una clase que no empieza en punto ocupa las franjas que toca', () => {
    expect(courtBlocks([c('a', 0, '1', '17:15', '18:15')], range).map(b => [b.firstSlot, b.lastSlot])).toEqual([[0, 3]])
  })
  it('dos clases que se pisan en la misma pista van juntas en un bloque', () => {
    const blocks = courtBlocks([c('a', 0, '1', '18:00', '19:00'), c('b', 0, '1', '18:30', '19:30'), c('z', 0, '1', '21:00', '22:00')], range)
    expect(blocks.map(b => [b.firstSlot, b.lastSlot, b.classes.map(x => x.id)])).toEqual([[2, 5, ['a', 'b']], [8, 10, ['z']]])
  })
  it('una seguida de otra no se juntan', () => {
    expect(courtBlocks([c('a', 0, '1', '18:00', '19:00'), c('b', 0, '1', '19:00', '20:00')], range)).toHaveLength(2)
  })
})

describe('shortNames', () => {
  it('nombre de pila, por orden alfabético', () => {
    expect(shortNames(['Lorena Pérez', 'Amanda Ruiz', 'Miguel Ángel Cruz'])).toEqual(['Amanda', 'Lorena', 'Miguel'])
  })
  it('si dos comparten nombre de pila, añade el apellido', () => {
    expect(shortNames(['Pablo Cerezo Diez', 'Pablo Martín', 'Iván Castejón'])).toEqual(['Iván', 'Pablo Cerezo', 'Pablo Martín'])
  })
})
