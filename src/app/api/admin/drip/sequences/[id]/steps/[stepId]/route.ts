import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// PUT: ステップ更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const { stepId } = await params
    const body = await request.json()
    const { label, dayOffset, sendTime, templateId, conditionType, sortOrder } = body

    const existing = await prisma.dripStep.findUnique({ where: { id: stepId } })
    if (!existing) {
      return NextResponse.json({ error: 'ステップが見つかりません' }, { status: 404 })
    }

    const step = await prisma.dripStep.update({
      where: { id: stepId },
      data: {
        ...(label !== undefined ? { label } : {}),
        ...(dayOffset !== undefined ? { dayOffset } : {}),
        ...(sendTime !== undefined ? { sendTime } : {}),
        ...(templateId !== undefined ? { templateId: templateId || null } : {}),
        ...(conditionType !== undefined ? { conditionType: conditionType || null } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
      include: {
        template: { select: { id: true, name: true, subject: true } },
      },
    })

    return NextResponse.json(step)
  } catch (error) {
    console.error('[Drip] Step update error:', error)
    return NextResponse.json({ error: 'ステップの更新に失敗しました' }, { status: 500 })
  }
}

// DELETE: ステップ削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const { stepId } = await params

    const existing = await prisma.dripStep.findUnique({ where: { id: stepId } })
    if (!existing) {
      return NextResponse.json({ error: 'ステップが見つかりません' }, { status: 404 })
    }

    // 関連するメールログを削除
    await prisma.dripEmailLog.deleteMany({ where: { stepId } })
    await prisma.dripStep.delete({ where: { id: stepId } })

    return NextResponse.json({ success: true, message: 'ステップを削除しました' })
  } catch (error) {
    console.error('[Drip] Step delete error:', error)
    return NextResponse.json({ error: 'ステップの削除に失敗しました' }, { status: 500 })
  }
}
