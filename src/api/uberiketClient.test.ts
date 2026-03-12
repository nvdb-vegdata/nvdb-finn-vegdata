import { describe, expect, test } from 'bun:test'
import {
  getVegobjekterStreamRequestKey,
  hentVegobjekterStream,
  parseVegobjekterNdjson,
  parseVegobjekterNdjsonStream,
  runDedupedVegobjekterStream,
} from './uberiketClient'

describe('parseVegobjekterNdjson', () => {
  test('parses vegobjekter from NDJSON and ignores blank lines', () => {
    const ndjson = [
      JSON.stringify({ id: 101, versjon: 1, typeId: 45, sistEndret: '2026-03-10T10:00:00Z' }),
      '',
      JSON.stringify({ id: 202, versjon: 3, typeId: 46, sistEndret: '2026-03-10T11:00:00Z' }),
      '',
    ].join('\n')

    const result = parseVegobjekterNdjson(ndjson)

    expect(result).toHaveLength(2)
    expect(result[0]?.id).toBe(101)
    expect(result[1]?.typeId).toBe(46)
  })

  test('throws with line information when NDJSON contains invalid JSON', () => {
    expect(() => parseVegobjekterNdjson('{"id": 101, "versjon": 1, "typeId": 45, "sistEndret": "2026-03-10T10:00:00Z"}\nnot-json')).toThrow(/line 2/i)
  })

  test('streams vegobjekter progressively and reports fetched count', async () => {
    const encoder = new TextEncoder()
    const progressCounts: number[] = []
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"id":101,"versjon":1,"typeId":45,"sistEndret":"2026-03-10T10:00:00Z"}\n{"id":202,"versjon":2,'))
        controller.enqueue(encoder.encode('"typeId":46,"sistEndret":"2026-03-10T11:00:00Z"}\n'))
        controller.close()
      },
    })

    const result = await parseVegobjekterNdjsonStream(stream, (count) => {
      progressCounts.push(count)
    })

    expect(result).toHaveLength(2)
    expect(progressCounts).toEqual([1, 2])
  })

  test('deduplicates identical polygon stream requests', async () => {
    const progressA: number[] = []
    const progressB: number[] = []
    let fetchCalls = 0

    const request = {
      antall: 10000,
      dato: '2026-03-10',
      polygon: '1 2, 3 4, 5 6, 1 2',
      typeIds: [1, 2],
    }

    const fetcher = async (
      _request: { antall?: number; dato?: string; polygon?: string; stedfesting?: string; typeIds?: number[]; vegsystemreferanse?: string },
      onProgress: (fetchedCount: number) => void,
    ) => {
      fetchCalls += 1
      onProgress(2)
      await Promise.resolve()
      return {
        vegobjekter: [
          { id: 101, versjon: 1, typeId: 1, sistEndret: '2026-03-10T10:00:00Z' },
          { id: 202, versjon: 1, typeId: 2, sistEndret: '2026-03-10T10:00:00Z' },
        ],
      }
    }

    const [resultA, resultB] = await Promise.all([
      runDedupedVegobjekterStream(request, { onProgress: (count) => progressA.push(count) }, fetcher),
      runDedupedVegobjekterStream(request, { onProgress: (count) => progressB.push(count) }, fetcher),
    ])

    expect(fetchCalls).toBe(1)
    expect(resultA.vegobjekter).toHaveLength(2)
    expect(resultB.vegobjekter).toHaveLength(2)
    expect(progressA).toEqual([2])
    expect(progressB).toEqual([2])
  })

  test('deduplicates identical strekning stream requests', async () => {
    let fetchCalls = 0

    const request = {
      antall: 10000,
      dato: '2026-03-10',
      vegsystemreferanse: 'EV6S1',
    }

    const fetcher = async (_request: {
      antall?: number
      dato?: string
      polygon?: string
      stedfesting?: string
      typeIds?: number[]
      vegsystemreferanse?: string
    }) => {
      fetchCalls += 1
      await Promise.resolve()
      return {
        vegobjekter: [{ id: 303, versjon: 1, typeId: 3, sistEndret: '2026-03-10T10:00:00Z' }],
      }
    }

    const [resultA, resultB] = await Promise.all([runDedupedVegobjekterStream(request, {}, fetcher), runDedupedVegobjekterStream(request, {}, fetcher)])

    expect(fetchCalls).toBe(1)
    expect(resultA.vegobjekter).toHaveLength(1)
    expect(resultB.vegobjekter).toHaveLength(1)
  })

  test('deduplicates identical stedfesting stream requests', async () => {
    let fetchCalls = 0

    const request = {
      antall: 10000,
      dato: '2026-03-10',
      stedfesting: '0.1-0.4@1234,0.5@5678',
    }

    const fetcher = async (_request: {
      antall?: number
      dato?: string
      polygon?: string
      stedfesting?: string
      typeIds?: number[]
      vegsystemreferanse?: string
    }) => {
      fetchCalls += 1
      await Promise.resolve()
      return {
        vegobjekter: [{ id: 404, versjon: 1, typeId: 4, sistEndret: '2026-03-10T10:00:00Z' }],
      }
    }

    const [resultA, resultB] = await Promise.all([runDedupedVegobjekterStream(request, {}, fetcher), runDedupedVegobjekterStream(request, {}, fetcher)])

    expect(fetchCalls).toBe(1)
    expect(resultA.vegobjekter).toHaveLength(1)
    expect(resultB.vegobjekter).toHaveLength(1)
  })

  test('includes stedfesting in the stream request key', () => {
    expect(
      getVegobjekterStreamRequestKey({
        antall: 10000,
        dato: '2026-03-10',
        stedfesting: '0.1-0.4@1234,0.5@5678',
      }),
    ).toContain('"stedfesting":"0.1-0.4@1234,0.5@5678"')
  })

  test('keeps partial stream results on timeout and returns a warning', async () => {
    const originalFetch = globalThis.fetch
    const encoder = new TextEncoder()
    let firstChunkSent = false

    globalThis.fetch = (async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          pull(controller) {
            if (!firstChunkSent) {
              firstChunkSent = true
              controller.enqueue(encoder.encode('{"id":101,"versjon":1,"typeId":45,"sistEndret":"2026-03-10T10:00:00Z"}\n'))
              return
            }
            controller.error(new DOMException('Timed out', 'TimeoutError'))
          },
        }),
        {
          headers: {
            'Content-Type': 'application/x-ndjson',
          },
          status: 200,
        },
      )) as unknown as typeof fetch

    try {
      const result = await hentVegobjekterStream({
        polygon: '1 2, 3 4, 5 6, 1 2',
      })

      expect(result.vegobjekter).toHaveLength(1)
      expect(result.warning).toMatch(/delvis resultat/i)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
