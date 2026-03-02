// ============================================
// GET /api/voice/usage — 月次利用状況
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getVoiceMonthlyLimitByUserPlan } from '@/lib/pricing'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.id) {
      return NextResponse.json({ success: false, error: '未認証' }, { status: 401 })
    }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const usedCount = await prisma.voiceProject.count({
      where: {
        userId: user.id,
        status: 'completed',
        createdAt: { gte: monthStart },
      },
    })

    const plan = user.voicePlan || user.plan || 'FREE'
    const limit = getVoiceMonthlyLimitByUserPlan(plan)

    return NextResponse.json({
      success: true,
      used: usedCount,
      limit,
      plan: String(plan).toUpperCase(),
    })
  } catch (error) {
    console.error('Voice usage API error:', error)
    return NextResponse.json(
      { success: false, error: '利用状況の取得に失敗しました' },
      { status: 500 }
    )
  }
}
