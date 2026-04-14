import { useAtom } from 'jotai'
import { Copy, X } from 'lucide-react'
import WKT from 'ol/format/WKT'
import { Polygon } from 'ol/geom'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  polygonAtom,
  polygonClipAtom,
  polygonWktInputAtom,
  stedfestingAtom,
  stedfestingInputAtom,
  strekningAtom,
  strekningInputAtom,
  vegsystemreferanseAtom,
  vegsystemreferanseInputAtom,
} from '../../state/atoms'
import { roundPolygonToTwoDecimals } from '../../utils/polygonRounding'
import { ensureProjections } from '../../utils/projections'
import { isValidStedfestingInput } from '../../utils/stedfestingParser'
import { isValidVegsystemreferanse, isValidVegsystemreferanseSegmentering } from '../../utils/vegsystemreferanseValidator'

interface Props {
  searchMode: 'polygon' | 'strekning' | 'stedfesting' | 'vegsystemreferanse'
}

const POLYGON_WKT_REGEX = /^POLYGON\s*\(\(\s*-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?)+\s*\)\)\s*$/i

function isValidPolygonWkt(value: string): boolean {
  return POLYGON_WKT_REGEX.test(value)
}

ensureProjections()

export default function SearchControls({ searchMode }: Props) {
  const [polygon, setPolygon] = useAtom(polygonAtom)
  const [polygonClip, setPolygonClip] = useAtom(polygonClipAtom)
  const [polygonWktInput, setPolygonWktInput] = useAtom(polygonWktInputAtom)
  const [polygonError, setPolygonError] = useState<string | null>(null)
  const [polygonCopied, setPolygonCopied] = useState(false)
  const lastPolygonWktRef = useRef('')
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [, setStrekning] = useAtom(strekningAtom)
  const [strekningInput, setStrekningInput] = useAtom(strekningInputAtom)
  const [strekningError, setStrekningError] = useState<string | null>(null)
  const [, setStedfesting] = useAtom(stedfestingAtom)
  const [stedfestingInput, setStedfestingInput] = useAtom(stedfestingInputAtom)
  const [stedfestingError, setStedfestingError] = useState<string | null>(null)
  const [, setVegsystemreferanse] = useAtom(vegsystemreferanseAtom)
  const [vegsystemreferanseInput, setVegsystemreferanseInput] = useAtom(vegsystemreferanseInputAtom)
  const [vegsystemreferanseError, setVegsystemreferanseError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!polygon) {
      if (lastPolygonWktRef.current !== '') {
        lastPolygonWktRef.current = ''
        setPolygonWktInput('')
      }
      if (polygonError !== null) {
        setPolygonError(null)
      }
      return
    }
    const format = new WKT()
    const roundedUtm = roundPolygonToTwoDecimals(polygon.clone())
    const roundedWkt = format.writeGeometry(roundedUtm)
    if (roundedWkt !== lastPolygonWktRef.current) {
      lastPolygonWktRef.current = roundedWkt
      setPolygonWktInput(roundedWkt)
    }
    if (polygonError !== null) {
      setPolygonError(null)
    }
  }, [polygon, polygonError, setPolygonWktInput])

  const handlePolygonChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setPolygonWktInput(event.target.value)
      setPolygonError(null)
    },
    [setPolygonWktInput],
  )

  const handlePolygonSearch = useCallback(() => {
    const trimmed = polygonWktInput.trim()
    if (trimmed.length === 0) return
    if (!isValidPolygonWkt(trimmed)) {
      setPolygonError('Ugyldig WKT-format. Bruk f.eks. POLYGON((x y, ...)).')
      return
    }
    try {
      const format = new WKT()
      const geometry = format.readGeometry(trimmed, { dataProjection: 'EPSG:25833', featureProjection: 'EPSG:25833' })
      if (!(geometry instanceof Polygon)) {
        setPolygonError('Kun POLYGON er støttet i WKT-feltet.')
        return
      }
      setPolygonError(null)
      const roundedUtm = roundPolygonToTwoDecimals(geometry)
      setPolygon(roundedUtm)
    } catch {
      setPolygonError('Ugyldig WKT. Bruk f.eks. POLYGON((x y, ...)).')
    }
  }, [polygonWktInput, setPolygon])

  const handlePolygonKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        if (polygonWktInput.trim().length > 0) {
          handlePolygonSearch()
        }
      }
    },
    [handlePolygonSearch, polygonWktInput],
  )

  const clearPolygon = useCallback(() => {
    setPolygonWktInput('')
    lastPolygonWktRef.current = ''
    setPolygon(null)
    setPolygonError(null)
    setPolygonCopied(false)
  }, [setPolygon, setPolygonWktInput])

  const handleCopyPolygonWkt = useCallback(async () => {
    const trimmed = polygonWktInput.trim()
    if (trimmed.length === 0) return
    try {
      await navigator.clipboard.writeText(trimmed)
      setPolygonCopied(true)
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
      copyTimeoutRef.current = setTimeout(() => {
        setPolygonCopied(false)
      }, 1500)
    } catch {
      setPolygonError('Kunne ikke kopiere WKT.')
    }
  }, [polygonWktInput])

  const handleStrekningChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setStrekningInput(event.target.value)
      setStrekningError(null)
    },
    [setStrekningInput],
  )

  const handleStrekningSearch = useCallback(() => {
    const trimmed = strekningInput.trim()
    if (trimmed.length === 0) return
    if (!isValidVegsystemreferanse(trimmed)) {
      setStrekningError('Ugyldig vegsystemreferanse. Bruk f.eks. FV6 S1D1 (KSP kan ha kommunenummer). Kryssdel/sideanleggsdel og meterverdier er ikke støttet.')
      return
    }
    setStrekningError(null)
    setStrekning(trimmed)
  }, [setStrekning, strekningInput])

  const handleStrekningKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        if (strekningInput.trim().length > 0) {
          handleStrekningSearch()
        }
      }
    },
    [handleStrekningSearch, strekningInput],
  )

  const clearStrekning = useCallback(() => {
    setStrekningInput('')
    setStrekning('')
    setStrekningError(null)
  }, [setStrekningInput, setStrekning])

  const handleStedfestingChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setStedfestingInput(event.target.value)
      setStedfestingError(null)
    },
    [setStedfestingInput],
  )

  const handleStedfestingSearch = useCallback(() => {
    const trimmed = stedfestingInput.trim()
    if (trimmed.length === 0) return
    if (!isValidStedfestingInput(trimmed)) {
      setStedfestingError('Ugyldig stedfesting. Bruk f.eks. 1234, 0.2-0.5@5678 eller 0.8@9999.')
      return
    }
    setStedfestingError(null)
    setStedfesting(trimmed)
  }, [setStedfesting, stedfestingInput])

  const handleStedfestingKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        if (stedfestingInput.trim().length > 0) {
          handleStedfestingSearch()
        }
      }
    },
    [handleStedfestingSearch, stedfestingInput],
  )

  const clearStedfesting = useCallback(() => {
    setStedfestingInput('')
    setStedfesting('')
    setStedfestingError(null)
  }, [setStedfestingInput, setStedfesting])

  const handleVegsystemreferanseChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setVegsystemreferanseInput(event.target.value)
      setVegsystemreferanseError(null)
    },
    [setVegsystemreferanseInput],
  )

  const handleVegsystemreferanseSearch = useCallback(() => {
    const trimmed = vegsystemreferanseInput.trim()
    if (trimmed.length === 0) return
    // if (!isValidVegsystemreferanseSegmentering(trimmed)) {
    //   setVegsystemreferanseError('Ugyldig vegsystemreferanse. Bruk f.eks. EV18 S33D1 eller EV18 S33D1 m10-40.')
    //   return
    // }
    setVegsystemreferanseError(null)
    setVegsystemreferanse(trimmed)
  }, [setVegsystemreferanse, vegsystemreferanseInput])

  const handleVegsystemreferanseKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        if (vegsystemreferanseInput.trim().length > 0) {
          handleVegsystemreferanseSearch()
        }
      }
    },
    [handleVegsystemreferanseSearch, vegsystemreferanseInput],
  )

  const clearVegsystemreferanse = useCallback(() => {
    setVegsystemreferanseInput('')
    setVegsystemreferanse('')
    setVegsystemreferanseError(null)
  }, [setVegsystemreferanseInput, setVegsystemreferanse])

  useEffect(() => {
    if (searchMode !== 'polygon' && (polygon || polygonWktInput || polygonError)) {
      clearPolygon()
    }
    if (searchMode !== 'strekning' && (strekningInput || strekningError)) {
      clearStrekning()
    }
    if (searchMode !== 'stedfesting' && (stedfestingInput || stedfestingError)) {
      clearStedfesting()
    }
    if (searchMode !== 'vegsystemreferanse' && (vegsystemreferanseInput || vegsystemreferanseError)) {
      clearVegsystemreferanse()
    }
  }, [
    clearPolygon,
    clearStedfesting,
    clearStrekning,
    clearVegsystemreferanse,
    polygon,
    polygonError,
    polygonWktInput,
    searchMode,
    stedfestingError,
    stedfestingInput,
    strekningError,
    strekningInput,
    vegsystemreferanseError,
    vegsystemreferanseInput,
  ])

  const trimmedStrekningInput = strekningInput.trim()
  const isStrekningValid = trimmedStrekningInput.length === 0 || isValidVegsystemreferanse(trimmedStrekningInput)
  const trimmedStedfestingInput = stedfestingInput.trim()
  const isStedfestingValid = trimmedStedfestingInput.length === 0 || isValidStedfestingInput(trimmedStedfestingInput)
  const trimmedPolygonInput = polygonWktInput.trim()
  const isPolygonRegexValid = trimmedPolygonInput.length === 0 || isValidPolygonWkt(trimmedPolygonInput)
  const isPolygonValid = trimmedPolygonInput.length === 0 || (isPolygonRegexValid && polygonError === null)
  const trimmedVegsystemreferanseInput = vegsystemreferanseInput.trim()
  const isVegsystemreferanseValid = trimmedVegsystemreferanseInput.length === 0 || isValidVegsystemreferanseSegmentering(trimmedVegsystemreferanseInput)

  return (
    <>
      {searchMode === 'strekning' && (
        <div className="strekning-controls">
          <label className="search-label" htmlFor="strekning-input">
            Søk på strekning
          </label>
          <div className="search-input-row">
            <div className="search-input-wrapper">
              <input
                id="strekning-input"
                className="search-input"
                placeholder="Eks.: FV6666 S1"
                value={strekningInput}
                onChange={handleStrekningChange}
                onKeyDown={handleStrekningKeyDown}
              />
              {strekningInput && (
                <button className="search-clear-btn" type="button" onClick={clearStrekning} aria-label="Tøm strekning">
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleStrekningSearch}
              disabled={trimmedStrekningInput.length === 0 || !isStrekningValid}
            >
              Søk
            </button>
          </div>
          {strekningError && <div className="strekning-error">{strekningError}</div>}
        </div>
      )}

      {searchMode === 'stedfesting' && (
        <div className="stedfesting-controls">
          <label className="search-label" htmlFor="stedfesting-input">
            Stedfesting
          </label>
          <div className="search-input-row">
            <div className="search-input-wrapper">
              <input
                id="stedfesting-input"
                className="search-input"
                placeholder="Eks.: 1234, 0.2-0.5@5678"
                value={stedfestingInput}
                onChange={handleStedfestingChange}
                onKeyDown={handleStedfestingKeyDown}
              />
              {stedfestingInput && (
                <button className="search-clear-btn" type="button" onClick={clearStedfesting} aria-label="Tøm stedfesting">
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleStedfestingSearch}
              disabled={trimmedStedfestingInput.length === 0 || !isStedfestingValid}
            >
              Søk
            </button>
          </div>
          {stedfestingError && <div className="strekning-error">{stedfestingError}</div>}
        </div>
      )}

      {searchMode === 'vegsystemreferanse' && (
        <div className="vegsystemreferanse-controls">
          <label className="search-label" htmlFor="vegsystemreferanse-input">
            Vegsystemreferanse
          </label>
          <div className="search-input-row">
            <div className="search-input-wrapper">
              <input
                id="vegsystemreferanse-input"
                className="search-input"
                placeholder="Eks.: EV18 S33D1 eller EV18 S33D1 m10-40"
                value={vegsystemreferanseInput}
                onChange={handleVegsystemreferanseChange}
                onKeyDown={handleVegsystemreferanseKeyDown}
              />
              {vegsystemreferanseInput && (
                <button className="search-clear-btn" type="button" onClick={clearVegsystemreferanse} aria-label="Tøm vegsystemreferanse">
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleVegsystemreferanseSearch}
              disabled={trimmedVegsystemreferanseInput.length === 0 || !isVegsystemreferanseValid}
            >
              Søk
            </button>
          </div>
          {vegsystemreferanseError && <div className="strekning-error">{vegsystemreferanseError}</div>}
        </div>
      )}

      {searchMode === 'polygon' && (
        <div className="strekning-controls polygon-controls">
          <label className="search-label" htmlFor="polygon-wkt-input">
            Polygon WKT
          </label>
          <div className="search-input-row">
            <div className="search-input-wrapper">
              <input
                id="polygon-wkt-input"
                className="search-input"
                placeholder="POLYGON((x y, x y, ...))"
                value={polygonWktInput}
                onChange={handlePolygonChange}
                onKeyDown={handlePolygonKeyDown}
              />
              {polygonWktInput && (
                <button className="search-clear-btn" type="button" onClick={clearPolygon} aria-label="Tøm polygon WKT">
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
            <button className="btn btn-primary" type="button" onClick={handlePolygonSearch} disabled={trimmedPolygonInput.length === 0 || !isPolygonValid}>
              Søk
            </button>
            <button
              className={`vegobjekt-action-btn vegobjekt-copy-btn search-copy-btn${polygonCopied ? ' copied' : ''}`}
              type="button"
              onClick={handleCopyPolygonWkt}
              disabled={trimmedPolygonInput.length === 0 || !isPolygonRegexValid}
              aria-label={polygonCopied ? 'WKT kopiert' : 'Kopier WKT'}
              title={polygonCopied ? 'Kopiert!' : 'Kopier WKT'}
            >
              <Copy size={16} aria-hidden="true" />
            </button>
          </div>
          {polygonError && <div className="strekning-error">{polygonError}</div>}
          <label className="polygon-clip-toggle">
            <input type="checkbox" checked={polygonClip} onChange={() => setPolygonClip((prev) => !prev)} />
            Klipp veglenker til polygon
          </label>
        </div>
      )}
    </>
  )
}
