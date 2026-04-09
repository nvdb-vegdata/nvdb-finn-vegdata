import { client as datakatalogClient } from './generated/datakatalog/client.gen'
import { client as uberiketClient } from './generated/uberiket/client.gen'
import { client as vegnettClient } from './generated/vegnett/client.gen'

const TIMEOUT_MS = 30_000

function buildRequestSignal(signal?: AbortSignal | null): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(TIMEOUT_MS)
  if (!signal) return timeoutSignal
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([signal, timeoutSignal])
  }
  return timeoutSignal
}

const fetchWithTimeout = ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: buildRequestSignal(init?.signal) })) as typeof fetch

const commonConfig = {
  headers: { 'X-Client': 'nvdb-finn-vegdata' },
  fetch: fetchWithTimeout,
  querySerializer: { array: { explode: false, style: 'form' as const } },
}

datakatalogClient.setConfig({
  ...commonConfig,
  baseUrl: 'https://nvdbapiles.atlas.vegvesen.no/datakatalog',
})

uberiketClient.setConfig({
  ...commonConfig,
  baseUrl: 'https://nvdbapiles.atlas.vegvesen.no/uberiket',
})

vegnettClient.setConfig({
  ...commonConfig,
  baseUrl: 'https://nvdbapiles.atlas.vegvesen.no/vegnett',
})
