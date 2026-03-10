import './apiConfig'
import {
  hentVeglenkesekvenser as sdkHentVeglenkesekvenser,
  hentVegobjekterMultiType as sdkHentVegobjekterMultiType,
  hentVegobjekterMultiTypeStream as sdkHentVegobjekterMultiTypeStream,
} from './generated/uberiket/sdk.gen'
import type {
  BoolskEgenskap,
  DatoEgenskap,
  EgenskapVerdi,
  EnumEgenskap,
  FlyttallEgenskap,
  GeometriEgenskap,
  Geometristruktur,
  HeltallEgenskap,
  StedfestingLinje,
  StedfestingLinjer,
  StedfestingMangler,
  StedfestingPunkt,
  StedfestingPunkter,
  StedfestingSving,
  TekstEgenskap,
  Veglenke,
  Veglenkesekvens,
  VeglenkesekvenserSide,
  Vegobjekt,
  VegobjekterSide,
} from './generated/uberiket/types.gen'
import { zHentVeglenkesekvenserResponse, zVegobjekt } from './generated/uberiket/zod.gen'

export type Stedfesting = StedfestingLinjer | StedfestingPunkter | StedfestingSving | StedfestingMangler

export type {
  Veglenkesekvens,
  Veglenke,
  Vegobjekt,
  VegobjekterSide,
  VeglenkesekvenserSide,
  StedfestingLinje,
  StedfestingPunkt,
  StedfestingLinjer,
  StedfestingPunkter,
  StedfestingSving,
  StedfestingMangler,
  EgenskapVerdi,
  EnumEgenskap,
  GeometriEgenskap,
  Geometristruktur,
}

type VeglenkesekvenserQuery = {
  polygon?: string
  vegsystemreferanse?: string
  antall?: number
  ider?: number[]
}

export async function hentVeglenkesekvenser({ polygon, vegsystemreferanse, antall = 10, ider }: VeglenkesekvenserQuery): Promise<VeglenkesekvenserSide> {
  const response = await sdkHentVeglenkesekvenser({
    query: {
      antall,
      ider,
      polygon,
      vegsystemreferanse: vegsystemreferanse ? [vegsystemreferanse] : undefined,
      inkluder: ['alle'],
    },
    responseValidator: async (data) => {
      normalizeVeglenkesekvenserResponseInPlace(data)

      try {
        await zHentVeglenkesekvenserResponse.parseAsync(data)
      } catch (error) {
        const issues = typeof error === 'object' && error && 'issues' in error ? (error as { issues?: unknown }).issues : undefined
        if (issues) {
          console.error('Uberiket response validation error (veglenkesekvenser)', issues)
        } else {
          console.error('Uberiket response validation error (veglenkesekvenser)', error)
        }
      }
    },
  })

  if (response.error) {
    throw new Error(`Failed to fetch veglenkesekvenser: ${response.error}`)
  }

  return response.data as VeglenkesekvenserSide
}

function normalizeVeglenkesekvenserResponseInPlace(data: unknown) {
  if (!data || typeof data !== 'object') return

  const root = data as { veglenkesekvenser?: unknown }
  if (!Array.isArray(root.veglenkesekvenser)) return

  for (const vs of root.veglenkesekvenser) {
    if (!vs || typeof vs !== 'object') continue
    const seq = vs as { id?: unknown }

    if (typeof seq.id === 'bigint') {
      seq.id = Number(seq.id)
    }
  }
}

type VegobjekterQuery = {
  typeIds?: number[]
  stedfesting?: string
  vegsystemreferanse?: string
  dato?: string
  antall?: number
  start?: string
}

type VegobjekterStreamQuery = {
  typeIds?: number[]
  polygon?: string
  vegsystemreferanse?: string
  dato?: string
  antall?: number
  signal?: AbortSignal
  onProgress?: (fetchedCount: number) => void
}

export const VEGOBJEKTER_STREAM_LIMIT = 10_000

type VegobjekterStreamRequest = Omit<VegobjekterStreamQuery, 'onProgress' | 'signal'>
type VegobjekterStreamProgress = NonNullable<VegobjekterStreamQuery['onProgress']>
type VegobjekterStreamResult = {
  vegobjekter: Vegobjekt[]
  warning?: string | null
}
type VegobjekterStreamFetcher = (request: VegobjekterStreamRequest, onProgress: VegobjekterStreamProgress) => Promise<VegobjekterStreamResult>

