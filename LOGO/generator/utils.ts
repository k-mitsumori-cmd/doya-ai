import crypto from 'node:crypto'

export function slugify(input: string): string {
  const raw = String(input || '').trim().toLowerCase()
  // Keep filesystem paths ASCII-safe for downstream native libs (e.g. sharp/libvips)
  const ascii = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii) return ascii

  // Fallback: stable-ish short hash (so Japanese-only names still work)
  const h = crypto.createHash('sha1').update(raw || String(Date.now())).digest('hex').slice(0, 10)
  return `doya-${h}`
}

export function stableSeed(input: Record<string, unknown>): string {
  const json = JSON.stringify(input, Object.keys(input).sort())
  return crypto.createHash('sha256').update(json).digest('hex').slice(0, 16)
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max)
}

export function normalizeHex(hex: string | undefined): string | null {
  const s = String(hex || '').trim()
  const m = s.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  if (!m) return null
  let raw = m[1].toUpperCase()
  if (raw.length === 3) raw = raw.split('').map((c) => c + c).join('')
  return `#${raw}`
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0').toUpperCase()
  return `#${to(r)}${to(g)}${to(b)}`
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const d = max - min
  let h = 0
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (d !== 0) {
    switch (max) {
      case rr:
        h = ((gg - bb) / d) % 6
        break
      case gg:
        h = (bb - rr) / d + 2
        break
      case bb:
        h = (rr - gg) / d + 4
        break
    }
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s, l }
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const C = (1 - Math.abs(2 * l - 1)) * s
  const X = C * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - C / 2
  let rr = 0, gg = 0, bb = 0
  if (0 <= h && h < 60) [rr, gg, bb] = [C, X, 0]
  else if (60 <= h && h < 120) [rr, gg, bb] = [X, C, 0]
  else if (120 <= h && h < 180) [rr, gg, bb] = [0, C, X]
  else if (180 <= h && h < 240) [rr, gg, bb] = [0, X, C]
  else if (240 <= h && h < 300) [rr, gg, bb] = [X, 0, C]
  else [rr, gg, bb] = [C, 0, X]
  return {
    r: Math.round((rr + m) * 255),
    g: Math.round((gg + m) * 255),
    b: Math.round((bb + m) * 255),
  }
}

export function shiftHue(hex: string, degrees: number): string {
  const { r, g, b } = hexToRgb(hex)
  const { h, s, l } = rgbToHsl(r, g, b)
  const rgb = hslToRgb((h + degrees + 360) % 360, s, l)
  return rgbToHex(rgb.r, rgb.g, rgb.b)
}

export function mix(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  const tt = clamp(t, 0, 1)
  return rgbToHex(
    a.r + (b.r - a.r) * tt,
    a.g + (b.g - a.g) * tt,
    a.b + (b.b - a.b) * tt
  )
}

export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  // quick relative luminance approximation
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

export function readableTextColor(bgHex: string): string {
  return luminance(bgHex) > 0.62 ? '#111827' : '#FFFFFF'
}

export function escapeXml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}


