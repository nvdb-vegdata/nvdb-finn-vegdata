const VEGSYSTEMREFERANSE_REGEX = /^(?:(\d{4})\s*)?([ERFKPS])(?:([VAPF])\s*)?(\d+)(?:\s*S(\d+(?:-\d+)?))?(?:\s*D(\d+(?:-\d+)?))?\s*$/i

const VEGSYSTEMREFERANSE_WITH_METERS_REGEX =
  /^(?:(\d{4})\s*)?([ERFKPS])(?:([VAPF])\s*)?(\d+)(?:\s*S(\d+(?:-\d+)?))?(?:\s*D(\d+(?:-\d+)?))?\s*(?:m(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?)?\s*$/i

const VEGSYSTEMREFERANSE_WITH_METERS_REGEX_KRYSSDEL =
  /^(?:(\d{4})\s*)?([ERFKPS])(?:([VAPF])\s*)?(\d+)(?:\s*S(\d+(?:-\d+)?))?(?:\s*D(\d+(?:-\d+)?))?(?:\s*m\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)?\s*(?:Kryssdel|KD\d+)\s*m(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?\s*$/i

const VEGSYSTEMREFERANSE_WITH_METERS_REGEX_SIDEANLEGG =
  /^(?:(\d{4})\s*)?([ERFKPS])(?:([VAPF])\s*)?(\d+)(?:\s*S(\d+(?:-\d+)?))?(?:\s*D(\d+(?:-\d+)?))?(?:\s*m\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)?\s*(?:Sideanlegg|SD\d+)\s*m(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?\s*$/i

export type ParsedVegsystemreferanse = {
  kommune?: string
  kategori: string
  fase?: string
  nummer: string
  strekning?: string
  delstrekning?: string
}

export type MeterRange = { fra: number; til: number }

export function parseVegsystemreferanse(value: string): ParsedVegsystemreferanse | null {
  const match = VEGSYSTEMREFERANSE_REGEX.exec(value.trim())
  if (!match) return null

  const kommune = match[1]
  const kategori = match[2]?.toUpperCase() ?? ''
  const fase = match[3]?.toUpperCase()
  const nummer = match[4] ?? ''
  const strekning = match[5]
  const delstrekning = match[6]

  if (kommune && !['K', 'P', 'S'].includes(kategori)) {
    return null
  }

  if (delstrekning && !strekning) {
    return null
  }

  return {
    kommune: kommune ?? undefined,
    kategori,
    fase,
    nummer,
    strekning: strekning ?? undefined,
    delstrekning: delstrekning ?? undefined,
  }
}

export function isValidVegsystemreferanse(value: string): boolean {
  return parseVegsystemreferanse(value) !== null
}

function parseMeterRange(match: RegExpExecArray | null): MeterRange | null {
  if (!match) return null

  const fraStr = match[7]
  if (!fraStr) return null

  const fra = parseFloat(fraStr)
  const tilStr = match[8]
  const til = tilStr !== undefined ? parseFloat(tilStr) : fra

  if (!Number.isFinite(fra) || !Number.isFinite(til)) return null

  return { fra: Math.min(fra, til), til: Math.max(fra, til) }
}

export function parseVegsystemreferanseMeter(value: string): MeterRange | null {
  return parseMeterRange(VEGSYSTEMREFERANSE_WITH_METERS_REGEX.exec(value.trim()))
}

export function parseVegsystemreferanseMeterKryssdel(value: string): MeterRange | null {
  return parseMeterRange(VEGSYSTEMREFERANSE_WITH_METERS_REGEX_KRYSSDEL.exec(value.trim()))
}

export function parseVegsystemreferanseMeterSideanlegg(value: string): MeterRange | null {
  return parseMeterRange(VEGSYSTEMREFERANSE_WITH_METERS_REGEX_SIDEANLEGG.exec(value.trim()))
}

export function isValidVegsystemreferanseSegmentering(value: string): boolean {
  const trimmed = value.trim()
  const match = VEGSYSTEMREFERANSE_WITH_METERS_REGEX.exec(trimmed)
  if (!match) return false

  const kommune = match[1]
  const kategori = match[2]?.toUpperCase() ?? ''
  const delstrekning = match[6]
  const strekning = match[5]

  if (kommune && !['K', 'P', 'S'].includes(kategori)) return false
  if (delstrekning && !strekning) return false

  return true
}
