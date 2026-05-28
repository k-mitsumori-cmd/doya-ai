export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const type = req.nextUrl.searchParams.get('type') || undefined
    const validTypes = ['form', 'email', 'phone']
    const typeFilter = type && validTypes.includes(type) ? type : undefined

    const approaches = await prisma.doyalistApproach.findMany({
      where: {
        project: { userId },
        ...(typeFilter ? { type: typeFilter } : { type: { in: validTypes } }),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        type: true,
        subject: true,
        body: true,
        status: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ success: true, approaches })
  } catch (e: any) {
    console.error('[doyalist/approaches][GET]', e)
    return NextResponse.json(
      { error: e?.message || '履歴の取得に失敗しました' },
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
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const id = req.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'idは必須です' }, { status: 400 })
    }

    const approach = await prisma.doyalistApproach.findUnique({
      where: { id },
      include: { project: { select: { userId: true } } },
    })
    if (!approach) {
      return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    }
    if (approach.project.userId !== userId) {
      return NextResponse.json({ error: 'アクセス権がありません' }, { status: 403 })
    }

    await prisma.doyalistApproach.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[doyalist/approaches][DELETE]', e)
    return NextResponse.json(
      { error: e?.message || '削除に失敗しました' },
      { status: 500 }
    )
  }
}
