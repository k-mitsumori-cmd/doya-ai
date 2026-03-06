export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getLpMonthlyLimitByUserPlan,
  shouldResetMonthlyUsage,
  isWithinFreeHour,
} from '@/lib/pricing'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    const projects = await prisma.lpProject.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        _count: { select: { sections: true } },
        sections: {
          orderBy: { order: 'asc' },
          take: 1,
          select: { id: true, name: true, type: true },
        },
      },
    })

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('[GET /api/lp/projects]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // ===== 使用制限チェック =====
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, firstLoginAt: true },
    })

    let isUnlimited = false

    if (user) {
      // フリーアワー判定
      if (isWithinFreeHour(user.firstLoginAt)) isUnlimited = true

      const monthlyLimit = getLpMonthlyLimitByUserPlan(user.plan)
      if (monthlyLimit < 0) isUnlimited = true

      if (!isUnlimited) {
        // UserServiceSubscription で月次使用回数管理
        let sub = await prisma.userServiceSubscription.findUnique({
          where: { userId_serviceId: { userId, serviceId: 'lp' } },
        })

        if (!sub) {
          sub = await prisma.userServiceSubscription.create({
            data: { userId, serviceId: 'lp', plan: user.plan || 'FREE' },
          })
        }

        let usedThisMonth = sub.monthlyUsage || 0

        // 月次リセット
        if (shouldResetMonthlyUsage(sub.lastUsageReset)) {
          await prisma.userServiceSubscription.update({
            where: { id: sub.id },
            data: { monthlyUsage: 0, lastUsageReset: new Date() },
          })
          usedThisMonth = 0
        }

        if (usedThisMonth >= monthlyLimit) {
          return NextResponse.json(
            {
              error: `今月のLP生成上限（${monthlyLimit}ページ）に達しました`,
              limitReached: true,
              usedThisMonth,
              monthlyLimit,
            },
            { status: 429 }
          )
        }
      }
    }

    const body = await req.json()
    const { name, purpose, productInfo, themeId } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const project = await prisma.lpProject.create({
      data: {
        userId,
        name,
        purpose: purpose || [],
        productInfo: productInfo || null,
        themeId: themeId || 'minimal',
        status: 'draft',
      },
    })

    // 使用回数インクリメント
    if (!isUnlimited) {
      await prisma.userServiceSubscription.upsert({
        where: { userId_serviceId: { userId, serviceId: 'lp' } },
        update: { monthlyUsage: { increment: 1 } },
        create: { userId, serviceId: 'lp', plan: user?.plan || 'FREE', monthlyUsage: 1, lastUsageReset: new Date() },
      })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('[POST /api/lp/projects]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
