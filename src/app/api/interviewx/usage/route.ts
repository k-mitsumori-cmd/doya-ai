// ============================================
// GET /api/interviewx/usage
// ============================================
// 利用状況取得
//
// レスポンス:
//   - totalThisMonth: 今月のプロジェクト作成数
//   - monthlyLimit: 月間上限（-1 = 無制限）
//   - statusBreakdown: ステータス別プロジェクト数

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewXUser, requireAuth, requireDatabase, interviewXMonthlyLimit } from '@/lib/interviewx/access'

// --------------------------------------------------
// GET — 利用状況
// --------------------------------------------------
export async function GET() {
  try {
    const dbErr = requireDatabase()
    if (dbErr) return dbErr

    const { userId, plan } = await getInterviewXUser()
    const authErr = requireAuth(userId)
    if (authErr) return authErr

    // 今月の開始日
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // 今月作成されたプロジェクト数
    const totalThisMonth = await prisma.interviewXProject.count({
      where: {
        userId: userId!,
        createdAt: { gte: monthStart },
      },
    })

    // ステータス別集計
    const statusGroups = await prisma.interviewXProject.groupBy({
      by: ['status'],
      where: { userId: userId! },
      _count: { id: true },
    })

    const statusBreakdown: Record<string, number> = {}
    for (const g of statusGroups) {
      statusBreakdown[g.status] = g._count.id
    }

    const monthlyLimit = interviewXMonthlyLimit(plan)

    return NextResponse.json({
      success: true,
      usage: {
        plan,
        totalThisMonth,
        monthlyLimit,
        remaining: monthlyLimit === -1 ? -1 : Math.max(0, monthlyLimit - totalThisMonth),
        statusBreakdown,
      },
    })
  } catch (e: any) {
    console.error('[interviewx/usage] GET error:', e?.message)
    return NextResponse.json(
      { success: false, error: '利用状況の取得に失敗しました' },
      { status: 500 }
    )
  }
}
