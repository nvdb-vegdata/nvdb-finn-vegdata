import type { Vegobjekttype } from '../api/datakatalogClient'
import { getEgenskapstypeById, getEnumVerdiById, getVegobjekttypeById } from '../api/datakatalogClient'
import type { EgenskapVerdi, EnumEgenskap, Stedfesting, Vegobjekt } from '../api/uberiketClient'
import { formatStedfesting, getEgenskapDisplayValue } from '../api/uberiketClient'

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function getEgenskapValue(egenskap: EgenskapVerdi, vegobjekttype: Vegobjekttype | undefined, egenskapId: number): string {
  if (egenskap.type === 'GeometriEgenskap') return ''
  const egenskapstype = vegobjekttype ? getEgenskapstypeById(vegobjekttype, egenskapId) : undefined
  if (egenskap.type === 'EnumEgenskap' && egenskapstype) {
    const enumVerdi = getEnumVerdiById(egenskapstype, (egenskap as EnumEgenskap).verdi)
    if (enumVerdi) {
      return enumVerdi.verdi != null ? String(enumVerdi.verdi) : (enumVerdi.kortnavn ?? `ID: ${enumVerdi.id}`)
    }
  }
  return getEgenskapDisplayValue(egenskap)
}

interface ProcessedRow {
  id: number
  versjon: number | undefined
  startdato: string
  sluttdato: string
  stedfesting: string
  egenskaper: Map<string, string>
}

function generateCsvForType(type: Vegobjekttype, objects: Vegobjekt[]): string {
  const rows: ProcessedRow[] = []
  const allEgenskapNames = new Set<string>()
  const vegobjekttype = getVegobjekttypeById(type.id)

  for (const obj of objects) {
    const egenskaper = new Map<string, string>()

    if (obj.egenskaper) {
      for (const [id, egenskap] of Object.entries(obj.egenskaper)) {
        if (egenskap.type === 'GeometriEgenskap') continue
        const egenskapstype = vegobjekttype ? getEgenskapstypeById(vegobjekttype, Number(id)) : undefined
        const name = egenskapstype?.navn ?? `Egenskap ${id}`
        const value = getEgenskapValue(egenskap, vegobjekttype, Number(id))
        if (value) {
          egenskaper.set(name, value)
          allEgenskapNames.add(name)
        }
      }
    }

    const stedfestinger = formatStedfesting(obj.stedfesting as Stedfesting | undefined)

    rows.push({
      id: obj.id,
      versjon: obj.versjon,
      startdato: obj.gyldighetsperiode?.startdato ?? '',
      sluttdato: obj.gyldighetsperiode?.sluttdato ?? '',
      stedfesting: stedfestinger.join('; '),
      egenskaper,
    })
  }

  const sortedEgenskapNames = [...allEgenskapNames].sort()
  const headers = ['ID', 'Versjon', 'Startdato', 'Sluttdato', 'Stedfesting', ...sortedEgenskapNames]

  const csvRows = [headers.map(escapeCsvValue).join(',')]

  for (const row of rows) {
    const values = [
      String(row.id),
      row.versjon != null ? String(row.versjon) : '',
      row.startdato,
      row.sluttdato,
      row.stedfesting,
      ...sortedEgenskapNames.map((name) => row.egenskaper.get(name) ?? ''),
    ]
    csvRows.push(values.map(escapeCsvValue).join(','))
  }

  return csvRows.join('\n')
}

function generateSummaryCsv(vegobjekterByType: Map<number, Vegobjekt[]>, selectedTypes: Vegobjekttype[]): string {
  const headers = ['TypeID', 'TypeNavn', 'Antall']
  const rows = [headers.map(escapeCsvValue).join(',')]

  for (const type of selectedTypes) {
    const count = vegobjekterByType.get(type.id)?.length ?? 0
    rows.push([String(type.id), type.navn ?? `type_${type.id}`, String(count)].map(escapeCsvValue).join(','))
  }

  return rows.join('\n')
}

