import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { safeFetchText } from '@/lib/net/safe-fetch'
import { z } from 'zod'

export const runtime = 'nodejs'

const BodySchema = z.object({
  urls: z.array(z.string().url().max(8192)).min(1).max(30),
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
  const html = await safeFetchText(url, { timeoutMs: 9000 })
  if (html === null) return { url, host: hostOf(url), title: null, ogImage: null, ok: false, error: 'URLを取得できませんでした' }
  return { url, host: hostOf(url), title: extractTitle(html), ogImage: extractOgImage(html), ok: true }

}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    const body = BodySchema.parse(await req.json())
    const items: Awaited<ReturnType<typeof fetchMeta>>[] = []
    // Preserve input order while bounding per-request outbound concurrency.
    for (let i = 0; i < body.urls.length; i += 5) {
      items.push(...await Promise.all(body.urls.slice(i, i + 5).map(fetchMeta)))
    }
    return NextResponse.json({ success: true, items })
  } catch {
    return NextResponse.json({ success: false, error: '参考URLを確認してください' }, { status: 400 })
  }
}


