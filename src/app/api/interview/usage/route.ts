import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getInterviewLimitsByPlan } from '@/lib/pricing'
import { interviewJstMonthStartUtc } from '@/lib/interview/month'
import { getInterviewTranscriptionUsage } from '@/lib/interview/transcription-budget'
import { normalizePlan } from '@/lib/interview/access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.id) {
      return NextResponse.json({ success: false, error: '未認証' }, { status: 401 })
    }

    // プラン別の上限分数
    const plan = user.interviewPlan || user.plan || 'FREE'
    let usedMinutes: number, limitMinutes: number, reservedMinutes = 0
    if (process.env.INTERVIEW_TRANSCRIPTION_QUOTA_ENABLED === '1') {
      const usage = await getInterviewTranscriptionUsage({ userId: user.id, guestId: null, plan: normalizePlan(plan) })
      usedMinutes = Math.ceil(usage.usedSeconds / 60)
      reservedMinutes = Math.ceil(usage.reservedSeconds / 60)
      limitMinutes = usage.limitSeconds < 0 ? -1 : Math.ceil(usage.limitSeconds / 60)
    } else {
      // 素材の作成日ではなく、文字起こし完了に伴う最終更新日で当月分を数える。
      const monthStart = interviewJstMonthStartUtc()
      const result = await prisma.interviewMaterial.aggregate({
        _sum: { duration: true },
        where: { project: { userId: user.id }, status: 'COMPLETED', updatedAt: { gte: monthStart } },
      })
      usedMinutes = Math.ceil((result._sum.duration || 0) / 60)
      limitMinutes = getInterviewLimitsByPlan(plan).transcriptionMinutes
    }

    return NextResponse.json({
      success: true,
      usedMinutes,
      reservedMinutes,
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
