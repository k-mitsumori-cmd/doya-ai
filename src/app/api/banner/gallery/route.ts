import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function asBoolFromJson(value: any): boolean {
  return value === true
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const take = searchParams.has('take') ? Number(searchParams.get('take')) : 24
    if (!Number.isSafeInteger(take) || take < 1 || take > 60) {
      return NextResponse.json({ error: 'ページ件数が正しくありません' }, { status: 400 })
    }
    const cursor = searchParams.get('cursor')
    if (searchParams.has('cursor') && (!cursor || cursor.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(cursor))) {
      return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
    }

    // 公開ギャラリーには直近3ヶ月分を表示する。閲覧時に利用者の履歴を削除しない。
    const retentionDays = 90
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    // IMPORTANT: generation.output (dataURL) は巨大なので、一覧では絶対に取得しない
    // -> select で必要最小限に絞って、タイムアウト/メモリ増を回避する
    const where = {
      serviceId: 'banner',
      outputType: 'IMAGE',
      createdAt: { gte: cutoffDate },
      metadata: {
        path: ['shared'],
        equals: true,
      },
    } as const
    if (cursor && !await prisma.generation.findFirst({ where: { ...where, id: cursor }, select: { id: true } })) {
      return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
    }
    const rows = await prisma.generation.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        createdAt: true,
        metadata: true,
        user: { select: { name: true, image: true } },
      },
    })

    const items = rows.slice(0, take)
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
        lqip: typeof meta?.lqip === 'string' ? meta.lqip : '',
      }
    })

    const nextCursor = rows.length > take ? items[items.length - 1].id : null

    return NextResponse.json(
      { items: shaped, nextCursor },
      {
        // ギャラリー一覧は公開データでユーザー差がないため強めにキャッシュOK（体感高速化）
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400',
        },
      }
    )
  } catch {
    console.error('[banner/gallery] failed')
    return NextResponse.json({ error: 'ギャラリーの取得に失敗しました' }, { status: 500 })
  }
}
