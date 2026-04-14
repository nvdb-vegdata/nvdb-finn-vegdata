import { describe, expect, test } from 'bun:test'
import type { Veglenkesegment } from './vegnettSegmentertClient'
import { clipSegmentPositions, segmenteringToStedfesting } from './vegnettSegmentertClient'

function makeSegment(
  id: number,
  startposisjon: number,
  sluttposisjon: number,
  fra_meter: number,
  til_meter: number,
  retning: 'MED' | 'MOT' = 'MED',
): Veglenkesegment {
  return {
    veglenkesekvensid: id,
    href: '',
    metadata: { startdato: '2020-01-01' },
    startposisjon,
    sluttposisjon,
    kortform: '',
    veglenkenummer: 1,
    segmentnummer: 1,
    startnode: '',
    sluttnode: '',
    referanse: '',
    type: 'Linje',
    detaljnivå: 'Vegtrase',
    typeVeg: 'Enkel bilveg',
    typeVeg_sosi: 'enkelBilveg',
    målemetode: 'Metrert',
    geometri: { wkt: '', srid: 5973, kvalitet: {} },
    lengde: til_meter - fra_meter,
    fylke: 3,
    kommune: 301,
    topologinivå: 'Vegtrase',
    vegsystemreferanse: {
      vegsystem: { vegkategori: 'E', fase: 'V', nummer: 18 },
      strekning: {
        strekning: 30,
        delstrekning: 1,
        arm: false,
        adskilte_løp: 'Nei',
        trafikantgruppe: 'K',
        retning,
        fra_meter,
        til_meter,
      },
    },
  } as unknown as Veglenkesegment
}

describe('clipSegmentPositions', () => {
  describe('MED direction', () => {
    test('clips start of segment', () => {
      // Segment covers m0-400, positions 0.0-0.4. Request m100-400.
      const seg = makeSegment(1, 0.0, 0.4, 0, 400, 'MED')
      const result = clipSegmentPositions(seg, { fra: 100, til: 400 })
      expect(result).not.toBeNull()
      expect(result!.start).toBeCloseTo(0.1)
      expect(result!.end).toBeCloseTo(0.4)
    })

    test('clips end of segment', () => {
      // Segment covers m0-400, positions 0.0-0.4. Request m0-200.
      const seg = makeSegment(1, 0.0, 0.4, 0, 400, 'MED')
      const result = clipSegmentPositions(seg, { fra: 0, til: 200 })
      expect(result).not.toBeNull()
      expect(result!.start).toBeCloseTo(0.0)
      expect(result!.end).toBeCloseTo(0.2)
    })

    test('clips both ends', () => {
      // Segment covers m0-400, positions 0.0-0.4. Request m100-200.
      const seg = makeSegment(1, 0.0, 0.4, 0, 400, 'MED')
      const result = clipSegmentPositions(seg, { fra: 100, til: 200 })
      expect(result).not.toBeNull()
      expect(result!.start).toBeCloseTo(0.1)
      expect(result!.end).toBeCloseTo(0.2)
    })

    test('returns null when requested range is fully outside segment', () => {
      const seg = makeSegment(1, 0.0, 0.4, 0, 400, 'MED')
      const result = clipSegmentPositions(seg, { fra: 500, til: 600 })
      expect(result).toBeNull()
    })
  })

  describe('MOT direction', () => {
    test('clips a MOT segment correctly — EV18S30D1m100-200 scenario', () => {
      // Segment covers m0-408, positions 0.36-0.58. Retning MOT.
      // At startposisjon=0.36 → til_meter=408; at sluttposisjon=0.58 → fra_meter=0.
      // Request m100-200.
      // position(meter) = 0.36 + (408 - meter) / 408 * (0.58 - 0.36)
      // position(200) = 0.36 + (208/408) * 0.22 ≈ 0.36 + 0.1122 ≈ 0.4722
      // position(100) = 0.36 + (308/408) * 0.22 ≈ 0.36 + 0.1661 ≈ 0.5261
      // clippedStart = position(clippedMeterTil=200) ≈ 0.4722
      // clippedEnd   = position(clippedMeterFra=100) ≈ 0.5261
      const seg = makeSegment(1, 0.36, 0.58, 0, 408, 'MOT')
      const result = clipSegmentPositions(seg, { fra: 100, til: 200 })
      expect(result).not.toBeNull()
      expect(result!.start).toBeCloseTo(0.36 + ((408 - 200) / 408) * (0.58 - 0.36), 5)
      expect(result!.end).toBeCloseTo(0.36 + ((408 - 100) / 408) * (0.58 - 0.36), 5)
      expect(result!.start).toBeLessThan(result!.end)
    })

    test('returns full segment positions when requested range covers entire segment (MOT)', () => {
      const seg = makeSegment(1, 0.36, 0.58, 0, 408, 'MOT')
      const result = clipSegmentPositions(seg, { fra: 0, til: 408 })
      expect(result).not.toBeNull()
      expect(result!.start).toBeCloseTo(0.36)
      expect(result!.end).toBeCloseTo(0.58)
    })

    test('returns null when requested range is fully outside MOT segment', () => {
      const seg = makeSegment(1, 0.36, 0.58, 0, 408, 'MOT')
      const result = clipSegmentPositions(seg, { fra: 500, til: 600 })
      expect(result).toBeNull()
    })
  })
})

describe('segmenteringToStedfesting', () => {
  test('handles MOT segment without meter range (no clipping)', () => {
    const seg = makeSegment(1672711, 0.36, 0.58, 0, 408, 'MOT')
    const { veglenkesekvensIds, stedfestingFilter } = segmenteringToStedfesting([seg], null, null, null)
    expect(veglenkesekvensIds).toEqual([1672711])
    expect(stedfestingFilter).toBe('0.36-0.58@1672711')
  })

  test('clips MOT segment with meter range and produces correct stedfesting', () => {
    const seg = makeSegment(1672711, 0.36, 0.58, 0, 408, 'MOT')
    const { stedfestingFilter } = segmenteringToStedfesting([seg], { fra: 100, til: 200 }, null, null)
    const expectedStart = 0.36 + ((408 - 200) / 408) * (0.58 - 0.36)
    const expectedEnd = 0.36 + ((408 - 100) / 408) * (0.58 - 0.36)
    expect(stedfestingFilter).toBe(`${expectedStart}-${expectedEnd}@1672711`)
  })
})
