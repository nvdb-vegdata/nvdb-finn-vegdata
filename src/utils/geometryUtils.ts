import WKT from 'ol/format/WKT'
import type { LineString, Point, Polygon } from 'ol/geom'
import type { Stedfesting, VeglenkesekvensMedPosisjoner } from '../api/uberiketClient'
import { getVegobjektPositions } from '../api/uberiketClient'

export interface ClippedGeometry {
  veglenkesekvensId: number
  veglenkeNummer: number
  startFraction: number
  endFraction: number
}

function rangesOverlap(range1Start: number, range1End: number, range2Start: number, range2End: number): { overlapStart: number; overlapEnd: number } | null {
  const overlapStart = Math.max(range1Start, range2Start)
  const overlapEnd = Math.min(range1End, range2End)

  if (overlapStart >= overlapEnd) {
    return null
  }

  return { overlapStart, overlapEnd }
}

function pointInRange(point: number, rangeStart: number, rangeEnd: number): boolean {
  return point >= rangeStart && point <= rangeEnd
}

export function getClippedGeometries(stedfesting: Stedfesting | undefined, veglenkesekvenser: VeglenkesekvensMedPosisjoner[]): ClippedGeometry[] {
  if (!stedfesting) return []

  const results: ClippedGeometry[] = []

  for (const vs of veglenkesekvenser) {
    const positions = getVegobjektPositions(stedfesting, vs.id)
    if (positions.length === 0) continue

    for (const pos of positions) {
      const isPoint = pos.start === pos.slutt

      for (const vl of vs.veglenker) {
        const vlLength = vl.sluttposisjon - vl.startposisjon
        if (vlLength === 0) continue

        if (isPoint) {
          if (pointInRange(pos.start, vl.startposisjon, vl.sluttposisjon)) {
            const fraction = (pos.start - vl.startposisjon) / vlLength
            results.push({
              veglenkesekvensId: vs.id,
              veglenkeNummer: vl.nummer,
              startFraction: fraction,
              endFraction: fraction,
            })
          }
        } else {
          const overlap = rangesOverlap(vl.startposisjon, vl.sluttposisjon, pos.start, pos.slutt)

          if (overlap) {
            const startFraction = (overlap.overlapStart - vl.startposisjon) / vlLength
            const endFraction = (overlap.overlapEnd - vl.startposisjon) / vlLength

            results.push({
              veglenkesekvensId: vs.id,
              veglenkeNummer: vl.nummer,
              startFraction,
              endFraction,
            })
          }
        }
      }
    }
  }

  return results
}

function euclideanDistance(p1: number[], p2: number[]): number {
  const dx = (p2[0] ?? 0) - (p1[0] ?? 0)
  const dy = (p2[1] ?? 0) - (p1[1] ?? 0)
  return Math.sqrt(dx * dx + dy * dy)
}

function interpolatePoint(p1: number[], p2: number[], fraction: number): number[] {
  const x1 = p1[0] ?? 0
  const y1 = p1[1] ?? 0
  const x2 = p2[0] ?? 0
  const y2 = p2[1] ?? 0
  return [x1 + (x2 - x1) * fraction, y1 + (y2 - y1) * fraction]
}

function getLineLength(coords: number[][]): number {
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    total += euclideanDistance(coords[i - 1] as number[], coords[i] as number[])
  }
  return total
}

function getPointAtDistance(coords: number[][], targetDistance: number): number[] {
  let cumulativeLength = 0
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1] as number[]
    const curr = coords[i] as number[]
    const segmentLength = euclideanDistance(prev, curr)
    if (cumulativeLength + segmentLength >= targetDistance) {
      const remainingDistance = targetDistance - cumulativeLength
      const fraction = segmentLength > 0 ? remainingDistance / segmentLength : 0
      return interpolatePoint(prev, curr, fraction)
    }
    cumulativeLength += segmentLength
  }
  return coords[coords.length - 1] ?? [0, 0]
}

export function sliceLineStringByFraction(coords: number[][], startFraction: number, endFraction: number): number[][] {
  if (coords.length < 2) return coords
  if (startFraction <= 0 && endFraction >= 1) return coords

  const totalLength = getLineLength(coords)
  if (totalLength === 0) return coords

  const startDistance = startFraction * totalLength
  const endDistance = endFraction * totalLength

  const result: number[][] = []
  let cumulativeLength = 0
  let passedStart = false

  for (let i = 0; i < coords.length; i++) {
    const coord = coords[i] as number[]

    if (i === 0) {
      if (startFraction <= 0) {
        result.push(coord)
        passedStart = true
      }
      continue
    }

    const prevCoord = coords[i - 1] as number[]
    const segmentLength = euclideanDistance(prevCoord, coord)
    const prevCumulativeLength = cumulativeLength
    cumulativeLength += segmentLength

    if (!passedStart && cumulativeLength >= startDistance) {
      result.push(getPointAtDistance(coords, startDistance))
      passedStart = true
    }

    if (passedStart) {
      if (cumulativeLength < endDistance) {
        result.push(coord)
      } else {
        if (prevCumulativeLength < endDistance) {
          result.push(getPointAtDistance(coords, endDistance))
        }
        break
      }
    }
  }

  if (result.length < 2) {
    return [getPointAtDistance(coords, startDistance), getPointAtDistance(coords, endDistance)]
  }

  return result
}

