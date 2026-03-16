import { describe, expect, test } from 'bun:test'
import { Polygon } from 'ol/geom'
import type { StedfestingLinjer, StedfestingPunkter } from '../api/generated/uberiket/types.gen'
import type { VeglenkeMedPosisjon, VeglenkesekvensMedPosisjoner } from '../api/uberiketClient'
import {
  clipVeglenkesekvenserToPolygon,
  createVeglenkesekvensOverlapIndex,
  getClippedGeometries,
  getLineStringOverlapFractions,
  getPointAtFraction,
  hasStedfestingOverlap,
  sliceLineStringByFraction,
} from './geometryUtils'

function veglenke(partial: Pick<VeglenkeMedPosisjon, 'nummer' | 'startposisjon' | 'sluttposisjon'>): VeglenkeMedPosisjon {
  return partial as VeglenkeMedPosisjon
}

function veglenkesekvens(partial: { id: number; veglenker: VeglenkeMedPosisjon[] }): VeglenkesekvensMedPosisjoner {
  return partial as VeglenkesekvensMedPosisjoner
}

describe('getPointAtFraction', () => {
  test('returns first point at fraction 0', () => {
    const coords = [
      [0, 0],
      [10, 0],
      [20, 0],
    ]
    const result = getPointAtFraction(coords, 0)
    expect(result).toEqual([0, 0])
  })

  test('returns last point at fraction 1', () => {
    const coords = [
      [0, 0],
      [10, 0],
      [20, 0],
    ]
    const result = getPointAtFraction(coords, 1)
    expect(result).toEqual([20, 0])
  })

  test('returns midpoint at fraction 0.5 for straight line', () => {
    const coords = [
      [0, 0],
      [10, 0],
      [20, 0],
    ]
    const result = getPointAtFraction(coords, 0.5)
    expect(result[0]).toBeCloseTo(10, 5)
    expect(result[1]).toBeCloseTo(0, 5)
  })

  test('interpolates point between coordinates at fraction 0.25', () => {
    const coords = [
      [0, 0],
      [10, 0],
      [20, 0],
    ]
    const result = getPointAtFraction(coords, 0.25)
    expect(result[0]).toBeCloseTo(5, 5)
    expect(result[1]).toBeCloseTo(0, 5)
  })

  test('interpolates point between coordinates at fraction 0.75', () => {
    const coords = [
      [0, 0],
      [10, 0],
      [20, 0],
    ]
    const result = getPointAtFraction(coords, 0.75)
    expect(result[0]).toBeCloseTo(15, 5)
    expect(result[1]).toBeCloseTo(0, 5)
  })

  test('handles diagonal line correctly', () => {
    const coords = [
      [0, 0],
      [10, 10],
    ]
    const result = getPointAtFraction(coords, 0.5)
    expect(result[0]).toBeCloseTo(5, 5)
    expect(result[1]).toBeCloseTo(5, 5)
  })

  test('handles multi-segment line with different segment lengths', () => {
    // First segment: 10 units, Second segment: 20 units, Total: 30 units
    const coords = [
      [0, 0],
      [10, 0],
      [30, 0],
    ]

    // At 1/3 of total length (10 units), should be at end of first segment
    const result = getPointAtFraction(coords, 1 / 3)
    expect(result[0]).toBeCloseTo(10, 5)
    expect(result[1]).toBeCloseTo(0, 5)
  })

  test('handles position that falls within a segment (not at coordinate)', () => {
    // Segment from [0,0] to [100,0], position at 0.37 should give [37, 0]
    const coords = [
      [0, 0],
      [100, 0],
    ]
    const result = getPointAtFraction(coords, 0.37)
    expect(result[0]).toBeCloseTo(37, 5)
    expect(result[1]).toBeCloseTo(0, 5)
  })

  test('handles real-world coordinate scenario', () => {
    // Simulating a veglenke with WKT-like coordinates
    const coords = [
      [257471.921, 6650925.667],
      [257471.8, 6650931],
      [257475.566, 6650955.451],
    ]

    // Should be able to get a point at any fraction
    const result = getPointAtFraction(coords, 0.5)

    // Verify it's between the min and max x/y values
    expect(result[0]).toBeGreaterThanOrEqual(257471.8)
    expect(result[0]).toBeLessThanOrEqual(257475.566)
    expect(result[1]).toBeGreaterThanOrEqual(6650925.667)
    expect(result[1]).toBeLessThanOrEqual(6650955.451)
  })
})

