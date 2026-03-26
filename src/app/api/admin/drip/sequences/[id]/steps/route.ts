import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST: ステップ追加
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const { id: sequenceId } = await params
    const body = await request.json()
    const { label, dayOffset, sendTime, templateId, conditionType, sortOrder } = body

    // シーケンスの存在確認
    const sequence = await prisma.dripSequence.findUnique({ where: { id: sequenceId } })
    if (!sequence) {
      return NextResponse.json({ error: 'シーケンスが見つかりません' }, { status: 404 })
    }

    if (typeof dayOffset !== 'number') {
      return NextResponse.json({ error: 'dayOffset は必須です' }, { status: 400 })
    }

    // sortOrder が未指定の場合は最後に追加
    let finalSortOrder = sortOrder
    if (finalSortOrder === undefined || finalSortOrder === null) {
      const maxStep = await prisma.dripStep.findFirst({
        where: { sequenceId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      })
      finalSortOrder = (maxStep?.sortOrder ?? -1) + 1
    }

    const step = await prisma.dripStep.create({
      data: {
        sequenceId,
        label: label || '',
        dayOffset,
        sendTime: sendTime || '09:00',
        templateId: templateId || null,
        conditionType: conditionType || null,
        sortOrder: finalSortOrder,
      },
      include: {
        template: { select: { id: true, name: true, subject: true } },
      },
    })

    return NextResponse.json(step, { status: 201 })
  } catch (error) {
    console.error('[Drip] Step create error:', error)
    return NextResponse.json({ error: 'ステップの追加に失敗しました' }, { status: 500 })
  }
}

// PUT: ステップの並び替え
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const { id: sequenceId } = await params
    const body = await request.json()
    const { steps } = body

    if (!Array.isArray(steps)) {
      return NextResponse.json({ error: 'steps 配列が必要です' }, { status: 400 })
    }

    // トランザクションで一括更新
    await prisma.$transaction(
      steps.map((s: { id: string; sortOrder: number }) =>
        prisma.dripStep.update({
          where: { id: s.id },
          data: { sortOrder: s.sortOrder },
        })
      )
    )

    // 更新後のステップ一覧を返す
    const updatedSteps = await prisma.dripStep.findMany({
      where: { sequenceId },
      orderBy: { sortOrder: 'asc' },
      include: {
        template: { select: { id: true, name: true, subject: true } },
      },
    })

    return NextResponse.json(updatedSteps)
  } catch (error) {
    console.error('[Drip] Step reorder error:', error)
    return NextResponse.json({ error: 'ステップの並び替えに失敗しました' }, { status: 500 })
  }
}
