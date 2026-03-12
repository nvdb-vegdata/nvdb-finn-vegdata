import { useAtom, useAtomValue } from 'jotai'
import { X } from 'lucide-react'
import type { Polygon } from 'ol/geom'
import { useEffect, useMemo, useState } from 'react'
import { isSelectableVegobjekttype, type Vegobjekttype } from './api/datakatalogClient'
import MapView from './components/Map/MapView'
import ObjectTypeSelector from './components/ObjectTypeSelector/ObjectTypeSelector'
import VegobjektList from './components/VegobjektList/VegobjektList'
import { useUrlSync } from './hooks/useUrlSync'
import { useVeglenkesekvenser } from './hooks/useVeglenkesekvenser'
import { useVegobjekter } from './hooks/useVegobjekter'
import { useVegobjekterErrorMessage } from './hooks/useVegobjekterErrorMessage'
import { useVegobjekttyper } from './hooks/useVegobjekttyper'
import {
  allTypesSelectedAtom,
  polygonAtom,
  searchDateAtom,
  searchDateEnabledAtom,
  searchModeAtom,
  selectedTypeIdsAtom,
  selectedTypesAtom,
  stedfestingAtom,
  strekningAtom,
  veglenkesekvensLimitAtom,
} from './state/atoms'
import { ensureProjections } from './utils/projections'
import { parseStedfestingInput } from './utils/stedfestingParser'
import { getVeglenkesekvensLimitWarningKey, getVeglenkesekvensLimitWarningMessage } from './utils/veglenkesekvensLimitWarning'

ensureProjections()

