import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// サムネ生成は重いので、同一インスタンス内では短期キャッシュ
const THUMB_CACHE = new Map<string, { ts: number; buf: Buffer }>()
const THUMB_CACHE_TTL_MS = 60 * 60 * 1000 // 1h

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return null
  try {
    return Buffer.from(dataUrl.slice(comma + 1), 'base64')
  } catch {
    return null
  }
}

let PLACEHOLDER_JPEG: Buffer | null = null
async function getPlaceholderJpeg(): Promise<Buffer> {
  if (PLACEHOLDER_JPEG) return PLACEHOLDER_JPEG
  // 壊れ画像でも <img> が壊れないように必ず画像を返す
  PLACEHOLDER_JPEG = await sharp({
    create: { width: 24, height: 24, channels: 3, background: '#F1F5F9' },
  })
    .jpeg({ quality: 60, mozjpeg: true })
    .toBuffer()
  return PLACEHOLDER_JPEG
}

async function fetchAsBuffer(url: string, timeoutMs = 5000): Promise<Buffer | null> {
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, { redirect: 'follow', signal: controller.signal })
    clearTimeout(t)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id') || ''
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const cached = THUMB_CACHE.get(id)
    if (cached && Date.now() - cached.ts < THUMB_CACHE_TTL_MS) {
      const etag = `W/"hist-thumb-${id}"`
      if (req.headers.get('if-none-match') === etag) {
        return new NextResponse(null, {
          status: 304,
          headers: {
            ETag: etag,
            'Cache-Control': 'private, max-age=86400, stale-while-revalidate=604800',
          },
        })
      }
      return new NextResponse(new Uint8Array(cached.buf), {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'private, max-age=86400, stale-while-revalidate=604800',
          ETag: etag,
        },
      })
    }

    const g = await prisma.generation.findFirst({
      where: {
        id,
        userId,
        serviceId: 'banner',
        outputType: 'IMAGE',
      },
      select: { output: true },
    })

    const out = typeof g?.output === 'string' ? g.output : ''
    // dataURL / URL の両方に対応（壊れていてもプレースホルダを返す）
    let input: Buffer | null = null
    if (out.startsWith('data:image/')) input = dataUrlToBuffer(out)
    else if (/^https?:\/\//.test(out)) input = await fetchAsBuffer(out)
    if (!input) input = await getPlaceholderJpeg()

    const buf = await sharp(input)
      .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 35, mozjpeg: true })
      .toBuffer()

    THUMB_CACHE.set(id, { ts: Date.now(), buf })

    const etag = `W/"hist-thumb-${id}"`
    if (req.headers.get('if-none-match') === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': 'private, max-age=60',
        },
      })
    }

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        // 個人履歴だが、同一ブラウザ内では長めにキャッシュして体感速度を優先
        'Cache-Control': 'private, max-age=86400, stale-while-revalidate=604800',
        ETag: etag,
      },
    })
  } catch (e: any) {
    console.error('[banner history thumb] failed:', e)
    // <img> を壊さないため、エラーでも画像を返す
    const buf = await getPlaceholderJpeg()
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, max-age=300',
      },
    })
  }
}


