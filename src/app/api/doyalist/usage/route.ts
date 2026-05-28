export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getUserDoyalistLimits,
  countMonthlyCompanies,
  countMonthlyApproaches,
  remaining,
  monthStart,
} from '@/lib/doyalist/limits'

/**
 * GET /api/doyalist/usage
 * ユーザーのプラン・月間利用状況を返す
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const [user, limits, companiesUsed, approachesUsed, activeProjects] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { plan: true, stripeCurrentPeriodEnd: true },
        }),
        getUserDoyalistLimits(userId),
        countMonthlyCompanies(userId),
        countMonthlyApproaches(userId),
        prisma.doyalistProject.count({
          where: { userId, status: { not: 'archived' } },
        }),
      ])

    return NextResponse.json({
      success: true,
      plan: {
        raw: user?.plan || 'FREE',
        tier: limits.tier,
        periodEnd: user?.stripeCurrentPeriodEnd || null,
      },
      limits: {
        maxProjects: limits.maxProjects,
        maxCompaniesPerMonth: limits.maxCompaniesPerMonth,
        maxApproachesPerMonth: limits.maxApproachesPerMonth,
      },
      usage: {
        monthStart: monthStart().toISOString(),
        activeProjects,
        companiesGenerated: companiesUsed,
        approachesGenerated: approachesUsed,
      },
      remaining: {
        projects:
          limits.maxProjects < 0
            ? -1
            : Math.max(0, limits.maxProjects - activeProjects),
        companies: remaining(companiesUsed, limits.maxCompaniesPerMonth),
        approaches: remaining(approachesUsed, limits.maxApproachesPerMonth),
      },
    })
  } catch (e: any) {
    console.error('[doyalist/usage][GET]', e)
    return NextResponse.json(
      { error: e?.message || '利用状況の取得に失敗しました' },
      { status: 500 }
    )
  }
}
