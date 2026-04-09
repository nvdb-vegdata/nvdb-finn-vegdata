import { Copy } from 'lucide-react'
import type { PosisjonMedAvstand } from '../../api/generated/vegnett'

interface Props {
  results: PosisjonMedAvstand[] | null
  loading: boolean
  error: string | null
  popupRef: React.RefObject<HTMLDivElement | null>
}

export default function VegnettPosisjonPopup({ results, loading, error, popupRef }: Props) {
  const hasContent = loading || error || results !== null

  const animateCopy = (button: HTMLButtonElement) => {
    button.animate([{ color: 'currentColor' }, { color: '#22c55e' }, { color: '#22c55e' }, { color: 'currentColor' }], {
      duration: 900,
      easing: 'ease-in-out',
      delay: 0,
    })
  }

  return (
    <div ref={popupRef} className="ol-popup">
      {hasContent && (
        <div className="popup-content">
          {loading && (
            <div className="posisjon-loading">
              <span className="spinner" />
              <span>Søker...</span>
            </div>
          )}
          {!loading && error && <div className="posisjon-error">{error}</div>}
          {!loading && !error && results !== null && results.length === 0 && <div className="posisjon-empty">Ingen veg funnet i nærheten</div>}
          {!loading && !error && results && results.length > 0 && (
            <ul className="posisjon-result-list">
              {results.map((result, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: stable positional list
                <li key={i} className="posisjon-result-item">
                  <div className="popup-title">{result.vegsystemreferanse.kortform ?? 'Ingen vegsystemreferanse'}</div>
                  <div className="posisjon-detail">
                    <span className="posisjon-label">Lenkesekvensid</span>
                    <span className="posisjon-value">{result.veglenkesekvens.veglenkesekvensid}</span>
                    <button
                      type="button"
                      className={'posisjon-copy-btn'}
                      title="Kopier lenkesekvens ID"
                      onClick={(event) => {
                        const btn = event.currentTarget
                        navigator.clipboard.writeText(result.veglenkesekvens.veglenkesekvensid.toFixed(0)).then(() => animateCopy(btn))
                      }}
                    >
                      <Copy size={12} aria-hidden="true" />
                    </button>
                  </div>

                  <div className="posisjon-detail">
                    <span className="posisjon-label">Relativ posisjon</span>
                    <span className="posisjon-value">{result.veglenkesekvens.relativPosisjon}</span>
                    <button
                      type="button"
                      className={'posisjon-copy-btn'}
                      title="Kopier lenkeposisjon"
                      onClick={(event) => {
                        const btn = event.currentTarget
                        navigator.clipboard.writeText(result.veglenkesekvens.relativPosisjon.toFixed(8)).then(() => animateCopy(btn))
                      }}
                    >
                      <Copy size={12} aria-hidden="true" />
                    </button>
                  </div>

                  <div className="posisjon-detail">
                    <span className="posisjon-label">Lenkeposisjon</span>
                    <span className="posisjon-value">{result.veglenkesekvens.kortform}</span>
                    <button
                      type="button"
                      className={'posisjon-copy-btn'}
                      title="Kopier kortform"
                      onClick={(event) => {
                        const btn = event.currentTarget
                        navigator.clipboard.writeText(result.veglenkesekvens.kortform).then(() => animateCopy(btn))
                      }}
                    >
                      <Copy size={12} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