export function downloadCsvPerType(vegobjekterByType: Map<number, Vegobjekt[]>, selectedTypes: Vegobjekttype[]): void {
  const files: { filename: string; content: string }[] = []

  files.push({ filename: 'sammendrag.csv', content: generateSummaryCsv(vegobjekterByType, selectedTypes) })

  for (const type of selectedTypes) {
    const objects = vegobjekterByType.get(type.id)
    if (!objects?.length) continue

    const csv = generateCsvForType(type, objects)
    const typeName = (type.navn ?? `type_${type.id}`).normalize('NFC').replace(/[/\\?%*:|"<>]/g, '_')
    files.push({ filename: `${typeName}.csv`, content: csv })
  }

  if (files.length <= 1) {
    return
  }

  const zipBlob = createZipBlob(files)
  downloadBlob(zipBlob, 'vegobjekter-per-type.zip')
}

export function downloadCsvAllTypes(vegobjekterByType: Map<number, Vegobjekt[]>, selectedTypes: Vegobjekttype[]): void {
  const summarySection = generateSummaryCsv(vegobjekterByType, selectedTypes)

  const headers = ['TypeID', 'TypeNavn', 'ID', 'Versjon', 'Startdato', 'Sluttdato', 'Stedfesting']
  const dataRows = [headers.map(escapeCsvValue).join(',')]

  for (const type of selectedTypes) {
    const objects = vegobjekterByType.get(type.id)
    if (!objects?.length) continue

    const typeName = type.navn ?? `type_${type.id}`

    for (const obj of objects) {
      const stedfestinger = formatStedfesting(obj.stedfesting as Stedfesting | undefined)
      const values = [
        String(type.id),
        typeName,
        String(obj.id),
        obj.versjon != null ? String(obj.versjon) : '',
        obj.gyldighetsperiode?.startdato ?? '',
        obj.gyldighetsperiode?.sluttdato ?? '',
        stedfestinger.join('; '),
      ]
      dataRows.push(values.map(escapeCsvValue).join(','))
    }
  }

  downloadCsv(`${summarySection}\n\n${dataRows.join('\n')}`, 'vegobjekter.csv')
}

function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([`\uFEFF${csvContent}`], {
    type: 'text/csv;charset=utf-8;',
  })
  downloadBlob(blob, filename)
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) {
    crc = (CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function getDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(date.getFullYear(), 1980)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = Math.floor(date.getSeconds() / 2)

  const dosTime = (hour << 11) | (minute << 5) | second
  const dosDate = ((year - 1980) << 9) | (month << 5) | day
  return { dosTime, dosDate }
}

function uint16LE(value: number): Uint8Array {
  const out = new Uint8Array(2)
  out[0] = value & 0xff
  out[1] = (value >>> 8) & 0xff
  return out
}

function uint32LE(value: number): Uint8Array {
  const out = new Uint8Array(4)
  out[0] = value & 0xff
  out[1] = (value >>> 8) & 0xff
  out[2] = (value >>> 16) & 0xff
  out[3] = (value >>> 24) & 0xff
  return out
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function createZipBlob(files: { filename: string; content: string }[]): Blob {
  const encoder = new TextEncoder()
  const now = new Date()
  const { dosDate, dosTime } = getDosDateTime(now)

  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let localOffset = 0

  for (const file of files) {
    const filenameBytes = encoder.encode(file.filename)
    const dataBytes = encoder.encode(`\uFEFF${file.content}`)
    const checksum = crc32(dataBytes)
    const size = dataBytes.length

    // Info-ZIP Unicode Path Extra Field (0x7075) for broad tool compatibility.
    // Stores the UTF-8 filename explicitly so tools that ignore bit 11 still read it correctly.
    const filenameCrc = crc32(filenameBytes)
    const unicodePathExtra = concatBytes([
      uint16LE(0x7075), // Header ID: "up"
      uint16LE(5 + filenameBytes.length), // Data size: version(1) + crc(4) + name
      new Uint8Array([0x01]), // Version
      uint32LE(filenameCrc), // CRC32 of the filename bytes in the filename field
      filenameBytes, // UTF-8 filename
    ])

    const localHeader = concatBytes([
      uint32LE(0x04034b50),
      uint16LE(20),
      uint16LE(0x0800), // Language Encoding Flag: filename is UTF-8
      uint16LE(0),
      uint16LE(dosTime),
      uint16LE(dosDate),
      uint32LE(checksum),
      uint32LE(size),
      uint32LE(size),
      uint16LE(filenameBytes.length),
      uint16LE(unicodePathExtra.length),
      filenameBytes,
      unicodePathExtra,
    ])
    localParts.push(localHeader, dataBytes)

    const centralHeader = concatBytes([
      uint32LE(0x02014b50),
      uint16LE(20),
      uint16LE(20),
      uint16LE(0x0800), // Language Encoding Flag: filename is UTF-8
      uint16LE(0),
      uint16LE(dosTime),
      uint16LE(dosDate),
      uint32LE(checksum),
      uint32LE(size),
      uint32LE(size),
      uint16LE(filenameBytes.length),
      uint16LE(unicodePathExtra.length),
      uint16LE(0),
      uint16LE(0),
      uint16LE(0),
      uint32LE(0),
      uint32LE(localOffset),
      filenameBytes,
      unicodePathExtra,
    ])
    centralParts.push(centralHeader)

    localOffset += localHeader.length + dataBytes.length
  }

  const centralDirectorySize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const endOfCentralDirectory = concatBytes([
    uint32LE(0x06054b50),
    uint16LE(0),
    uint16LE(0),
    uint16LE(files.length),
    uint16LE(files.length),
    uint32LE(centralDirectorySize),
    uint32LE(localOffset),
    uint16LE(0),
  ])

  const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
    const copy = new Uint8Array(bytes.length)
    copy.set(bytes)
    return copy.buffer
  }

  return new Blob([...localParts.map(toArrayBuffer), ...centralParts.map(toArrayBuffer), toArrayBuffer(endOfCentralDirectory)], {
    type: 'application/zip',
  })
}
