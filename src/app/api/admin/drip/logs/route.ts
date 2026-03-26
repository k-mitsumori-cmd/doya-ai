import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET: メール送信ログ一覧（フィルタ・ページネーション付き）
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const sequenceId = searchParams.get('sequenceId')
    const userId = searchParams.get('userId')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const skip = (page - 1) * limit

    // フィルタ条件を組み立て
    const where: any = {}
    if (status) where.status = status
    if (sequenceId) where.sequenceId = sequenceId
    if (userId) where.userId = userId

    const [logs, total] = await Promise.all([
      prisma.dripEmailLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          step: { select: { id: true, label: true, dayOffset: true, sortOrder: true } },
          enrollment: {
            select: {
              id: true,
              sequence: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.dripEmailLog.count({ where }),
    ])

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[Drip] Logs list error:', error)
    return NextResponse.json({ error: 'ログの取得に失敗しました' }, { status: 500 })
  }
}
