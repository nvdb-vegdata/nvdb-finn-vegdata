import { useQuery } from '@tanstack/react-query'
import type { Polygon } from 'ol/geom'
import { useMemo, useState } from 'react'
import type { Vegobjekttype } from '../api/datakatalogClient'
import {
  hentVegobjekterStream,
  type Stedfesting,
  VEGOBJEKTER_STREAM_LIMIT,
  type VeglenkesekvensMedPosisjoner,
  type Vegobjekt,
  VegobjekterRequestError,
} from '../api/uberiketClient'
import { getTodayDate } from '../utils/dateUtils'
import { clipVeglenkesekvenserToPolygon, createVeglenkesekvensOverlapIndex, hasStedfestingOverlap } from '../utils/geometryUtils'

type VegobjekterParams = {
  selectedTypes: Vegobjekttype[]
  allTypesSelected: boolean
  polygonUtm33?: string | null
  polygon?: Polygon | null
  polygonClip?: boolean
  vegsystemreferanse?: string | null
  stedfestingFilterDirect?: string | null
  searchDate?: string | null
  veglenkesekvenser?: VeglenkesekvensMedPosisjoner[]
  veglenkesekvensLimitReached?: boolean
}

type VegobjekterPage = {
  vegobjekter: Vegobjekt[]
  warning?: string | null
}

export function useVegobjekter({
  selectedTypes,
  allTypesSelected,
  polygonUtm33,
  polygon,
  polygonClip = true,
  vegsystemreferanse,
  stedfestingFilterDirect,
  searchDate,
  veglenkesekvenser,
  veglenkesekvensLimitReached = false,
}: VegobjekterParams) {
  const trimmedPolygon = polygonUtm33?.trim() ?? ''
  const trimmedStrekning = vegsystemreferanse?.trim() ?? ''
  const trimmedSearchDate = searchDate?.trim() ?? ''
  const today = getTodayDate()
  const referenceDate = trimmedSearchDate.length > 0 ? trimmedSearchDate : today
  const directFilter = stedfestingFilterDirect?.trim() ?? ''
  const isPolygonSearch = trimmedPolygon.length > 0
  const isStrekningSearch = trimmedStrekning.length > 0
  const isStedfestingSearch = directFilter.length > 0
  const isStreamSearch = isPolygonSearch || isStrekningSearch || isStedfestingSearch
  const shouldFilterByOverlap = !veglenkesekvensLimitReached && (isStrekningSearch || (isPolygonSearch && polygonClip))
  const enabled = (allTypesSelected || selectedTypes.length > 0) && isStreamSearch
  const typeIds = useMemo(() => selectedTypes.map((type) => type.id).sort((a, b) => a - b), [selectedTypes])
  const typeIdList = useMemo(() => typeIds.join(','), [typeIds])

  const [streamingFetchedCount, setStreamingFetchedCount] = useState(0)
  const [isStreaming, setIsStreaming] = useState(false)

  const query = useQuery<VegobjekterPage>({
    queryFn: async ({ signal }) => {
      try {
        setStreamingFetchedCount(0)
        setIsStreaming(true)
        return await hentVegobjekterStream({
          typeIds: allTypesSelected ? undefined : typeIds,
          polygon: isPolygonSearch ? trimmedPolygon : undefined,
          vegsystemreferanse: isStrekningSearch ? trimmedStrekning : undefined,
          stedfesting: isStedfestingSearch ? directFilter : undefined,
          dato: referenceDate,
          signal,
          onProgress: setStreamingFetchedCount,
        })
      } catch (error) {
        const e = error as { status?: number; detail?: string; title?: string } | undefined
        const status = typeof e?.status === 'number' ? e.status : undefined
        const detail = typeof e?.detail === 'string' ? e.detail : undefined

        if (status || detail) {
          throw new VegobjekterRequestError(`Failed to fetch vegobjekter: ${e?.title ?? 'request failed'}`, status, detail)
        }

        const message = error instanceof Error ? error.message : String(error)
        throw new Error(message)
      } finally {
        setIsStreaming(false)
      }
    },
    queryKey: ['vegobjekter', allTypesSelected ? 'all' : typeIdList, trimmedPolygon, directFilter, trimmedStrekning, trimmedSearchDate || `today:${today}`],
    enabled,
  })

  const overlapVeglenkesekvenser = useMemo(() => {
    if (!shouldFilterByOverlap || !veglenkesekvenser) return null
    if (isPolygonSearch) {
      return polygon ? clipVeglenkesekvenserToPolygon(veglenkesekvenser, polygon) : []
    }
    return veglenkesekvenser
  }, [isPolygonSearch, polygon, shouldFilterByOverlap, veglenkesekvenser])

  const overlapIndex = useMemo(() => {
    if (!overlapVeglenkesekvenser) return null
    return createVeglenkesekvensOverlapIndex(overlapVeglenkesekvenser)
  }, [overlapVeglenkesekvenser])

  const rawVegobjekter = query.data?.vegobjekter ?? []
  const allVegobjekter = useMemo(() => {
    if (!shouldFilterByOverlap) return rawVegobjekter
    if (!overlapIndex) return []
    return rawVegobjekter.filter((vegobjekt) => hasStedfestingOverlap(vegobjekt.stedfesting as Stedfesting | undefined, overlapIndex))
  }, [overlapIndex, rawVegobjekter, shouldFilterByOverlap])
  const streamWarning = query.data?.warning ?? null
  const vegobjekterByType = new Map<number, Vegobjekt[]>(selectedTypes.map((type) => [type.id, [] as Vegobjekt[]]))

  for (const vegobjekt of allVegobjekter) {
    const list = vegobjekterByType.get(vegobjekt.typeId)
    if (list) {
      list.push(vegobjekt)
    } else {
      vegobjekterByType.set(vegobjekt.typeId, [vegobjekt])
    }
  }

  const error = useMemo(() => {
    if (!query.error) return null
    if (query.error instanceof Error) return query.error
    const e = query.error as { detail?: string; title?: string; status?: number } | undefined
    const message = e?.detail ?? e?.title ?? 'Kunne ikke hente vegobjekter. Prv igjen senere.'
    return new Error(message)
  }, [query.error])

  return {
    vegobjekterByType,
    outsidePolygonCount: isPolygonSearch && shouldFilterByOverlap ? Math.max(0, rawVegobjekter.length - allVegobjekter.length) : 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error,
    isStreaming,
    streamingFetchedCount,
    streamWarning,
    resultLimitReached: rawVegobjekter.length >= VEGOBJEKTER_STREAM_LIMIT,
    resultLimitMessage: isPolygonSearch
      ? 'Resultatet traff grensen på 10 000 vegobjekter. Tegn et mindre område for å hente alle.'
      : isStrekningSearch
        ? 'Resultatet traff grensen på 10 000 vegobjekter. Bruk en kortere strekning for å hente alle.'
        : isStedfestingSearch
          ? 'Resultatet traff grensen på 10 000 vegobjekter. Bruk færre stedfestinger eller smalere utstrekninger for å hente alle.'
          : null,
  }
}
