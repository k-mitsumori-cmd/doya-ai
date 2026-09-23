import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getInterviewLimitsByPlan } from '@/lib/pricing'
import { interviewJstMonthStartUtc } from '@/lib/interview/month'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.id) {
      return NextResponse.json({ success: false, error: '未認証' }, { status: 401 })
    }

    // 素材の作成日ではなく、文字起こし完了に伴う最終更新日で当月分を数える。
    const monthStart = interviewJstMonthStartUtc()

    // 今月の文字起こし済み素材の合計duration(秒)を集計
    const result = await prisma.interviewMaterial.aggregate({
      _sum: { duration: true },
      where: {
        project: { userId: user.id },
        status: 'COMPLETED',
        updatedAt: { gte: monthStart },
      },
    })

    const totalSeconds = result._sum.duration || 0
    const usedMinutes = Math.ceil(totalSeconds / 60)

    // プラン別の上限分数
    const plan = user.interviewPlan || user.plan || 'FREE'
    const limits = getInterviewLimitsByPlan(plan)
    const limitMinutes = limits.transcriptionMinutes

    return NextResponse.json({
      success: true,
      usedMinutes,
      limitMinutes,
      plan: String(plan).toUpperCase(),
    })
  } catch (error) {
    console.error('Usage API error:', error)
    return NextResponse.json(
      { success: false, error: '利用状況の取得に失敗しました' },
      { status: 500 }
    )
  }
}
