export type VeglenkesekvensLimitWarningMode = 'polygon' | 'strekning' | 'stedfesting'

export function getVeglenkesekvensLimitWarningMessage(
  searchMode: VeglenkesekvensLimitWarningMode,
  limitReached: boolean,
  veglenkesekvensLimit: number,
): string | null {
  if (!limitReached) return null

  if (searchMode === 'polygon') {
    return `Området inneholder flere veglenkesekvenser enn grensen (${veglenkesekvensLimit}). Tegn et mindre område for å se alle.`
  }

  if (searchMode === 'strekning') {
    return `Strekningen inneholder flere veglenkesekvenser enn grensen (${veglenkesekvensLimit}). Bruk en kortere strekning for å se alle.`
  }

  return null
}

export function getVeglenkesekvensLimitWarningKey(
  searchMode: VeglenkesekvensLimitWarningMode,
  limitReached: boolean,
  polygonUtm33: string | null,
  vegsystemreferanse: string,
  veglenkesekvensLimit: number,
): string | null {
  if (!limitReached) return null

  if (searchMode === 'polygon' && polygonUtm33) {
    return `polygon:${polygonUtm33}:${veglenkesekvensLimit}`
  }

  const trimmedStrekning = vegsystemreferanse.trim()
  if (searchMode === 'strekning' && trimmedStrekning.length > 0) {
    return `strekning:${trimmedStrekning}:${veglenkesekvensLimit}`
  }

  return null
}
