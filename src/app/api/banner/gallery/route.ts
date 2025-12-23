import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BANNER_PRICING } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

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

    // ギャラリーは直近6ヶ月分のみ表示（古い公開作品は自動削除）
    const retentionDays = BANNER_PRICING.historyDays?.pro || 180
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

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

    const shaped = items.map((g) => {
      const meta: any = g.metadata || {}
      const shareProfile = asBoolFromJson(meta?.shareProfile)
      return {
        id: g.id,
        image: g.output,
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

    return NextResponse.json({ items: shaped, nextCursor })
  } catch (e: any) {
    console.error('Gallery list error:', e)
    return NextResponse.json({ error: 'ギャラリーの取得に失敗しました' }, { status: 500 })
  }
}