describe('sliceLineStringByFraction', () => {
  test('returns full line for 0-1 fraction', () => {
    const coords = [
      [0, 0],
      [10, 0],
      [20, 0],
    ]
    const result = sliceLineStringByFraction(coords, 0, 1)
    expect(result).toEqual(coords)
  })

  test('returns first half for 0-0.5 fraction', () => {
    const coords = [
      [0, 0],
      [10, 0],
      [20, 0],
    ]
    const result = sliceLineStringByFraction(coords, 0, 0.5)
    expect(result.length).toBeGreaterThanOrEqual(2)
    expect(result[0]).toEqual([0, 0])
    expect(result[result.length - 1]?.[0]).toBeCloseTo(10, 5)
  })

  test('returns second half for 0.5-1 fraction', () => {
    const coords = [
      [0, 0],
      [10, 0],
      [20, 0],
    ]
    const result = sliceLineStringByFraction(coords, 0.5, 1)
    expect(result.length).toBeGreaterThanOrEqual(2)
    expect(result[0]?.[0]).toBeCloseTo(10, 5)
    expect(result[result.length - 1]).toEqual([20, 0])
  })
})

describe('getClippedGeometries', () => {
  test('returns clipped geometry for point stedfesting within veglenke range', () => {
    const veglenkesekvenser: VeglenkesekvensMedPosisjoner[] = [
      veglenkesekvens({
        id: 605710,
        veglenker: [
          veglenke({
            nummer: 19,
            startposisjon: 0.3552159,
            sluttposisjon: 0.39458101,
          }),
        ],
      }),
    ]

    const stedfesting: StedfestingPunkter = {
      type: 'StedfestingPunkter',
      punkter: [
        {
          id: 605710,
          posisjon: 0.3880223,
          retning: 'MED',
          sideposisjon: 'V',
          kjorefelt: [],
        },
      ],
    }

    const result = getClippedGeometries(stedfesting, veglenkesekvenser)

    expect(result.length).toBe(1)
    expect(result[0]?.veglenkesekvensId).toBe(605710)
    expect(result[0]?.veglenkeNummer).toBe(19)
    expect(result[0]?.startFraction).toBe(result[0]?.endFraction) // Point has same start/end

    // Fraction should be (0.3880223 - 0.3552159) / (0.39458101 - 0.3552159)
    const expectedFraction = (0.3880223 - 0.3552159) / (0.39458101 - 0.3552159)
    expect(result[0]?.startFraction).toBeCloseTo(expectedFraction, 5)
  })

  test('returns empty for point stedfesting outside veglenke range', () => {
    const veglenkesekvenser: VeglenkesekvensMedPosisjoner[] = [
      veglenkesekvens({
        id: 605710,
        veglenker: [veglenke({ nummer: 19, startposisjon: 0.5, sluttposisjon: 0.6 })],
      }),
    ]

    const stedfesting: StedfestingPunkter = {
      type: 'StedfestingPunkter',
      punkter: [
        {
          id: 605710,
          posisjon: 0.3880223,
          retning: 'MED',
          sideposisjon: 'V',
          kjorefelt: [],
        },
      ],
    }

    const result = getClippedGeometries(stedfesting, veglenkesekvenser)
    expect(result.length).toBe(0)
  })

  test('returns empty for point stedfesting on different veglenkesekvens', () => {
    const veglenkesekvenser: VeglenkesekvensMedPosisjoner[] = [
      veglenkesekvens({
        id: 999999,
        veglenker: [veglenke({ nummer: 1, startposisjon: 0, sluttposisjon: 1 })],
      }),
    ]

    const stedfesting: StedfestingPunkter = {
      type: 'StedfestingPunkter',
      punkter: [
        {
          id: 605710,
          posisjon: 0.5,
          retning: 'MED',
          sideposisjon: 'V',
          kjorefelt: [],
        },
      ],
    }

    const result = getClippedGeometries(stedfesting, veglenkesekvenser)
    expect(result.length).toBe(0)
  })

  test('excludes line overlap when sharing endpoint', () => {
    // Arrange
    const veglenkesekvenser: VeglenkesekvensMedPosisjoner[] = [
      veglenkesekvens({
        id: 123,
        veglenker: [veglenke({ nummer: 1, startposisjon: 0.4, sluttposisjon: 0.6 })],
      }),
    ]

    const stedfesting: StedfestingLinjer = {
      type: 'StedfestingLinjer',
      linjer: [
        {
          id: 123,
          startposisjon: 0.2,
          sluttposisjon: 0.4,
          retning: 'MED',
          sideposisjon: 'V',
          kjorefelt: [],
        },
      ],
    }

    // Act
    const result = getClippedGeometries(stedfesting, veglenkesekvenser)

    // Assert
    expect(result.length).toBe(0)
  })
})