export function getPointAtFraction(coords: number[][], fraction: number): number[] {
  if (coords.length < 2) return coords[0] ?? [0, 0]

  const totalLength = getLineLength(coords)
  if (totalLength === 0) return coords[0] ?? [0, 0]

  const targetDistance = fraction * totalLength
  return getPointAtDistance(coords, targetDistance)
}

type FractionRange = {
  startFraction: number
  endFraction: number
}

type PositionRange = {
  start: number
  end: number
}

type VeglenkesekvensOverlapIndex = Map<number, PositionRange[]>

const INTERSECTION_EPSILON = 1e-8

function lineSegmentIntersectionParam(p1: number[], p2: number[], p3: number[], p4: number[]): number | null {
  const x1 = p1[0] ?? 0
  const y1 = p1[1] ?? 0
  const x2 = p2[0] ?? 0
  const y2 = p2[1] ?? 0
  const x3 = p3[0] ?? 0
  const y3 = p3[1] ?? 0
  const x4 = p4[0] ?? 0
  const y4 = p4[1] ?? 0

  const denom = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3)
  if (Math.abs(denom) < INTERSECTION_EPSILON) return null

  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / denom
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / denom

  if (t < -INTERSECTION_EPSILON || t > 1 + INTERSECTION_EPSILON) return null
  if (u < -INTERSECTION_EPSILON || u > 1 + INTERSECTION_EPSILON) return null

  return Math.min(1, Math.max(0, t))
}

function dedupeSorted(values: number[]): number[] {
  const result: number[] = []
  for (const value of values) {
    const last = result[result.length - 1]
    if (last === undefined || Math.abs(value - last) > INTERSECTION_EPSILON) {
      result.push(value)
    }
  }
  return result
}

function mergeFractionRanges(ranges: FractionRange[]): FractionRange[] {
  if (ranges.length === 0) return []
  const sorted = ranges.slice().sort((a, b) => a.startFraction - b.startFraction)
  const merged: FractionRange[] = []
  const first = sorted[0]
  if (!first) return []
  let current = { ...first }

  for (let i = 1; i < sorted.length; i += 1) {
    const next = sorted[i]
    if (!next) continue
    if (next.startFraction <= current.endFraction + INTERSECTION_EPSILON) {
      current.endFraction = Math.max(current.endFraction, next.endFraction)
    } else {
      merged.push(current)
      current = { ...next }
    }
  }

  merged.push(current)
  return merged
}

export function getLineStringOverlapFractions(coords: number[][], polygon: Polygon): FractionRange[] {
  if (coords.length < 2) return []
  const totalLength = getLineLength(coords)
  if (totalLength === 0) return []

  const ring = polygon.getCoordinates()[0] ?? []
  if (ring.length < 2) return []

  const ranges: FractionRange[] = []
  let cumulativeLength = 0

  for (let i = 1; i < coords.length; i++) {
    const start = coords[i - 1] as number[]
    const end = coords[i] as number[]
    const segmentLength = euclideanDistance(start, end)
    if (segmentLength === 0) {
      continue
    }

    const intersections: number[] = [0, 1]
    for (let j = 1; j < ring.length; j++) {
      const edgeStart = ring[j - 1] as number[]
      const edgeEnd = ring[j] as number[]
      const t = lineSegmentIntersectionParam(start, end, edgeStart, edgeEnd)
      if (t !== null) {
        intersections.push(t)
      }
    }

    intersections.sort((a, b) => a - b)
    const uniqueIntersections = dedupeSorted(intersections)

    for (let j = 1; j < uniqueIntersections.length; j++) {
      const startT = uniqueIntersections[j - 1] ?? 0
      const endT = uniqueIntersections[j] ?? 0
      if (endT - startT <= INTERSECTION_EPSILON) continue

      const midPoint = interpolatePoint(start, end, (startT + endT) / 2)
      if (polygon.containsXY(midPoint[0] ?? 0, midPoint[1] ?? 0)) {
        const startDistance = cumulativeLength + segmentLength * startT
        const endDistance = cumulativeLength + segmentLength * endT
        const startFraction = Math.max(0, Math.min(1, startDistance / totalLength))
        const endFraction = Math.max(0, Math.min(1, endDistance / totalLength))
        if (endFraction - startFraction > INTERSECTION_EPSILON) {
          ranges.push({ startFraction, endFraction })
        }
      }
    }

    cumulativeLength += segmentLength
  }

  return mergeFractionRanges(ranges)
}

