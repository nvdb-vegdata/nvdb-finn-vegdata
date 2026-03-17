const VEGSYSTEMREFERANSE_REGEX = /^(?:(\d{4})\s*)?([ERFKPS])(?:([VAPF])\s*)?(\d+)(?:\s*S(\d+(?:-\d+)?))?(?:\s*D(\d+(?:-\d+)?))?\s*$/i

export type ParsedVegsystemreferanse = {
  kommune?: string
  kategori: string
  fase?: string
  nummer: string
  strekning?: string
  delstrekning?: string
}

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
