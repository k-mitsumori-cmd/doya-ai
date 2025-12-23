import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BANNER_PRICING } from '@/lib/pricing'

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const takeRaw = parseIntParam(searchParams.get('take'), 24)
    const take = Math.min(Math.max(takeRaw, 1), 60)
    const cursor = searchParams.get('cursor') || undefined

    // ギャラリー/履歴は直近3ヶ月のみ保持（DB肥大化防止）
    const retentionDays = 90
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
          },
        })
        .catch((e) => console.error('Gallery cleanup failed:', e))
    }

    // IMPORTANT: generation.output (dataURL) は巨大なので、一覧では絶対に取得しない
    // -> select で必要最小限に絞って、タイムアウト/メモリ増を回避する
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
      select: {
        id: true,
        createdAt: true,
        metadata: true,
        user: { select: { name: true, image: true } },
      },
    })

    const shaped = items.map((g) => {
      const meta: any = g.metadata || {}
      const shareProfile = asBoolFromJson(meta?.shareProfile)
      return {
        id: g.id,
        // 画像はJSONに載せず、サムネURLを返す（体感を軽く）
        thumbUrl: `/api/banner/thumb?id=${encodeURIComponent(g.id)}`,
        createdAt: g.createdAt,
        category: String(meta?.category || ''),
        purpose: String(meta?.purpose || ''),
        size: String(meta?.size || ''),
        keyword: String(meta?.keyword || ''),
        pattern: String(meta?.pattern || ''),
        creator: shareProfile ? (g.user?.name || '匿名') : '匿名',
        creatorImage: shareProfile ? (g.user?.image || null) : null,
      }
    })

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