function mergePositionRanges(ranges: PositionRange[]): PositionRange[] {
  if (ranges.length === 0) return []

  const sorted = ranges
    .map((range) => ({
      start: Math.min(range.start, range.end),
      end: Math.max(range.start, range.end),
    }))
    .sort((a, b) => a.start - b.start)

  const merged: PositionRange[] = []
  let current = { ...sorted[0]! }

  for (let i = 1; i < sorted.length; i += 1) {
    const next = sorted[i]
    if (!next) continue

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

export function clipVeglenkesekvenserToPolygon(veglenkesekvenser: VeglenkesekvensMedPosisjoner[], polygon: Polygon): VeglenkesekvensMedPosisjoner[] {
  const wktFormat = new WKT()

  return veglenkesekvenser
    .map((vs) => {
      const clippedVeglenker = (vs.veglenker ?? []).flatMap((vl) => {
        if (!vl.geometri?.wkt) {
          return [vl]
        }

        try {
          const geom = wktFormat.readGeometry(vl.geometri.wkt, {
            dataProjection: `EPSG:${vl.geometri.srid}`,
            featureProjection: 'EPSG:25833',
          })

          if (!geom.intersectsExtent(polygon.getExtent())) {
            return []
          }

          if (geom.getType() === 'Point') {
            const point = (geom as Point).getCoordinates()
            return polygon.containsXY(point[0] ?? 0, point[1] ?? 0) ? [vl] : []
          }

          if (geom.getType() !== 'LineString') {
            return [vl]
          }

          const coords = (geom as LineString).getCoordinates()
          const overlapFractions = getLineStringOverlapFractions(coords, polygon)
          if (overlapFractions.length === 0) {
            return []
          }

          const span = vl.sluttposisjon - vl.startposisjon
          if (span <= 0) {
            return []
          }

          return overlapFractions.map((overlap) => ({
            ...vl,
            startposisjon: vl.startposisjon + span * overlap.startFraction,
            sluttposisjon: vl.startposisjon + span * overlap.endFraction,
          }))
        } catch (error) {
          console.warn('Failed to clip veglenke to polygon', error)
          return [vl]
        }
      })

      return {
        ...vs,
        veglenker: clippedVeglenker,
      }
    })
    .filter((vs) => vs.veglenker.length > 0)
}

export function createVeglenkesekvensOverlapIndex(veglenkesekvenser: VeglenkesekvensMedPosisjoner[]): VeglenkesekvensOverlapIndex {
  const index = new Map<number, PositionRange[]>()

  for (const vs of veglenkesekvenser) {
    const ranges = mergePositionRanges((vs.veglenker ?? []).map((vl) => ({ start: vl.startposisjon, end: vl.sluttposisjon })))
    if (ranges.length > 0) {
      index.set(vs.id, ranges)
    }
  }

  return index
}

function positionOverlapsRanges(position: PositionRange, ranges: PositionRange[] | undefined): boolean {
  if (!ranges || ranges.length === 0) return false

  const start = Math.min(position.start, position.end)
  const end = Math.max(position.start, position.end)

  if (start === end) {
    return ranges.some((range) => pointInRange(start, range.start, range.end))
  }

  return ranges.some((range) => rangesOverlap(range.start, range.end, start, end) !== null)
}

export function hasStedfestingOverlap(stedfesting: Stedfesting | undefined, veglenkesekvensOverlapIndex: VeglenkesekvensOverlapIndex): boolean {
  if (!stedfesting) return false

  switch (stedfesting.type) {
    case 'StedfestingLinjer':
      return stedfesting.linjer.some((linje) =>
        positionOverlapsRanges({ start: linje.startposisjon, end: linje.sluttposisjon }, veglenkesekvensOverlapIndex.get(linje.id)),
      )

    case 'StedfestingPunkter':
      return stedfesting.punkter.some((punkt) =>
        positionOverlapsRanges({ start: punkt.posisjon, end: punkt.posisjon }, veglenkesekvensOverlapIndex.get(punkt.id)),
      )

    case 'StedfestingSving':
      return (
        positionOverlapsRanges(
          { start: stedfesting.startpunkt.posisjon, end: stedfesting.startpunkt.posisjon },
          veglenkesekvensOverlapIndex.get(stedfesting.startpunkt.id),
        ) ||
        positionOverlapsRanges(
          { start: stedfesting.sluttpunkt.posisjon, end: stedfesting.sluttpunkt.posisjon },
          veglenkesekvensOverlapIndex.get(stedfesting.sluttpunkt.id),
        )
      )

    default:
      return false
  }
}
