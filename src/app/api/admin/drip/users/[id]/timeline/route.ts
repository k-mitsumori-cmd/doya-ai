import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET: ユーザーのメール送信タイムライン
export async function GET(
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

    const { id: userId } = await params

    // ユーザーの存在確認
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
    }

    const logs = await prisma.dripEmailLog.findMany({
      where: { userId },
      orderBy: { sentAt: 'desc' },
      include: {
        step: {
          select: {
            id: true,
            label: true,
            dayOffset: true,
            sortOrder: true,
            template: { select: { id: true, name: true, subject: true } },
          },
        },
        enrollment: {
          select: {
            id: true,
            status: true,
            enrolledAt: true,
            sequence: { select: { id: true, name: true } },
          },
        },
      },
    })

    // 配信停止情報
    const unsubscribe = await prisma.dripUnsubscribe.findFirst({
      where: { userId },
      select: { id: true, reason: true, unsubscribedAt: true },
    })

    return NextResponse.json({
      user,
      unsubscribe: unsubscribe || null,
      timeline: logs,
    })
  } catch (error) {
    console.error('[Drip] User timeline error:', error)
    return NextResponse.json({ error: 'タイムラインの取得に失敗しました' }, { status: 500 })
  }
}
