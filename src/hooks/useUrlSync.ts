import { useAtomValue } from 'jotai'
import WKT from 'ol/format/WKT'
import type { Polygon } from 'ol/geom'
import { useEffect } from 'react'
import type { Vegobjekttype } from '../api/datakatalogClient'
import {
  allTypesSelectedAtom,
  DEFAULT_VEGLENKESEKVENSER_LIMIT,
  polygonAtom,
  polygonClipAtom,
  searchDateAtom,
  searchDateEnabledAtom,
  searchModeAtom,
  stedfestingAtom,
  strekningAtom,
  veglenkesekvensLimitAtom,
  vegsystemreferanseAtom,
} from '../state/atoms'
import { safeReplaceState } from '../utils/historyUtils'
import { roundPolygonToTwoDecimals } from '../utils/polygonRounding'
import { ensureProjections } from '../utils/projections'

function polygonToWkt(polygon: Polygon): string {
  const format = new WKT()
  const roundedUtm = roundPolygonToTwoDecimals(polygon.clone())
  return format.writeGeometry(roundedUtm)
}

ensureProjections()

export function useUrlSync(selectedTypes: Vegobjekttype[]) {
  const allTypesSelected = useAtomValue(allTypesSelectedAtom)
  const polygon = useAtomValue(polygonAtom)
  const polygonClip = useAtomValue(polygonClipAtom)
  const veglenkesekvensLimit = useAtomValue(veglenkesekvensLimitAtom)
  const searchMode = useAtomValue(searchModeAtom)
  const searchDateEnabled = useAtomValue(searchDateEnabledAtom)
  const searchDate = useAtomValue(searchDateAtom)
  const strekning = useAtomValue(strekningAtom)
  const stedfesting = useAtomValue(stedfestingAtom)
  const vegsystemreferanse = useAtomValue(vegsystemreferanseAtom)

  useEffect(() => {
    const url = new URL(window.location.href)
    if (searchMode === 'polygon' && polygon) {
      url.searchParams.set('polygon', polygonToWkt(polygon))
    } else {
      url.searchParams.delete('polygon')
    }
    if (searchMode === 'polygon') {
      url.searchParams.set('polygonclip', polygonClip ? '1' : '0')
    } else {
      url.searchParams.delete('polygonclip')
    }
    if (searchMode === 'strekning' && strekning.trim().length > 0) {
      url.searchParams.set('strekning', strekning.trim())
    } else {
      url.searchParams.delete('strekning')
    }
    if (searchMode === 'stedfesting' && stedfesting.trim().length > 0) {
      url.searchParams.set('stedfesting', stedfesting.trim())
    } else {
      url.searchParams.delete('stedfesting')
    }
    if (searchMode === 'vegsystemreferanse' && vegsystemreferanse.trim().length > 0) {
      url.searchParams.set('vegsystemreferanse', vegsystemreferanse.trim())
    } else {
      url.searchParams.delete('vegsystemreferanse')
    }
    if (searchDateEnabled && searchDate.trim().length > 0) {
      url.searchParams.set('dato', searchDate.trim())
    } else {
      url.searchParams.delete('dato')
    }
    if (allTypesSelected) {
      url.searchParams.set('types', 'all')
    } else if (selectedTypes.length > 0) {
      url.searchParams.set('types', selectedTypes.map((t) => t.id).join(','))
    } else {
      url.searchParams.delete('types')
    }
    if (veglenkesekvensLimit !== DEFAULT_VEGLENKESEKVENSER_LIMIT) {
      url.searchParams.set('veglenkesekvenslimit', veglenkesekvensLimit.toString())
    } else {
      url.searchParams.delete('veglenkesekvenslimit')
    }
    const nextUrl = `${url.pathname}${url.search}${url.hash}`
    safeReplaceState(nextUrl, 'filter-sync')
  }, [
    allTypesSelected,
    polygon,
    polygonClip,
    searchDate,
    searchDateEnabled,
    selectedTypes,
    searchMode,
    strekning,
    stedfesting,
    vegsystemreferanse,
    veglenkesekvensLimit,
  ])
}
