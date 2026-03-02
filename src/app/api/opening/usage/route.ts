import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getOpeningDailyLimit, OPENING_GUEST_LIMIT } from '@/lib/opening/usage'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    const plan = (session?.user as any)?.openingPlan || 'FREE'

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let usedToday = 0
    if (userId) {
      usedToday = await prisma.openingProject.count({
        where: {
          userId,
          createdAt: { gte: today },
        },
      })
    }

    const dailyLimit = userId ? getOpeningDailyLimit(plan) : OPENING_GUEST_LIMIT
    const remaining = dailyLimit === -1 ? -1 : Math.max(0, dailyLimit - usedToday)

    return NextResponse.json({
      plan,
      dailyLimit,
      usedToday,
      remaining,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
