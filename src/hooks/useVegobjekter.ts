import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import type { Vegobjekttype } from '../api/datakatalogClient'
import { hentVegobjekterMultiType } from '../api/generated/uberiket/sdk.gen'
import type { InkluderIVegobjekt } from '../api/generated/uberiket/types.gen'
import { hentVegobjekterStream, VEGOBJEKTER_STREAM_LIMIT, type Vegobjekt, VegobjekterRequestError } from '../api/uberiketClient'
import { getTodayDate } from '../utils/dateUtils'

type VegobjekterParams = {
  selectedTypes: Vegobjekttype[]
  allTypesSelected: boolean
  polygonUtm33?: string | null
  vegsystemreferanse?: string | null
  stedfestingFilterDirect?: string | null
  searchDate?: string | null
}

type VegobjekterPage = {
  vegobjekter: Vegobjekt[]
  warning?: string | null
  metadata?: {
    neste?: {
      start?: string
    }
  }
}

export function useVegobjekter({ selectedTypes, allTypesSelected, polygonUtm33, vegsystemreferanse, stedfestingFilterDirect, searchDate }: VegobjekterParams) {
  const trimmedPolygon = polygonUtm33?.trim() ?? ''
  const trimmedStrekning = vegsystemreferanse?.trim() ?? ''
  const trimmedSearchDate = searchDate?.trim() ?? ''
  const today = getTodayDate()
  const referenceDate = trimmedSearchDate.length > 0 ? trimmedSearchDate : today
  const directFilter = stedfestingFilterDirect?.trim() ?? ''
  const isPolygonSearch = trimmedPolygon.length > 0
  const isStrekningSearch = trimmedStrekning.length > 0
  const isStreamSearch = isPolygonSearch || isStrekningSearch
  const enabled = (allTypesSelected || selectedTypes.length > 0) && (isStreamSearch || directFilter.length > 0)
  const typeIds = useMemo(() => selectedTypes.map((type) => type.id).sort((a, b) => a - b), [selectedTypes])
  const typeIdList = useMemo(() => typeIds.join(','), [typeIds])

  const pagedQueryParams = useMemo(
    () => ({
      typeIder: allTypesSelected ? undefined : typeIds,
      antall: 1000,
      inkluder: ['alle'] as InkluderIVegobjekt[],
      dato: referenceDate,
      stedfesting: [directFilter],
    }),
    [allTypesSelected, directFilter, referenceDate, typeIds],
  )

  const [streamingFetchedCount, setStreamingFetchedCount] = useState(0)
  const [isStreaming, setIsStreaming] = useState(false)

  const query = useInfiniteQuery<VegobjekterPage>({
    queryFn: async ({ pageParam, signal }) => {
      try {
        if (isStreamSearch) {
          setStreamingFetchedCount(0)
          setIsStreaming(true)
          const streamResult = await hentVegobjekterStream({
            typeIds: allTypesSelected ? undefined : typeIds,
            polygon: isPolygonSearch ? trimmedPolygon : undefined,
            vegsystemreferanse: isStrekningSearch ? trimmedStrekning : undefined,
            dato: referenceDate,
            signal,
            onProgress: setStreamingFetchedCount,
          })

          return streamResult
        }

        let start: string | undefined
        if (typeof pageParam === 'string') {
          start = pageParam || undefined
        } else if (pageParam && typeof pageParam === 'object') {
          start = (pageParam as { query?: { start?: string } }).query?.start
        }
        const { data } = await hentVegobjekterMultiType({
          query: {
            ...pagedQueryParams,
            start,
          },
          signal,
          throwOnError: true,
        })
        return data
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
        if (isStreamSearch) {
          setIsStreaming(false)
        }
      }
    },
    queryKey: ['vegobjekter', allTypesSelected ? 'all' : typeIdList, trimmedPolygon, directFilter, trimmedStrekning, trimmedSearchDate || `today:${today}`],
    enabled,
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.metadata?.neste?.start,
  })

  const [isFetchingBatch, setIsFetchingBatch] = useState(false)
  const [isFetchingForCsv, setIsFetchingForCsv] = useState(false)

  const fetchNextBatch = useCallback(
    async (setLoading: (v: boolean) => void) => {
      if (isStreamSearch) return
      if (!query.hasNextPage) return
      setLoading(true)

      try {
        let loaded = 0
        let pages = query.data?.pages ?? []
        let hasNext: boolean = query.hasNextPage === true

        while (hasNext && loaded < 10000) {
          const previousPageCount = pages.length
          const result = await query.fetchNextPage()
          pages = result.data?.pages ?? pages
          const newPages = pages.slice(previousPageCount)
          loaded += newPages.reduce((sum, page) => sum + (page.vegobjekter?.length ?? 0), 0)
          hasNext = result.hasNextPage === true

          if (newPages.length === 0) break
        }
      } finally {
        setLoading(false)
      }
    },
    [isStreamSearch, query.data, query.fetchNextPage, query.hasNextPage],
  )

  const fetchMore = useCallback(async () => {
    if (isFetchingBatch) return
    await fetchNextBatch(setIsFetchingBatch)
  }, [isFetchingBatch, fetchNextBatch])

  const fetchForCsv = useCallback(async () => {
    if (isFetchingForCsv) return
    await fetchNextBatch(setIsFetchingForCsv)
  }, [isFetchingForCsv, fetchNextBatch])

  const vegobjekterByType = new Map<number, Vegobjekt[]>(selectedTypes.map((type) => [type.id, [] as Vegobjekt[]]))

  const allVegobjekter = query.data?.pages.flatMap((page) => page.vegobjekter) ?? []
  const streamWarning = isStreamSearch ? (query.data?.pages[0]?.warning ?? null) : null

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
    isLoading: query.isLoading,
    isError: query.isError,
    error,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: fetchMore,
    isFetchingNextPage: isFetchingBatch,
    fetchAllPages: fetchForCsv,
    isFetchingAll: isFetchingForCsv,
    isStreaming,
    streamingFetchedCount,
    streamWarning,
    resultLimitReached: isStreamSearch && allVegobjekter.length >= VEGOBJEKTER_STREAM_LIMIT,
    resultLimitMessage: isPolygonSearch
      ? 'Resultatet traff grensen på 10 000 vegobjekter. Tegn et mindre område for å hente alle.'
      : isStrekningSearch
        ? 'Resultatet traff grensen på 10 000 vegobjekter. Bruk en smalere strekning for å hente alle.'
        : null,
  }
}
