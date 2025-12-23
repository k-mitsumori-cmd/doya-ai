import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BANNER_PRICING } from '@/lib/pricing'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// クリーンアップ頻度を抑えてレスポンスを軽くする（サーバレスでも一定効果）
let lastGalleryCleanupAt = 0
const GALLERY_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6時間

function parseIntParam(v: string | null, fallback: number) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function asBoolFromJson(value: any): boolean {
  return value === true
}

async function toJpegThumbDataUrl(output: unknown): Promise<string | null> {
  const s = typeof output === 'string' ? output : ''
  if (!s) return null
  if (!s.startsWith('data:image/')) {
    // URL等はそのまま（ここでは変換しない）
    return s
  }
  const comma = s.indexOf(',')
  if (comma === -1) return null
  const b64 = s.slice(comma + 1)
  try {
    const input = Buffer.from(b64, 'base64')
    const buf = await sharp(input)
      .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 35, mozjpeg: true })
      .toBuffer()
    return `data:image/jpeg;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const takeRaw = parseIntParam(searchParams.get('take'), 24)
    const take = Math.min(Math.max(takeRaw, 1), 60)
    const cursor = searchParams.get('cursor') || undefined

    // ギャラリーは直近6ヶ月分のみ表示（古い公開作品は自動削除）
    const retentionDays = BANNER_PRICING.historyDays?.pro || 180
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    const now = Date.now()
    // 最初のページ取得時のみ、かつ一定間隔でだけクリーンアップ
    if (!cursor && now - lastGalleryCleanupAt > GALLERY_CLEANUP_INTERVAL_MS) {
      lastGalleryCleanupAt = now
      prisma.generation
        .deleteMany({
          where: {
            serviceId: 'banner',
            outputType: 'IMAGE',
            createdAt: { lt: cutoffDate },
            metadata: { path: ['shared'], equals: true },
          },
        })
        .catch((e) => console.error('Gallery cleanup failed:', e))
    }

    const items = await prisma.generation.findMany({
      where: {
        serviceId: 'banner',
        outputType: 'IMAGE',
        createdAt: { gte: cutoffDate },
        metadata: {
          path: ['shared'],
          equals: true,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: {
          select: { name: true, image: true },
        },
      },
    })

    const shaped = await Promise.all(items.map(async (g) => {
      const meta: any = g.metadata || {}
      const shareProfile = asBoolFromJson(meta?.shareProfile)
      // 一覧は軽量化のため“粗いサムネ”を返す（元画像は別APIで取得）
      const thumb = await toJpegThumbDataUrl(g.output)
      return {
        id: g.id,
        thumb: thumb || null,
        createdAt: g.createdAt,
        category: String(meta?.category || ''),
        purpose: String(meta?.purpose || ''),
        size: String(meta?.size || ''),
        keyword: String(meta?.keyword || ''),
        pattern: String(meta?.pattern || ''),
        creator: shareProfile ? (g.user?.name || '匿名') : '匿名',
        creatorImage: shareProfile ? (g.user?.image || null) : null,
      }
    }))

    const nextCursor = items.length === take ? items[items.length - 1]?.id : null

    return NextResponse.json(
      { items: shaped, nextCursor },
      {
        // ギャラリー一覧は公開データでユーザー差がないため強めにキャッシュOK（体感高速化）
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400',
        },
      }
    )
  } catch (e: any) {
    console.error('Gallery list error:', e)
    return NextResponse.json({ error: 'ギャラリーの取得に失敗しました' }, { status: 500 })
  }
}


