export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import type { NextRequest } from 'next/server'
import { privateApiJson } from '@/lib/private-api-response'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { jstStartOfMonthUtc } from '@/lib/plan-limit'

const PAGE_SIZE = 50

/**
 * GET /api/doyalist/approaches
 * ログインユーザーの「ツール生成履歴」（フォーム/メール/電話スクリプト）を返す
 * Query: ?type=form|email|phone （省略時は全件）
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return privateApiJson({ error: 'ログインが必要です' }, { status: 401 })
    }

    const params = new URL(req.url).searchParams
    const type = params.get('type') || undefined
    if (type && !['form', 'email', 'phone'].includes(type)) {
      return privateApiJson({ error: '履歴の種類が正しくありません' }, { status: 400 })
    }
    const search = params.get('search')?.trim() || ''
    if (search.length > 200) return privateApiJson({ error: '検索語は200文字以内にしてください' }, { status: 400 })
    const cursor = params.get('cursor')
    if (params.has('cursor') && (!cursor || cursor.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(cursor))) {
      return privateApiJson({ error: 'ページ指定が正しくありません' }, { status: 400 })
    }
    const owner = { project: { userId } }
    const where = {
      ...owner,
      ...(type ? { type } : {}),
      ...(search ? { OR: [
        { subject: { contains: search, mode: 'insensitive' as const } },
        { body: { contains: search, mode: 'insensitive' as const } },
      ] } : {}),
    }
    if (cursor && !await prisma.doyalistApproach.findFirst({ where: { ...where, id: cursor }, select: { id: true } })) {
      return privateApiJson({ error: 'ページ指定が正しくありません' }, { status: 400 })
    }
    const [rows, total, typeCounts, thisMonth] = await Promise.all([
      prisma.doyalistApproach.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
        id: true,
        type: true,
        subject: true,
        body: true,
        status: true,
        createdAt: true,
        },
      }),
      prisma.doyalistApproach.count({ where }),
      prisma.doyalistApproach.groupBy({ by: ['type'], where: owner, _count: { _all: true } }),
      prisma.doyalistApproach.count({ where: { ...owner, createdAt: { gte: jstStartOfMonthUtc() } } }),
    ])
    const approaches = rows.slice(0, PAGE_SIZE)
    const countsByType = Object.fromEntries(typeCounts.map((row) => [row.type, row._count._all]))
    const allTotal = typeCounts.reduce((sum, row) => sum + row._count._all, 0)
    return privateApiJson({
      success: true,
      approaches,
      total,
      nextCursor: rows.length > PAGE_SIZE ? approaches[PAGE_SIZE - 1].id : null,
      summary: { allTotal, thisMonth, countsByType },
    })
  } catch {
    console.error('[doyalist/approaches][GET] failed')
    return privateApiJson(
      { error: '履歴の取得に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/doyalist/approaches?id=xxx
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return privateApiJson({ error: 'ログインが必要です' }, { status: 401 })
    }

    const id = req.nextUrl.searchParams.get('id')
    if (!id) {
      return privateApiJson({ error: 'idは必須です' }, { status: 400 })
    }

    const approach = await prisma.doyalistApproach.findUnique({
      where: { id },
      include: { project: { select: { userId: true } } },
    })
    if (!approach) {
      return privateApiJson({ error: '見つかりません' }, { status: 404 })
    }
    if (approach.project.userId !== userId) {
      return privateApiJson({ error: 'アクセス権がありません' }, { status: 403 })
    }

    await prisma.doyalistApproach.delete({ where: { id } })
    return privateApiJson({ success: true })
  } catch {
    console.error('[doyalist/approaches][DELETE] failed')
    return privateApiJson(
      { error: '削除に失敗しました' },
      { status: 500 }
    )
  }
}
