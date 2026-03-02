// ============================================
// GET /api/tenkai/usage
// ============================================
// 月間利用状況

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenkaiPlan, PLAN_LIMITS } from '@/lib/tenkai/access'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const plan = await getTenkaiPlan(userId)
    const limits = PLAN_LIMITS[plan]

    // 現在の年月
    const now = new Date()
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    const yearMonth = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}`

    const usage = await prisma.tenkaiUsage.findUnique({
      where: { userId_yearMonth: { userId, yearMonth } },
    })

    // プロジェクト総数
    const totalProjects = await prisma.tenkaiProject.count({
      where: { userId },
    })

    // 今月の出力数（JST月初をUTCに変換）
    const monthStartUtc = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - 9 * 60 * 60 * 1000)
    const totalOutputsThisMonth = await prisma.tenkaiOutput.count({
      where: {
        project: { userId },
        createdAt: { gte: monthStartUtc },
        status: 'completed',
      },
    })

    return NextResponse.json({
      plan,
      yearMonth,
      usage: {
        creditsUsed: usage?.creditsUsed || 0,
        creditsLimit: limits.monthlyCredits,
        tokensTotal: usage?.tokensTotal || 0,
        projectsCreated: usage?.projectsCreated || 0,
      },
      limits: {
        monthlyCredits: limits.monthlyCredits,
        platforms: limits.platforms,
        inputChars: limits.inputChars,
      },
      stats: {
        totalProjects,
        totalOutputsThisMonth,
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] usage error:', message)
    return NextResponse.json(
      { error: message || '利用状況の取得に失敗しました' },
      { status: 500 }
    )
  }
}
