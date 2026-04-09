import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style'

const DEFAULT_RGB = { r: 0, g: 110, b: 184 }

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function toHexByte(value: number): string {
  return clampByte(value).toString(16).padStart(2, '0')
}

function parseHexColor(input: string): { r: number; g: number; b: number } | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('#')) return null
  const raw = trimmed.slice(1)
  const normalized =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => `${c}${c}`)
          .join('')
      : raw

  if (normalized.length !== 6) return null

  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)

  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null
  return { r, g, b }
}

function parseRgbColor(input: string): { r: number; g: number; b: number } | null {
  const trimmed = input.trim()
  const match = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i.exec(trimmed)
  if (!match) return null
  const r = Number(match[1])
  const g = Number(match[2])
  const b = Number(match[3])
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null
  return { r: clampByte(r), g: clampByte(g), b: clampByte(b) }
}

function parseColorToRgb(input: string): { r: number; g: number; b: number } | null {
  return parseHexColor(input) ?? parseRgbColor(input)
}

function colorToRgba(input: string, alpha: number): string {
  const rgb = parseColorToRgb(input) ?? DEFAULT_RGB
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

export function normalizeToHexColor(input: string): string {
  const rgb = parseColorToRgb(input) ?? DEFAULT_RGB
  return `#${toHexByte(rgb.r)}${toHexByte(rgb.g)}${toHexByte(rgb.b)}`
}

export function createVeglenkeStyle(color: string): Style {
  return new Style({
    stroke: new Stroke({ color, width: 4 }),
  })
}

export function createVeglenkeFadedStyle(color: string): Style {
  return new Style({
    stroke: new Stroke({ color: colorToRgba(color, 0.35), width: 2 }),
  })
}

export function createVeglenkeSelectedStyle(color: string): Style {
  return new Style({
    stroke: new Stroke({ color, width: 6 }),
  })
}

export const HIGHLIGHT_STYLE = new Style({
  stroke: new Stroke({ color: '#f39c12', width: 8 }),
})

export function createStedfestingStyle(color: string): Style {
  return new Style({
    stroke: new Stroke({ color, width: 4 }),
  })
}

export const STEDFESTING_POINT_STYLE = new Style({
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({ color: 'rgba(52, 152, 219, 0.9)' }),
    stroke: new Stroke({ color: '#2e86c1', width: 2 }),
  }),
})

export const HIGHLIGHT_POINT_STYLE = new Style({
  image: new CircleStyle({
    radius: 10,
    fill: new Fill({ color: 'rgba(243, 156, 18, 0.8)' }),
    stroke: new Stroke({ color: '#e67e22', width: 3 }),
  }),
})

export const EGENGEOMETRI_POINT_STYLE = new Style({
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({ color: 'rgba(155, 89, 182, 0.8)' }),
    stroke: new Stroke({ color: '#8e44ad', width: 2 }),
  }),
})

export const EGENGEOMETRI_LINE_STYLE = new Style({
  stroke: new Stroke({
    color: '#9b59b6',
    width: 4,
    lineDash: [8, 4],
  }),
})

export const EGENGEOMETRI_POLYGON_STYLE = new Style({
  fill: new Fill({ color: 'rgba(155, 89, 182, 0.3)' }),
  stroke: new Stroke({ color: '#8e44ad', width: 2 }),
})

export const POSISJON_VEGLENKE_STYLE = new Style({
  stroke: new Stroke({ color: '#27ae60', width: 5 }),
})

export const POSISJON_POINT_STYLE = new Style({
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({ color: 'rgba(39, 174, 96, 0.9)' }),
    stroke: new Stroke({ color: '#1e8449', width: 2 }),
  }),
})
