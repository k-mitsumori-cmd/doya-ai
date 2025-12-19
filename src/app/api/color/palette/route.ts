import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ExtractedColor = { hex: string; count: number }
type BrandPalette = {
  primary: string
  secondary: string
  accent: string
  background: string
  text: string
  cta: string
}

type PaletteResult = {
  sourceUrl: string
  colors: ExtractedColor[]
  palette: BrandPalette
}

type PaletteResponse = {
  success: boolean
  data?: PaletteResult
  error?: string
}

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max)
}

function toHex2(n: number) {
  return clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0').toUpperCase()
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`
}

function parseHexColor(hex: string): string | null {
  const h = hex.replace('#', '').trim()
  if (!/^[0-9a-fA-F]{3,8}$/.test(h)) return null

  if (h.length === 3) {
    return rgbToHex(parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16))
  }
  if (h.length === 4) {
    // ignore alpha
    return rgbToHex(parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16))
  }
  if (h.length === 6 || h.length === 8) {
    return rgbToHex(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16))
  }
  return null
}

function parseRgbColor(fn: string): string | null {
  const inside = fn.replace(/^rgba?\(/i, '').replace(/\)$/, '').trim()
  const parts = inside.split(',').map((s) => s.trim())
  if (parts.length < 3) return null

  const parseChannel = (v: string) => {
    if (v.endsWith('%')) return clamp((parseFloat(v) / 100) * 255, 0, 255)
    return clamp(parseFloat(v), 0, 255)
  }

  const r = parseChannel(parts[0])
  const g = parseChannel(parts[1])
  const b = parseChannel(parts[2])
  if (![r, g, b].every((n) => Number.isFinite(n))) return null
  return rgbToHex(r, g, b)
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.match(/^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/)
  if (!m) return null
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}

function luminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const toLin = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * toLin(rgb.r) + 0.7152 * toLin(rgb.g) + 0.0722 * toLin(rgb.b)
}

function isNeutral(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return false
  const range = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b)
  return range < 18
}

function extractColorCounts(html: string): Map<string, number> {
  const counts = new Map<string, number>()
  const add = (hex: string) => counts.set(hex, (counts.get(hex) || 0) + 1)

  // hex
  const hexRe = /#([0-9a-fA-F]{3,8})\b/g
  let m: RegExpExecArray | null
  while ((m = hexRe.exec(html)) !== null) {
    const normalized = parseHexColor(`#${m[1]}`)
    if (normalized) add(normalized)
  }

  // rgb/rgba
  const rgbRe = /rgba?\([^)]+\)/gi
  while ((m = rgbRe.exec(html)) !== null) {
    const normalized = parseRgbColor(m[0])
    if (normalized) add(normalized)
  }

  return counts
}

function buildPalette(sorted: ExtractedColor[]): BrandPalette {
  const fallback: BrandPalette = {
    primary: '#8B5CF6',
    secondary: '#EC4899',
    accent: '#06B6D4',
    background: '#FFFFFF',
    text: '#111827',
    cta: '#111827',
  }
  if (sorted.length === 0) return fallback

  const top = sorted.map((c) => c.hex)
  const nonNeutral = top.filter((c) => !isNeutral(c))

  const primary = nonNeutral[0] || top[0] || fallback.primary
  const secondary = nonNeutral.find((c) => c !== primary) || top.find((c) => c !== primary) || fallback.secondary

  // accent: among top 20, pick most colorful
  const candidates = top.slice(0, 20)
  let accent = secondary
  let bestRange = -1
  for (const c of candidates) {
    const rgb = hexToRgb(c)
    if (!rgb) continue
    const range = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b)
    if (range > bestRange && !isNeutral(c)) {
      bestRange = range
      accent = c
    }
  }

  const bgCandidate =
    top.find((c) => luminance(c) > 0.90) ||
    top.find((c) => isNeutral(c) && luminance(c) > 0.85) ||
    '#FFFFFF'

  const text = luminance(bgCandidate) > 0.6 ? '#111827' : '#FFFFFF'
  const cta = accent || primary
  return { primary, secondary, accent, background: bgCandidate, text, cta }
}

export async function POST(request: NextRequest): Promise<NextResponse<PaletteResponse>> {
  try {
    const body = await request.json()
    const url = normalizeUrl(body?.url)
    if (!url) {
      return NextResponse.json({ success: false, error: 'URLが不正です（http/httpsのみ対応）' }, { status: 400 })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)

    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'doya-ai-color-extractor/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
      cache: 'no-store',
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `サイト取得に失敗しました（${res.status}）` },
        { status: 400 }
      )
    }

    const html = (await res.text()).slice(0, 2_000_000)
    const counts = extractColorCounts(html)
    const colors: ExtractedColor[] = Array.from(counts.entries())
      .map(([hex, count]) => ({ hex, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 60)

    const palette = buildPalette(colors)

    return NextResponse.json({
      success: true,
      data: {
        sourceUrl: url,
        colors: colors.slice(0, 24),
        palette,
      },
    })
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'タイムアウトしました（10秒）' : e?.message || '不明なエラー'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}