type InflightVegobjekterStream = {
  fetchedCount: number
  listeners: Set<VegobjekterStreamProgress>
  promise: Promise<VegobjekterStreamResult>
}

const inflightVegobjekterStreams = new Map<string, InflightVegobjekterStream>()

export class VegobjekterRequestError extends Error {
  status?: number
  detail?: string

  constructor(message: string, status?: number, detail?: string) {
    super(message)
    this.name = 'VegobjekterRequestError'
    this.status = status
    this.detail = detail
  }
}

export function isVegobjekterRequestError(error: unknown): error is VegobjekterRequestError {
  return error instanceof VegobjekterRequestError
}

function createVegobjekterRequestError(error: unknown, status?: number): VegobjekterRequestError {
  const body = typeof error === 'object' && error !== null ? (error as { detail?: string; title?: string; status?: number }) : undefined
  const resolvedStatus = status ?? body?.status
  const detail = body?.detail
  const title = body?.title ?? (typeof error === 'string' && error.length > 0 ? error : 'request failed')
  return new VegobjekterRequestError(`Failed to fetch vegobjekter: ${title}`, resolvedStatus, detail)
}

export async function hentVegobjekter({ typeIds, stedfesting, vegsystemreferanse, dato, antall = 1000, start }: VegobjekterQuery): Promise<VegobjekterSide> {
  const response = await sdkHentVegobjekterMultiType({
    query: {
      typeIder: typeIds,
      antall,
      inkluder: ['alle'],
      dato,
      start,
      stedfesting: stedfesting ? [stedfesting] : undefined,
      vegsystemreferanse: vegsystemreferanse ? [vegsystemreferanse] : undefined,
    },
  })

  if (response.error) {
    throw createVegobjekterRequestError(response.error, response.response?.status)
  }

  return response.data as VegobjekterSide
}

