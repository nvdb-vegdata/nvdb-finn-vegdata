import { useQuery } from '@tanstack/react-query'
import { hentSegmenterteVeglenkerForVegsystemreferanse, SEGMENTERING_LIMIT, segmenteringToStedfesting } from '../api/vegnettSegmentertClient'
import {
  parseVegsystemreferanseMeter,
  parseVegsystemreferanseMeterKryssdel,
  parseVegsystemreferanseMeterSideanlegg,
} from '../utils/vegsystemreferanseValidator'

export function useVegsystemreferanseStedfesting(vegsystemreferanse: string | null) {
  const trimmed = vegsystemreferanse?.trim() ?? ''

  return useQuery({
    queryKey: ['segmentert-vegnett', trimmed],
    queryFn: async () => {
      const result = await hentSegmenterteVeglenkerForVegsystemreferanse(trimmed)
      const strekningMeterRange = parseVegsystemreferanseMeter(trimmed)
      const kryssdelMeterRange = parseVegsystemreferanseMeterKryssdel(trimmed)
      const sideanleggMeterRange = parseVegsystemreferanseMeterSideanlegg(trimmed)
      const stedfesting = segmenteringToStedfesting(result.objekter, strekningMeterRange, kryssdelMeterRange, sideanleggMeterRange)
      const limitReached = result.metadata.returnert >= SEGMENTERING_LIMIT
      return { ...stedfesting, limitReached, segmentCount: result.objekter.length }
    },
    enabled: trimmed.length > 0,
  })
}