describe('getLineStringOverlapFractions', () => {
  test('returns overlap for line crossing polygon', () => {
    // Arrange
    const polygon = new Polygon([
      [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
        [-0.5, -0.5],
      ],
    ])
    const coords = [
      [-1, 0],
      [1, 0],
    ]

    // Act
    const result = getLineStringOverlapFractions(coords, polygon)

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]?.startFraction).toBeCloseTo(0.25, 5)
    expect(result[0]?.endFraction).toBeCloseTo(0.75, 5)
  })

  test('returns empty when line is outside polygon', () => {
    // Arrange
    const polygon = new Polygon([
      [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
        [-0.5, -0.5],
      ],
    ])
    const coords = [
      [2, 0],
      [3, 0],
    ]

    // Act
    const result = getLineStringOverlapFractions(coords, polygon)

    // Assert
    expect(result.length).toBe(0)
  })
})

describe('clipVeglenkesekvenserToPolygon', () => {
  test('clips veglenke position ranges to the polygon overlap', () => {
    const polygon = new Polygon([
      [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
        [-0.5, -0.5],
      ],
    ])

    const veglenkesekvenser = [
      veglenkesekvens({
        id: 123,
        veglenker: [
          veglenke({
            nummer: 1,
            startposisjon: 0,
            sluttposisjon: 1,
            geometri: {
              wkt: 'LINESTRING(-1 0, 1 0)',
              srid: 25833,
            },
          } as VeglenkeMedPosisjon),
        ],
      }),
    ]

    const result = clipVeglenkesekvenserToPolygon(veglenkesekvenser, polygon)

    expect(result).toHaveLength(1)
    expect(result[0]?.veglenker).toHaveLength(1)
    expect(result[0]?.veglenker[0]?.startposisjon).toBeCloseTo(0.25, 5)
    expect(result[0]?.veglenker[0]?.sluttposisjon).toBeCloseTo(0.75, 5)
  })
})

describe('hasStedfestingOverlap', () => {
  test('returns false for vegobjekt on overlapping veglenke outside clipped polygon range', () => {
    const polygon = new Polygon([
      [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
        [-0.5, -0.5],
      ],
    ])

    const veglenkesekvenser = [
      veglenkesekvens({
        id: 123,
        veglenker: [
          veglenke({
            nummer: 1,
            startposisjon: 0,
            sluttposisjon: 1,
            geometri: {
              wkt: 'LINESTRING(-1 0, 1 0)',
              srid: 25833,
            },
          } as VeglenkeMedPosisjon),
        ],
      }),
    ]

    const overlapIndex = createVeglenkesekvensOverlapIndex(clipVeglenkesekvenserToPolygon(veglenkesekvenser, polygon))
    const stedfesting: StedfestingLinjer = {
      type: 'StedfestingLinjer',
      linjer: [
        {
          id: 123,
          startposisjon: 0,
          sluttposisjon: 0.1,
          retning: 'MED',
          sideposisjon: 'V',
          kjorefelt: [],
        },
      ],
    }

    expect(hasStedfestingOverlap(stedfesting, overlapIndex)).toBe(false)
  })

  test('returns true when vegobjekt overlaps the strekning ranges on a veglenkesekvens', () => {
    const overlapIndex = createVeglenkesekvensOverlapIndex([
      veglenkesekvens({
        id: 123,
        veglenker: [veglenke({ nummer: 1, startposisjon: 0.3, sluttposisjon: 0.6 })],
      }),
    ])

    const stedfesting: StedfestingLinjer = {
      type: 'StedfestingLinjer',
      linjer: [
        {
          id: 123,
          startposisjon: 0.55,
          sluttposisjon: 0.8,
          retning: 'MED',
          sideposisjon: 'V',
          kjorefelt: [],
        },
      ],
    }

    expect(hasStedfestingOverlap(stedfesting, overlapIndex)).toBe(true)
  })
})