function parseVegobjektNdjsonLine(rawLine: string, lineNumber: number): Vegobjekt {
  let parsedLine: unknown

  try {
    parsedLine = JSON.parse(rawLine)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse vegobjekter NDJSON at line ${lineNumber}: ${message}`)
  }

  if (!parsedLine || typeof parsedLine !== 'object') {
    throw new Error(`Failed to parse vegobjekter NDJSON at line ${lineNumber}: expected an object`)
  }

  const validation = zVegobjekt.safeParse(parsedLine)
  if (!validation.success) {
    console.error(`Uberiket response validation error (vegobjekter stream, line ${lineNumber})`, validation.error.issues)
  }

  return parsedLine as Vegobjekt
}

export function parseVegobjekterNdjson(ndjson: string): Vegobjekt[] {
  const vegobjekter: Vegobjekt[] = []
  const lines = ndjson.split(/\r?\n/)

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index]?.trim()
    if (!rawLine) continue
    vegobjekter.push(parseVegobjektNdjsonLine(rawLine, index + 1))
  }

  return vegobjekter
}

export function getVegobjekterStreamRequestKey({
  typeIds,
  polygon,
  vegsystemreferanse,
  dato,
  antall = VEGOBJEKTER_STREAM_LIMIT,
}: VegobjekterStreamRequest): string {
  return JSON.stringify({
    antall,
    dato: dato ?? null,
    polygon: polygon ?? null,
    typeIds: typeIds ?? null,
    vegsystemreferanse: vegsystemreferanse ?? null,
  })
}

function isTimeoutErrorLike(error: unknown): boolean {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String((error as { name?: unknown }).name) : ''
  const message = error instanceof Error ? error.message : String(error)
  const normalizedMessage = message.toLowerCase()
  return name === 'TimeoutError' || normalizedMessage.includes('timeout') || normalizedMessage.includes('timed out')
}

async function collectVegobjekterNdjsonStream(
  stream: ReadableStream<Uint8Array>,
  onProgress?: (fetchedCount: number) => void,
): Promise<{ timedOut: boolean; vegobjekter: Vegobjekt[] }> {
  const vegobjekter: Vegobjekt[] = []
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let bufferedText = ''
  let lineNumber = 0

  const parseAvailableLines = (finalChunk: boolean) => {
    const normalized = bufferedText.replace(/\r\n/g, '\n')
    const lines = normalized.split('\n')
    bufferedText = finalChunk ? '' : (lines.pop() ?? '')
    const previousCount = vegobjekter.length

    for (const line of lines) {
      const rawLine = line.trim()
      if (!rawLine) continue
      lineNumber += 1
      vegobjekter.push(parseVegobjektNdjsonLine(rawLine, lineNumber))
    }

    if (vegobjekter.length > previousCount) {
      onProgress?.(vegobjekter.length)
    }
  }

  while (true) {
    try {
      const { done, value } = await reader.read()
      if (done) break
      bufferedText += decoder.decode(value, { stream: true })
      parseAvailableLines(false)
    } catch (error) {
      if (vegobjekter.length > 0 && isTimeoutErrorLike(error)) {
        return {
          timedOut: true,
          vegobjekter,
        }
      }
      throw error
    }
  }

  bufferedText += decoder.decode()
  parseAvailableLines(true)

  return {
    timedOut: false,
    vegobjekter,
  }
}

export async function parseVegobjekterNdjsonStream(stream: ReadableStream<Uint8Array>, onProgress?: (fetchedCount: number) => void): Promise<Vegobjekt[]> {
  const result = await collectVegobjekterNdjsonStream(stream, onProgress)
  return result.vegobjekter
}

export function runDedupedVegobjekterStream(
  request: VegobjekterStreamRequest,
  {
    onProgress,
    signal,
  }: {
    onProgress?: VegobjekterStreamProgress
    signal?: AbortSignal
  },
  fetcher: VegobjekterStreamFetcher,
): Promise<VegobjekterStreamResult> {
  const requestKey = getVegobjekterStreamRequestKey(request)
  let entry = inflightVegobjekterStreams.get(requestKey)
  const progressListener = onProgress
  let abortListener: (() => void) | undefined

  if (!entry) {
    const listeners = new Set<VegobjekterStreamProgress>()
    if (progressListener) {
      listeners.add(progressListener)
    }
    const createdEntry: InflightVegobjekterStream = {
      fetchedCount: 0,
      listeners,
      promise: Promise.resolve({ vegobjekter: [] as Vegobjekt[] }),
    }
    inflightVegobjekterStreams.set(requestKey, createdEntry)

    createdEntry.promise = fetcher(request, (fetchedCount) => {
      createdEntry.fetchedCount = fetchedCount
      for (const listener of createdEntry.listeners) {
        listener(fetchedCount)
      }
    }).finally(() => {
      inflightVegobjekterStreams.delete(requestKey)
    })
    entry = createdEntry
  } else if (progressListener) {
    entry.listeners.add(progressListener)
    if (entry.fetchedCount > 0) {
      progressListener(entry.fetchedCount)
    }
  }

  if (signal && progressListener) {
    abortListener = () => {
      entry?.listeners.delete(progressListener)
    }
    signal.addEventListener('abort', abortListener, { once: true })
  }

  return entry.promise.finally(() => {
    if (progressListener) {
      entry?.listeners.delete(progressListener)
    }
    if (signal && abortListener) {
      signal.removeEventListener('abort', abortListener)
    }
  })
}

async function fetchVegobjekterMedPolygonStream(
  { typeIds, polygon, vegsystemreferanse, dato, antall = VEGOBJEKTER_STREAM_LIMIT }: VegobjekterStreamRequest,
  onProgress: VegobjekterStreamProgress,
): Promise<VegobjekterStreamResult> {
  const response = await sdkHentVegobjekterMultiTypeStream({
    query: {
      typeIder: typeIds,
      antall,
      dato,
      inkluder: ['alle'],
      polygon,
      vegsystemreferanse: vegsystemreferanse ? [vegsystemreferanse] : undefined,
    },
    parseAs: 'stream',
  })

  if (response.error) {
    throw createVegobjekterRequestError(response.error, response.response?.status)
  }

  const stream = response.data as unknown

  if (!(stream instanceof ReadableStream)) {
    throw new Error('Failed to fetch vegobjekter: expected NDJSON stream response')
  }

  const result = await collectVegobjekterNdjsonStream(stream, onProgress)

  return {
    vegobjekter: result.vegobjekter,
    warning: result.timedOut ? 'Viser delvis resultat: forespørselen traff tidsgrensen før alle vegobjekter ble hentet.' : null,
  }
}

export function hentVegobjekterStream({
  typeIds,
  polygon,
  vegsystemreferanse,
  dato,
  antall = VEGOBJEKTER_STREAM_LIMIT,
  signal,
  onProgress,
}: VegobjekterStreamQuery): Promise<VegobjekterStreamResult> {
  return runDedupedVegobjekterStream(
    {
      typeIds,
      polygon,
      vegsystemreferanse,
      dato,
      antall,
    },
    {
      onProgress,
      signal,
    },
    fetchVegobjekterMedPolygonStream,
  )
}

export function getStedfestingFilter(veglenkesekvensIds: number[]): string {
  return veglenkesekvensIds.join(',')
}

export interface VeglenkeRange {
  veglenkesekvensId: number
  startposisjon: number
  sluttposisjon: number
}

export interface VeglenkeMedPosisjon extends Veglenke {
  startposisjon: number
  sluttposisjon: number
}

export interface VeglenkesekvensMedPosisjoner extends Omit<Veglenkesekvens, 'veglenker'> {
  veglenker: VeglenkeMedPosisjon[]
}

export function enrichVeglenkesekvens(vs: Veglenkesekvens): VeglenkesekvensMedPosisjoner {
  const porter = vs.porter ?? []
  const veglenker: VeglenkeMedPosisjon[] = (vs.veglenker ?? []).map((vl) => {
    const startPort = porter.find((p) => p.nummer === vl.startport)
    const endPort = porter.find((p) => p.nummer === vl.sluttport)
    const startPos = startPort?.posisjon ?? 0
    const endPos = endPort?.posisjon ?? 1
    return {
      ...vl,
      startposisjon: Math.min(startPos, endPos),
      sluttposisjon: Math.max(startPos, endPos),
    }
  })
  return { ...vs, veglenker }
}

export function enrichVeglenkesekvenser(vss: Veglenkesekvens[]): VeglenkesekvensMedPosisjoner[] {
  return vss.map(enrichVeglenkesekvens)
}

export function getVeglenkePositionRange(veglenkesekvens: Veglenkesekvens, veglenke: Veglenke): { start: number; end: number } | null {
  const porter = veglenkesekvens.porter
  if (!porter) return null

  const startPort = porter.find((p) => p.nummer === veglenke.startport)
  const endPort = porter.find((p) => p.nummer === veglenke.sluttport)

  if (!startPort || !endPort) return null

  const start = Math.min(startPort.posisjon, endPort.posisjon)
  const end = Math.max(startPort.posisjon, endPort.posisjon)

  return { start, end }
}

function formatPosition(value: number): string {
  const str = value.toString()
  const dotIndex = str.indexOf('.')
  if (dotIndex === -1) return str
  const decimals = str.length - dotIndex - 1
  if (decimals <= 8) return str
  return parseFloat(value.toFixed(8)).toString()
}

export function buildStedfestingFilter(ranges: VeglenkeRange[]): string {
  const grouped = new Map<number, VeglenkeRange[]>()

  for (const range of ranges) {
    const existing = grouped.get(range.veglenkesekvensId)
    if (existing) {
      existing.push(range)
    } else {
      grouped.set(range.veglenkesekvensId, [range])
    }
  }

  const merged: VeglenkeRange[] = []

  for (const [veglenkesekvensId, items] of grouped.entries()) {
    const sorted = items.slice().sort((a, b) => a.startposisjon - b.startposisjon)

    const current = sorted[0]
    if (!current) continue

    let currentStart = Math.min(current.startposisjon, current.sluttposisjon)
    let currentEnd = Math.max(current.startposisjon, current.sluttposisjon)

    for (let i = 1; i < sorted.length; i += 1) {
      const next = sorted[i] as typeof current
      const nextStart = Math.min(next.startposisjon, next.sluttposisjon)
      const nextEnd = Math.max(next.startposisjon, next.sluttposisjon)

      if (currentEnd === nextStart) {
        currentEnd = nextEnd
        continue
      }

      merged.push({
        veglenkesekvensId,
        startposisjon: currentStart,
        sluttposisjon: currentEnd,
      })
      currentStart = nextStart
      currentEnd = nextEnd
    }

    merged.push({
      veglenkesekvensId,
      startposisjon: currentStart,
      sluttposisjon: currentEnd,
    })
  }

  return merged.map((range) => `${formatPosition(range.startposisjon)}-${formatPosition(range.sluttposisjon)}@${range.veglenkesekvensId}`).join(',')
}

export function getVegobjektPositions(stedfesting: Stedfesting | undefined, veglenkesekvensId: number): { start: number; slutt: number }[] {
  if (!stedfesting) return []

  switch (stedfesting.type) {
    case 'StedfestingLinjer':
      return stedfesting.linjer.filter((l) => l.id === veglenkesekvensId).map((l) => ({ start: l.startposisjon, slutt: l.sluttposisjon }))

    case 'StedfestingPunkter':
      return stedfesting.punkter.filter((p) => p.id === veglenkesekvensId).map((p) => ({ start: p.posisjon, slutt: p.posisjon }))

    case 'StedfestingSving':
      if (stedfesting.startpunkt.id === veglenkesekvensId) {
        return [
          {
            start: stedfesting.startpunkt.posisjon,
            slutt: stedfesting.startpunkt.posisjon,
          },
        ]
      }
      if (stedfesting.sluttpunkt.id === veglenkesekvensId) {
        return [
          {
            start: stedfesting.sluttpunkt.posisjon,
            slutt: stedfesting.sluttpunkt.posisjon,
          },
        ]
      }
      return []

    default:
      return []
  }
}

export function isOnVeglenke(stedfesting: Stedfesting | undefined, veglenkesekvensId: number, veglenkeStart: number, veglenkeEnd: number): boolean {
  const positions = getVegobjektPositions(stedfesting, veglenkesekvensId)
  return positions.some((pos) => pos.slutt >= veglenkeStart && pos.start <= veglenkeEnd)
}

export function formatStedfesting(stedfesting: Stedfesting | undefined): string[] {
  if (!stedfesting) return []

  switch (stedfesting.type) {
    case 'StedfestingLinjer':
      return stedfesting.linjer.map((l) => `${l.startposisjon.toFixed(3)}-${l.sluttposisjon.toFixed(3)}@${l.id}`)

    case 'StedfestingPunkter':
      return stedfesting.punkter.map((p) => `${p.posisjon.toFixed(3)}@${p.id}`)

    case 'StedfestingSving':
      return [
        `Sving: ${stedfesting.startpunkt.posisjon.toFixed(3)}@${stedfesting.startpunkt.id} -> ${stedfesting.sluttpunkt.posisjon.toFixed(3)}@${stedfesting.sluttpunkt.id}`,
      ]

    default:
      return ['Mangler stedfesting']
  }
}

export function getEgenskapDisplayValue(egenskap: EgenskapVerdi): string {
  switch (egenskap.type) {
    case 'TekstEgenskap':
      return (egenskap as TekstEgenskap).verdi
    case 'HeltallEgenskap':
      return String((egenskap as HeltallEgenskap).verdi)
    case 'FlyttallEgenskap':
      return String((egenskap as FlyttallEgenskap).verdi)
    case 'BoolskEgenskap':
      return (egenskap as BoolskEgenskap).verdi ? 'Ja' : 'Nei'
    case 'DatoEgenskap':
      return (egenskap as DatoEgenskap).verdi
    case 'EnumEgenskap':
      return `enum:${(egenskap as EnumEgenskap).verdi}`
    case 'GeometriEgenskap':
      return '[Geometri]'
    default:
      return '[Ukjent type]'
  }
}

export function getGeometriEgenskaper(vegobjekt: Vegobjekt): Geometristruktur[] {
  const egenskaper = vegobjekt.egenskaper
  if (!egenskaper) return []

  const result: Geometristruktur[] = []
  for (const egenskap of Object.values(egenskaper)) {
    if (egenskap.type === 'GeometriEgenskap') {
      result.push((egenskap as GeometriEgenskap).verdi)
    }
  }
  return result
}
