import { NextRequest, NextResponse } from 'next/server'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { z } from 'zod'

export const runtime = 'nodejs'

const BodySchema = z.object({
  urls: z.array(z.string().url()).min(1).max(30),
})

function stripTags(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtmlEntities(text: string): string {
  return String(text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!m) return null
  return decodeHtmlEntities(stripTags(m[1])).slice(0, 200)
}

function extractOgImage(html: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i)
  if (!m) return null
  return String(m[1] || '').trim().slice(0, 1000) || null
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

async function fetchMeta(url: string): Promise<{
  url: string
  host: string
  title: string | null
  ogImage: string | null
  ok: boolean
  error?: string
}> {
  const controller = new AbortController()
  const timeoutMs = 9000
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; DoyaSeoBot/1.0; +https://example.invalid) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
      cache: 'no-store',
    })
    const html = await res.text()
    const title = extractTitle(html)
    const ogImage = extractOgImage(html)
    return { url, host: hostOf(url), title, ogImage, ok: res.ok }
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'timeout' : e?.message || 'fetch failed'
    return { url, host: hostOf(url), title: null, ogImage: null, ok: false, error: msg }
  } finally {
    clearTimeout(t)
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSeoSchema()
    const body = BodySchema.parse(await req.json())
    const items = await Promise.all(body.urls.map((u) => fetchMeta(u)))
    return NextResponse.json({ success: true, items })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 400 })
  }
}


