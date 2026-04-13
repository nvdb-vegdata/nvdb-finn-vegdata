import { isEmpty as isExtentEmpty } from 'ol/extent'
import Feature from 'ol/Feature'
import WKT from 'ol/format/WKT'
import { LineString, Point, type Polygon } from 'ol/geom'
import type OLMap from 'ol/Map'
import type VectorSource from 'ol/source/Vector'
import type { MutableRefObject } from 'react'
import { useEffect } from 'react'
import type { VeglenkeMedPosisjon, VeglenkesekvensMedPosisjoner } from '../api/uberiketClient'
import type { SearchMode } from '../state/atoms'
import { isDateWithinGyldighetsperiode } from '../utils/dateUtils'
import { getLineStringOverlapFractions, getPointAtFraction, sliceLineStringByFraction } from '../utils/geometryUtils'
import { parseStedfestingRanges } from '../utils/stedfestingParser'

export function useVeglenkeRendering({
  veglenkesekvenser,
  searchMode,
  stedfesting,
  polygonClip,
  referenceDate,
  veglenkeSource,
  stedfestingSource,
  drawSource,
  mapInstance,
}: {
  veglenkesekvenser: VeglenkesekvensMedPosisjoner[] | undefined
  searchMode: SearchMode
  stedfesting: string
  polygonClip: boolean
  referenceDate: string
  veglenkeSource: MutableRefObject<VectorSource>
  stedfestingSource: MutableRefObject<VectorSource>
  drawSource: MutableRefObject<VectorSource>
  mapInstance: MutableRefObject<OLMap | null>
}) {
  useEffect(() => {
    if (!veglenkesekvenser) {
      veglenkeSource.current.clear()
      stedfestingSource.current.clear()
      return
    }

    veglenkeSource.current.clear()
    stedfestingSource.current.clear()
    const wktFormat = new WKT()

    const drawnFeatures = drawSource.current.getFeatures()
    const drawnGeometry = drawnFeatures.length > 0 ? drawnFeatures[0]?.getGeometry() : null
    const polygonGeometry =
      searchMode === 'polygon' && polygonClip && drawnGeometry && drawnGeometry.getType() === 'Polygon' ? (drawnGeometry as Polygon) : null

    const stedfestingRangesById =
      (searchMode === 'stedfesting' || searchMode === 'vegsystemreferanse') && stedfesting.trim().length > 0
        ? parseStedfestingRanges(stedfesting).reduce((map, range) => {
            const existing = map.get(range.id)
            if (existing) {
              existing.push(range)
            } else {
              map.set(range.id, [range])
            }
            return map
          }, new Map<number, { start: number; end: number }[]>())
        : null

    const withClippedPositions = (veglenke: VeglenkeMedPosisjon, startposisjon: number, sluttposisjon: number): VeglenkeMedPosisjon => {
      return {
        ...veglenke,
        startposisjon,
        sluttposisjon,
      }
    }

    for (const vs of veglenkesekvenser) {
      for (const vl of vs.veglenker ?? []) {
        if (!isDateWithinGyldighetsperiode(referenceDate, vl.gyldighetsperiode)) {
          continue
        }

        if (vl.geometri?.wkt) {
          try {
            const geom = wktFormat.readGeometry(vl.geometri.wkt, {
              dataProjection: `EPSG:${vl.geometri.srid}`,
              featureProjection: 'EPSG:25833',
            })

            if (drawnGeometry && !geom.intersectsExtent(drawnGeometry.getExtent())) {
              continue
            }

            const isLineString = geom.getType() === 'LineString'
            const lineCoords = isLineString ? (geom as LineString).getCoordinates() : null
            const polygonOverlapFractions = polygonGeometry && lineCoords ? getLineStringOverlapFractions(lineCoords, polygonGeometry) : null

            if (polygonGeometry && isLineString && polygonOverlapFractions && polygonOverlapFractions.length === 0) {
              continue
            }

            if (polygonGeometry && geom.getType() === 'Point') {
              const point = (geom as Point).getCoordinates()
              if (!polygonGeometry.containsXY(point[0] ?? 0, point[1] ?? 0)) {
                continue
              }
            }

            let ranges: { start: number; end: number }[] | undefined
            if (stedfestingRangesById) {
              ranges = stedfestingRangesById.get(vs.id)
              if (!ranges) continue
              const overlaps = ranges.some((range) => range.end >= vl.startposisjon && range.start <= vl.sluttposisjon)
              if (!overlaps) continue
            }

            const feature = new Feature({
              geometry: geom,
              veglenkesekvensId: vs.id,
              veglenke: vl,
            })
            veglenkeSource.current.addFeature(feature)

            if (ranges && lineCoords) {
              const span = vl.sluttposisjon - vl.startposisjon
              if (span <= 0) continue

              for (const range of ranges) {
                const clippedStart = Math.max(range.start, vl.startposisjon)
                const clippedEnd = Math.min(range.end, vl.sluttposisjon)
                if (clippedEnd < clippedStart) continue

                const startFraction = (clippedStart - vl.startposisjon) / span
                const endFraction = (clippedEnd - vl.startposisjon) / span

                if (startFraction === endFraction) {
                  const pointCoord = getPointAtFraction(lineCoords, startFraction)
                  const pointGeom = new Point(pointCoord)
                  const clippedVeglenke = withClippedPositions(vl as VeglenkeMedPosisjon, clippedStart, clippedEnd)
                  stedfestingSource.current.addFeature(new Feature({ geometry: pointGeom, veglenkesekvensId: vs.id, veglenke: clippedVeglenke }))
                  continue
                }

                const slicedCoords = sliceLineStringByFraction(lineCoords, startFraction, endFraction)

                if (slicedCoords.length >= 2) {
                  const slicedGeom = new LineString(slicedCoords)
                  const clippedVeglenke = withClippedPositions(vl as VeglenkeMedPosisjon, clippedStart, clippedEnd)
                  stedfestingSource.current.addFeature(new Feature({ geometry: slicedGeom, veglenkesekvensId: vs.id, veglenke: clippedVeglenke }))
                }
              }
            }

            if (polygonOverlapFractions && lineCoords) {
              const span = vl.sluttposisjon - vl.startposisjon
              if (span <= 0) continue

              for (const overlap of polygonOverlapFractions) {
                const clippedStart = vl.startposisjon + span * overlap.startFraction
                const clippedEnd = vl.startposisjon + span * overlap.endFraction

                if (overlap.startFraction === overlap.endFraction) {
                  const pointCoord = getPointAtFraction(lineCoords, overlap.startFraction)
                  const pointGeom = new Point(pointCoord)
                  const clippedVeglenke = withClippedPositions(vl as VeglenkeMedPosisjon, clippedStart, clippedEnd)
                  stedfestingSource.current.addFeature(new Feature({ geometry: pointGeom, veglenkesekvensId: vs.id, veglenke: clippedVeglenke }))
                  continue
                }

                const slicedCoords = sliceLineStringByFraction(lineCoords, overlap.startFraction, overlap.endFraction)

                if (slicedCoords.length >= 2) {
                  const slicedGeom = new LineString(slicedCoords)
                  const clippedVeglenke = withClippedPositions(vl as VeglenkeMedPosisjon, clippedStart, clippedEnd)
                  stedfestingSource.current.addFeature(new Feature({ geometry: slicedGeom, veglenkesekvensId: vs.id, veglenke: clippedVeglenke }))
                }
              }
            }
          } catch (e) {
            console.warn('Failed to parse geometry', e)
          }
        }
      }
    }

    const clippedExtent = stedfestingSource.current.getExtent()
    const baseExtent = veglenkeSource.current.getExtent()
    const polygonExtent = searchMode === 'polygon' ? drawnGeometry?.getExtent() : null
    const extent = polygonExtent && !isExtentEmpty(polygonExtent) ? polygonExtent : !isExtentEmpty(clippedExtent) ? clippedExtent : baseExtent
    if (mapInstance.current && !isExtentEmpty(extent)) {
      mapInstance.current.getView().fit(extent, {
        padding: [40, 40, 40, 40],
        duration: 250,
        maxZoom: 18,
      })
    }
  }, [veglenkesekvenser, searchMode, stedfesting, polygonClip, referenceDate, veglenkeSource, stedfestingSource, drawSource, mapInstance])
}
