import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserPlan, type InterviewPlan } from '@/lib/interview/planLimits'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id || null
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    let plan: InterviewPlan = 'GUEST'
    let guestFirstAccessAt: Date | null = null

    if (userId) {
      // ログインユーザーの場合、サービス別サブスクリプションを取得
      const subscription = await prisma.userServiceSubscription.findUnique({
        where: {
          userId_serviceId: {
            userId,
            serviceId: 'interview',
          },
        },
      })

      // 統一プランも取得（UserServiceSubscriptionが存在しない場合のフォールバック）
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      })

      const unifiedPlan = user?.plan || null

      console.log('[INTERVIEW] Current plan API - User subscription:', {
        userId,
        serviceId: 'interview',
        subscriptionPlan: subscription?.plan || null,
        subscriptionExists: !!subscription,
        unifiedPlan,
      })

      // UserServiceSubscriptionが存在する場合はそれを使用、存在しない場合は統一プランをフォールバックとして使用
      const planToUse = subscription?.plan || unifiedPlan
      plan = await getUserPlan(userId, null, planToUse)
      
      console.log('[INTERVIEW] Current plan API - Resolved plan:', {
        userId,
        subscriptionPlan: subscription?.plan,
        unifiedPlan,
        planToUse,
        resolvedPlan: plan,
      })
    } else if (guestId) {
      // ゲストユーザーの場合、ゲストセッションを取得または作成
      let guestSession = await (prisma as any).guestSession.findUnique({
        where: { guestId },
      })

      if (!guestSession) {
        // 初回アクセスの場合、ゲストセッションを作成
        guestSession = await (prisma as any).guestSession.create({
          data: {
            guestId,
            firstAccessAt: new Date(),
            lastAccessAt: new Date(),
          },
        })
      } else {
        // 既存セッションの場合、最終アクセス時刻を更新
        guestSession = await (prisma as any).guestSession.update({
          where: { guestId },
          data: { lastAccessAt: new Date() },
        })
      }

      guestFirstAccessAt = guestSession.firstAccessAt
      plan = 'GUEST'
    }

    return NextResponse.json({
      plan,
      guestFirstAccessAt,
    })
  } catch (error) {
    console.error('[INTERVIEW] Failed to get current plan:', error)
    return NextResponse.json(
      { error: 'プランの取得に失敗しました' },
      { status: 500 }
    )
  }
}