export default function App() {
  const [selectedTypeIds, setSelectedTypeIds] = useAtom(selectedTypeIdsAtom)
  const [selectedTypes, setSelectedTypes] = useAtom(selectedTypesAtom)
  const allTypesSelected = useAtomValue(allTypesSelectedAtom)
  const polygon = useAtomValue(polygonAtom)
  const searchDateEnabled = useAtomValue(searchDateEnabledAtom)
  const searchDate = useAtomValue(searchDateAtom)
  const veglenkesekvensLimit = useAtomValue(veglenkesekvensLimitAtom)
  const searchMode = useAtomValue(searchModeAtom)
  const strekning = useAtomValue(strekningAtom)
  const stedfesting = useAtomValue(stedfestingAtom)
  const { data: allTypes, isLoading: datakatalogLoading } = useVegobjekttyper()

  useEffect(() => {
    if (!allTypes || selectedTypeIds.length === 0) return
    const types = selectedTypeIds
      .map((id) => allTypes.find((t) => t.id === id))
      .filter((t): t is Vegobjekttype => t !== undefined)
      .filter(isSelectableVegobjekttype)
    if (types.length > 0) {
      setSelectedTypes(types)
    }
    setSelectedTypeIds([])
  }, [allTypes, selectedTypeIds, setSelectedTypes, setSelectedTypeIds])

  useUrlSync(selectedTypes)

  const polygonUtm33 = useMemo(() => (searchMode === 'polygon' && polygon ? polygonToUtm33(polygon) : null), [polygon, searchMode])

  const stedfestingParsed = useMemo(() => {
    if (searchMode !== 'stedfesting') return null
    return parseStedfestingInput(stedfesting)
  }, [searchMode, stedfesting])

  const {
    data: veglenkeResult,
    isLoading: veglenkerLoading,
    error: veglenkerError,
  } = useVeglenkesekvenser({
    polygonUtm33,
    vegsystemreferanse: searchMode === 'strekning' ? strekning : null,
    veglenkesekvensIds: searchMode === 'stedfesting' ? (stedfestingParsed?.veglenkesekvensIds ?? null) : null,
    limit: veglenkesekvensLimit,
  })

  const {
    vegobjekterByType,
    isLoading: vegobjekterLoading,
    error: vegobjekterError,
    isStreaming: vegobjekterStreaming,
    streamingFetchedCount: vegobjekterStreamingFetchedCount,
    streamWarning: vegobjekterStreamWarning,
    resultLimitReached: vegobjekterResultLimitReached,
    resultLimitMessage: vegobjekterResultLimitMessage,
  } = useVegobjekter({
    selectedTypes,
    allTypesSelected,
    polygonUtm33: searchMode === 'polygon' ? polygonUtm33 : null,
    vegsystemreferanse: searchMode === 'strekning' ? strekning : null,
    stedfestingFilterDirect: searchMode === 'stedfesting' ? (stedfestingParsed?.stedfestingFilter ?? null) : null,
    searchDate: searchDateEnabled ? searchDate : null,
  })

  useVegobjekterErrorMessage(vegobjekterError)

  const isLoading = datakatalogLoading || veglenkerLoading || vegobjekterLoading

  const totalVeglenker = veglenkeResult?.veglenkesekvenser.reduce((sum, vs) => sum + (vs.veglenker?.length ?? 0), 0) ?? 0

  const limitReached = veglenkeResult?.metadata?.returnert === veglenkesekvensLimit
  const limitWarningMessage = getVeglenkesekvensLimitWarningMessage(searchMode, limitReached, veglenkesekvensLimit)
  const limitWarningKey = getVeglenkesekvensLimitWarningKey(searchMode, limitReached, polygonUtm33, strekning, veglenkesekvensLimit)

  const [warningDismissed, setWarningDismissed] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the warning applies to a new search
  useEffect(() => {
    setWarningDismissed(false)
  }, [limitWarningKey])

  const totalVegobjekter = Array.from(vegobjekterByType.values()).reduce((sum, arr) => sum + arr.length, 0)

  const showSidebarHelp = !veglenkeResult || (!allTypesSelected && selectedTypes.length === 0)

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="sidebar-header">
          <h1>
            NVDB Finn Vegdata <span className="beta-badge">BETA</span>
          </h1>
          <p>Velg objekttyper og tegn et område eller søk på strekning</p>
        </header>

        <div className="sidebar-content">
          <ObjectTypeSelector />
        </div>

        <div className="status-bar">
          {datakatalogLoading ? (
            'Laster datakatalog...'
          ) : vegobjekterStreaming ? (
            `Streamer vegobjekter... ${vegobjekterStreamingFetchedCount} hentet`
          ) : isLoading ? (
            'Laster data...'
          ) : (
            <>
              {allTypesSelected ? 'Alle typer valgt' : `${selectedTypes.length} type(r) valgt`}
              {totalVeglenker > 0 && ` | ${totalVeglenker} veglenke(r)`}
              {totalVegobjekter > 0 && ` | ${totalVegobjekter} objekt(er)`}
            </>
          )}
        </div>
      </aside>

      <main className="map-container">
        <MapView veglenkesekvenser={veglenkeResult?.veglenkesekvenser} vegobjekterByType={vegobjekterByType} isLoadingVeglenker={veglenkerLoading} />
        {limitWarningMessage && !warningDismissed && (
          <div className="limit-warning">
            <span>⚠️ {limitWarningMessage}</span>
            <button type="button" className="limit-warning-close" onClick={() => setWarningDismissed(true)} aria-label="Lukk advarsel">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </main>

      <aside className="sidebar-right">
        {showSidebarHelp ? (
          <div className="sidebar-right-help">
            <div className="sidebar-right-header">
              <h2>Vegobjekter</h2>
            </div>
            <div className="sidebar-right-content">
              <div className="help-section">
                <h3>Kom i gang</h3>
                <ol>
                  <li>Velg en eller flere vegobjekttyper fra listen til venstre</li>
                  <li>Klikk "Tegn område" for polygon, eller velg "Søk på strekning"/"Stedfesting" og skriv inn søket ditt</li>
                  <li>Vegobjektene i området eller strekningen vises her</li>
                </ol>
              </div>
              <div className="help-section">
                <h3>Tips</h3>
                <ul>
                  <li>Klikk på en veglenke for å se hvilke objekter som ligger der</li>
                  <li>Utvid objekter i listen for å se detaljer</li>
                  <li>Bruk søkefeltet for å finne objekttyper</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <VegobjektList
            vegobjekterByType={vegobjekterByType}
            isLoading={vegobjekterLoading}
            isStreaming={vegobjekterStreaming}
            streamingFetchedCount={vegobjekterStreamingFetchedCount}
            streamWarning={vegobjekterStreamWarning}
            resultLimitReached={vegobjekterResultLimitReached}
            resultLimitMessage={vegobjekterResultLimitMessage}
          />
        )}
      </aside>

      {veglenkerError && (
        <div className="error" style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}>
          Kunne ikke hente data fra NVDB
        </div>
      )}
    </div>
  )
}

function polygonToUtm33(polygon: Polygon): string {
  const coords = polygon.getCoordinates()[0]
  if (!coords) return ''

  const utm33Coords = coords.map((coord) => {
    const [x = 0, y = 0] = coord
    return `${Math.round(x)} ${Math.round(y)}`
  })

  return utm33Coords.join(', ')
}
