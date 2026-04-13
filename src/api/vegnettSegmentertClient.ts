import './apiConfig'
import type { MeterRange } from '../utils/vegsystemreferanseValidator'
import { getVeglenkesegmenter } from './generated/vegnett/sdk.gen'
import type { Veglenkesegment, VeglenkesegmenterSide } from './generated/vegnett/types.gen'

export type { Veglenkesegment, VeglenkesegmenterSide }

export const SEGMENTERING_LIMIT = 1000

function mergeRanges(ranges: { start: number; end: number }[]): { start: number; end: number }[] {
  if (ranges.length === 0) return []
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const merged: { start: number; end: number }[] = []
  let current = { ...sorted[0]! }
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]!
    if (next.start <= current.end) {
      current.end = Math.max(current.end, next.end)
    } else {
      merged.push(current)
      current = { ...next }
    }
  }
  merged.push(current)
  return merged
}

export function clipSegmentPositions(segment: Veglenkesegment, requestedMeterRange: MeterRange): { start: number; end: number } | null {
  const strekning = segment.vegsystemreferanse.strekning
  const segMeterFra = strekning?.fra_meter
  const segMeterTil = strekning?.til_meter

  if (segMeterFra === undefined || segMeterTil === undefined) {
    return { start: segment.startposisjon, end: segment.sluttposisjon }
  }

  const meterSpan = segMeterTil - segMeterFra
  if (meterSpan <= 0) {
    return { start: segment.startposisjon, end: segment.sluttposisjon }
  }

  const clippedMeterFra = Math.max(requestedMeterRange.fra, segMeterFra)
  const clippedMeterTil = Math.min(requestedMeterRange.til, segMeterTil)

  if (clippedMeterFra > clippedMeterTil) return null

  const posSpan = segment.sluttposisjon - segment.startposisjon
  const retning = strekning?.retning

  if (retning === 'MOT') {
    // For MOT direction: startposisjon ↔ til_meter, sluttposisjon ↔ fra_meter
    // position(meter) = startposisjon + (til_meter - meter) / meterSpan * posSpan
    const clippedStart = segment.startposisjon + ((segMeterTil - clippedMeterTil) / meterSpan) * posSpan
    const clippedEnd = segment.startposisjon + ((segMeterTil - clippedMeterFra) / meterSpan) * posSpan
    return { start: clippedStart, end: clippedEnd }
  }

  // MED direction (default): startposisjon ↔ fra_meter, sluttposisjon ↔ til_meter
  const clippedStart = segment.startposisjon + ((clippedMeterFra - segMeterFra) / meterSpan) * posSpan
  const clippedEnd = segment.startposisjon + ((clippedMeterTil - segMeterFra) / meterSpan) * posSpan

  return { start: clippedStart, end: clippedEnd }
}

export function segmenteringToStedfesting(
  segmenter: Veglenkesegment[],
  requestedMeterRange: MeterRange | null = null,
): {
  veglenkesekvensIds: number[]
  stedfestingFilter: string
} {
  const rangesBySekvens = new Map<number, { start: number; end: number }[]>()

  for (const segment of segmenter) {
    const clipped = requestedMeterRange ? clipSegmentPositions(segment, requestedMeterRange) : { start: segment.startposisjon, end: segment.sluttposisjon }

    if (!clipped) continue

    const existing = rangesBySekvens.get(segment.veglenkesekvensid)
    if (existing) {
      existing.push(clipped)
    } else {
      rangesBySekvens.set(segment.veglenkesekvensid, [clipped])
    }
  }

  const veglenkesekvensIds: number[] = []
  const filterParts: string[] = []

  for (const [id, ranges] of rangesBySekvens) {
    veglenkesekvensIds.push(id)
    for (const range of mergeRanges(ranges)) {
      filterParts.push(`${range.start}-${range.end}@${id}`)
    }
  }

  return { veglenkesekvensIds, stedfestingFilter: filterParts.join(',') }
}

export async function hentSegmenterteVeglenkerForVegsystemreferanse(vegsystemreferanse: string): Promise<VeglenkesegmenterSide> {
  const response = await getVeglenkesegmenter({
    query: {
      vegsystemreferanse: [vegsystemreferanse],
      antall: SEGMENTERING_LIMIT,
    },
  })

  if (response.error) {
    throw new Error(`Kunne ikke hente segmentert vegnett: ${JSON.stringify(response.error)}`)
  }

  return response.data as VeglenkesegmenterSide
}
