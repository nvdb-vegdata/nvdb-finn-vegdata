import { useQuery } from '@tanstack/react-query'
import { enrichVeglenkesekvenser, hentFiltrerteVeglenkesekvenserForVegsystemreferanse, hentVeglenkesekvenser } from '../api/uberiketClient'
import { DEFAULT_VEGLENKESEKVENSER_LIMIT } from '../state/atoms'

type VeglenkesekvenserParams = {
  polygonUtm33?: string | null
  vegsystemreferanse?: string | null
  veglenkesekvensIds?: number[] | null
  referenceDate?: string | null
  limit?: number
}

export function useVeglenkesekvenser({
  polygonUtm33,
  vegsystemreferanse,
  veglenkesekvensIds,
  referenceDate,
  limit = DEFAULT_VEGLENKESEKVENSER_LIMIT,
}: VeglenkesekvenserParams) {
  const trimmedStrekning = vegsystemreferanse?.trim() ?? ''
  const trimmedReferenceDate = referenceDate?.trim() ?? ''
  const normalizedIds = veglenkesekvensIds?.length ? [...veglenkesekvensIds].sort((a, b) => a - b) : null
  const enabled = Boolean(polygonUtm33) || trimmedStrekning.length > 0 || Boolean(normalizedIds?.length)

  return useQuery({
    queryKey: ['veglenkesekvenser', polygonUtm33, trimmedStrekning, limit, normalizedIds?.join(',') ?? null, trimmedStrekning ? trimmedReferenceDate : null],
    queryFn: async () => {
      if (trimmedStrekning) {
        return hentFiltrerteVeglenkesekvenserForVegsystemreferanse({
          antall: limit,
          dato: trimmedReferenceDate,
          vegsystemreferanse: trimmedStrekning,
        })
      }

      return hentVeglenkesekvenser({
        antall: limit,
        ider: normalizedIds ?? undefined,
        polygon: polygonUtm33 ?? undefined,
        vegsystemreferanse: trimmedStrekning || undefined,
      })
    },
    select: (response) => ({
      ...response,
      veglenkesekvenser: enrichVeglenkesekvenser(response.veglenkesekvenser),
    }),
    enabled,
  })
}
