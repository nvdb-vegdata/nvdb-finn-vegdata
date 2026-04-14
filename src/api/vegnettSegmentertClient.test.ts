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

function makeKryssdelSegment(
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
      kryssystem: {
        kryssystem: 1,
        kryssdel: 1,
        retning,
        fra_meter,
        til_meter,
      },
    },
  } as unknown as Veglenkesegment
}

function makeSideanleggSegment(
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
      sideanlegg: {
        sideanlegg: 1,
        sideanleggsdel: 1,
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

describe('clipSegmentPositions – kryssdel', () => {
  test('clips MED kryssdel segment correctly', () => {
    // Segment covers m0-200, positions 0.0-0.5. Request m50-150.
    const seg = makeKryssdelSegment(2000001, 0.0, 0.5, 0, 200, 'MED')
    const result = clipSegmentPositions(seg, { fra: 50, til: 150 })
    expect(result).not.toBeNull()
    expect(result!.start).toBeCloseTo(0.125) // 0.0 + (50/200)*0.5
    expect(result!.end).toBeCloseTo(0.375) // 0.0 + (150/200)*0.5
  })

  test('clips MOT kryssdel segment correctly', () => {
    // Segment covers m0-200, positions 0.0-0.5. Retning MOT. Request m50-150.
    // position(meter) = 0.0 + (200 - meter) / 200 * 0.5
    // clippedStart = position(150) = (50/200)*0.5 = 0.125
    // clippedEnd   = position(50)  = (150/200)*0.5 = 0.375
    const seg = makeKryssdelSegment(2000001, 0.0, 0.5, 0, 200, 'MOT')
    const result = clipSegmentPositions(seg, { fra: 50, til: 150 })
    expect(result).not.toBeNull()
    expect(result!.start).toBeCloseTo(0.125)
    expect(result!.end).toBeCloseTo(0.375)
    expect(result!.start).toBeLessThan(result!.end)
  })

  test('returns null when requested range is fully outside kryssdel segment', () => {
    const seg = makeKryssdelSegment(2000001, 0.0, 0.5, 0, 200, 'MED')
    const result = clipSegmentPositions(seg, { fra: 300, til: 400 })
    expect(result).toBeNull()
  })
})

describe('clipSegmentPositions – sideanlegg', () => {
  test('clips MED sideanlegg segment correctly', () => {
    // Segment covers m0-100, positions 0.2-0.7. Request m25-75.
    // clippedStart = 0.2 + (25/100)*0.5 = 0.325
    // clippedEnd   = 0.2 + (75/100)*0.5 = 0.575
    const seg = makeSideanleggSegment(3000001, 0.2, 0.7, 0, 100, 'MED')
    const result = clipSegmentPositions(seg, { fra: 25, til: 75 })
    expect(result).not.toBeNull()
    expect(result!.start).toBeCloseTo(0.325)
    expect(result!.end).toBeCloseTo(0.575)
  })

  test('clips MOT sideanlegg segment correctly', () => {
    // Segment covers m0-100, positions 0.2-0.7. Retning MOT. Request m25-75.
    // position(meter) = 0.2 + (100 - meter) / 100 * 0.5
    // clippedStart = position(75) = 0.2 + (25/100)*0.5 = 0.325
    // clippedEnd   = position(25) = 0.2 + (75/100)*0.5 = 0.575
    const seg = makeSideanleggSegment(3000001, 0.2, 0.7, 0, 100, 'MOT')
    const result = clipSegmentPositions(seg, { fra: 25, til: 75 })
    expect(result).not.toBeNull()
    expect(result!.start).toBeCloseTo(0.325)
    expect(result!.end).toBeCloseTo(0.575)
    expect(result!.start).toBeLessThan(result!.end)
  })

  test('returns null when requested range is fully outside sideanlegg segment', () => {
    const seg = makeSideanleggSegment(3000001, 0.2, 0.7, 0, 100, 'MED')
    const result = clipSegmentPositions(seg, { fra: 200, til: 300 })
    expect(result).toBeNull()
  })
})

describe('segmenteringToStedfesting – kryssdel og sideanlegg', () => {
  test('kryssdel segment is not clipped when kryssdelMeterRange is null', () => {
    const seg = makeKryssdelSegment(2000001, 0.0, 0.5, 0, 200, 'MED')
    const { veglenkesekvensIds, stedfestingFilter } = segmenteringToStedfesting([seg], null, null, null)
    expect(veglenkesekvensIds).toEqual([2000001])
    expect(stedfestingFilter).toBe('0-0.5@2000001')
  })

  test('kryssdel segment is clipped using kryssdelMeterRange, not strekningMeterRange', () => {
    const seg = makeKryssdelSegment(2000001, 0.0, 0.5, 0, 200, 'MED')
    // strekningMeterRange should be ignored for kryssystem segments
    const { stedfestingFilter } = segmenteringToStedfesting([seg], { fra: 0, til: 50 }, { fra: 50, til: 150 }, null)
    const expectedStart = 0.0 + (50 / 200) * 0.5
    const expectedEnd = 0.0 + (150 / 200) * 0.5
    expect(stedfestingFilter).toBe(`${expectedStart}-${expectedEnd}@2000001`)
  })

  test('sideanlegg segment is not clipped when sideanleggMeterRange is null', () => {
    const seg = makeSideanleggSegment(3000001, 0.2, 0.7, 0, 100, 'MED')
    const { veglenkesekvensIds, stedfestingFilter } = segmenteringToStedfesting([seg], null, null, null)
    expect(veglenkesekvensIds).toEqual([3000001])
    expect(stedfestingFilter).toBe('0.2-0.7@3000001')
  })

  test('sideanlegg segment is clipped using sideanleggMeterRange, not strekningMeterRange', () => {
    const seg = makeSideanleggSegment(3000001, 0.2, 0.7, 0, 100, 'MED')
    // strekningMeterRange and kryssdelMeterRange should be ignored for sideanlegg segments
    const { stedfestingFilter } = segmenteringToStedfesting([seg], { fra: 0, til: 10 }, { fra: 0, til: 10 }, { fra: 25, til: 75 })
    const expectedStart = 0.2 + (25 / 100) * 0.5
    const expectedEnd = 0.2 + (75 / 100) * 0.5
    expect(stedfestingFilter).toBe(`${expectedStart}-${expectedEnd}@3000001`)
  })

  test('mixed strekning and kryssdel segments each use their own meter range', () => {
    const strekSeg = makeSegment(1000001, 0.0, 0.4, 0, 400, 'MED')
    const kryssdelSeg = makeKryssdelSegment(2000001, 0.0, 0.5, 0, 200, 'MED')
    const { stedfestingFilter } = segmenteringToStedfesting(
      [strekSeg, kryssdelSeg],
      { fra: 100, til: 300 }, // clips strekning segment
      { fra: 50, til: 150 }, // clips kryssdel segment
      null,
    )
    const strekStart = 0.0 + (100 / 400) * 0.4 // 0.1
    const strekEnd = 0.0 + (300 / 400) * 0.4 // 0.3
    const kryssStart = 0.0 + (50 / 200) * 0.5 // 0.125
    const kryssEnd = 0.0 + (150 / 200) * 0.5 // 0.375
    expect(stedfestingFilter).toContain(`${strekStart}-${strekEnd}@1000001`)
    expect(stedfestingFilter).toContain(`${kryssStart}-${kryssEnd}@2000001`)
  })
})
