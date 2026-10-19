import { describe, it, expect } from 'vitest'
import { parseLowerLevelMap, canTakeSpot, studentLevelsForClass, defaultLowerLevelMap } from '@/lib/spot-levels'

// Niveles de la demo de X7: Infantil va detrás de Avanzado en el orden.
const INI = 'ini', MED = 'med', AVA = 'ava', INF = 'inf'
const X7_MAP = { [MED]: INI, [AVA]: MED } // Infantil e Iniciación: solo el suyo

describe('parseLowerLevelMap', () => {
  it('sin configurar devuelve un mapa vacío', () => {
    expect(parseLowerLevelMap({})).toEqual({})
    expect(parseLowerLevelMap(null)).toEqual({})
  })
  it('descarta valores que no son texto y un nivel apuntándose a sí mismo', () => {
    expect(parseLowerLevelMap({ spot_lower_levels: { a: 'b', c: 3, d: 'd', e: '' } })).toEqual({ a: 'b' })
  })
})

describe('canTakeSpot', () => {
  it('sin la opción, solo su nivel (como hasta ahora)', () => {
    expect(canTakeSpot(MED, MED, {})).toBe(true)
    expect(canTakeSpot(MED, INI, {})).toBe(false)
  })
  it('con la opción, su nivel y el de justo debajo', () => {
    expect(canTakeSpot(MED, INI, X7_MAP)).toBe(true)
    expect(canTakeSpot(AVA, MED, X7_MAP)).toBe(true)
  })
  it('nunca por encima ni dos niveles por debajo', () => {
    expect(canTakeSpot(MED, AVA, X7_MAP)).toBe(false)
    expect(canTakeSpot(AVA, INI, X7_MAP)).toBe(false)
  })
  it('Infantil no baja a Avanzado aunque vaya detrás en el orden', () => {
    expect(canTakeSpot(INF, AVA, X7_MAP)).toBe(false)
  })
  it('alumno sin nivel o clase sin nivel: sin restricción, como siempre', () => {
    expect(canTakeSpot(null, INI, X7_MAP)).toBe(true)
    expect(canTakeSpot(MED, null, X7_MAP)).toBe(true)
  })
})

describe('studentLevelsForClass', () => {
  it('un hueco de Iniciación se avisa a Iniciación y a Medio', () => {
    expect(studentLevelsForClass(INI, X7_MAP).sort()).toEqual([INI, MED].sort())
  })
  it('un hueco de Avanzado solo a Avanzado (nadie baja a él)', () => {
    expect(studentLevelsForClass(AVA, X7_MAP)).toEqual([AVA])
  })
})

describe('defaultLowerLevelMap', () => {
  it('propone el de justo debajo según el orden (el club corrige Infantil)', () => {
    const map = defaultLowerLevelMap([
      { id: INI, order: 1 }, { id: MED, order: 2 }, { id: AVA, order: 3 }, { id: INF, order: 4 },
    ])
    expect(map).toEqual({ [MED]: INI, [AVA]: MED, [INF]: AVA })
  })
})
