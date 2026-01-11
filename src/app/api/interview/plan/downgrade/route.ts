import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { type InterviewPlan } from '@/lib/interview/planLimits'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { targetPlan } = body

    if (!targetPlan || !['FREE', 'PRO', 'ENTERPRISE'].includes(targetPlan)) {
      return NextResponse.json(
        { error: '無効なプランです' },
        { status: 400 }
      )
    }

    // サービス別サブスクリプションを取得または作成
    let subscription = await prisma.userServiceSubscription.findUnique({
      where: {
        userId_serviceId: {
          userId,
          serviceId: 'interview',
        },
      },
    })

    if (!subscription) {
      // サブスクリプションが存在しない場合、作成
      subscription = await prisma.userServiceSubscription.create({
        data: {
          userId,
          serviceId: 'interview',
          plan: targetPlan as InterviewPlan,
        },
      })
    } else {
      // 既存のサブスクリプションを更新
      subscription = await prisma.userServiceSubscription.update({
        where: {
          userId_serviceId: {
            userId,
            serviceId: 'interview',
          },
        },
        data: {
          plan: targetPlan as InterviewPlan,
        },
      })
    }

    return NextResponse.json({
      plan: subscription.plan,
      message: 'プランを変更しました',
    })
  } catch (error) {
    console.error('[INTERVIEW] Failed to downgrade plan:', error)
    return NextResponse.json(
      { error: 'プランの変更に失敗しました' },
      { status: 500 }
    )
  }
}

