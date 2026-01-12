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
      // 統一プランは、user.planとサービス別サブスクリプション（banner, writing, persona, seo）の最大値
      // ただし、interviewサービスは統一プランの計算には含めない（interviewサービスは独立したプラン管理）
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { 
          plan: true,
          serviceSubscriptions: {
            where: {
              serviceId: { in: ['banner', 'writing', 'persona', 'seo'] }
            },
            select: { plan: true }
          }
        },
      })

      // 統一プランを計算（auth.tsと同じロジック）
      const { normalizeUnifiedPlan, maxPlan } = await import('@/lib/planSync')
      const serviceMax = user?.serviceSubscriptions
        ?.map((s) => normalizeUnifiedPlan(s.plan))
        .reduce((acc, p) => maxPlan(acc, p), 'FREE' as const) || 'FREE'
      const unifiedPlan = maxPlan(normalizeUnifiedPlan(user?.plan || 'FREE'), serviceMax)

      console.log('[INTERVIEW] Current plan API - User subscription:', {
        userId,
        serviceId: 'interview',
        subscriptionPlan: subscription?.plan || null,
        subscriptionExists: !!subscription,
        unifiedPlan,
      })

      // プラン解決ロジック：
      // 1. 統一プランがENTERPRISEの場合、ENTERPRISEを優先（UserServiceSubscriptionのプランより優先）
      // 2. 統一プランがPROの場合、UserServiceSubscriptionのプランと統一プランの最大値を取る
      // 3. それ以外の場合、UserServiceSubscriptionのプランがあればそれを使用、なければ統一プランを使用
      let planToUse: string | null = null
      const unifiedPlanUpper = unifiedPlan ? unifiedPlan.toUpperCase().trim() : null
      const subscriptionPlanUpper = subscription?.plan ? subscription.plan.toUpperCase().trim() : null
      
      console.log('[INTERVIEW] Current plan API - Plan resolution logic:', {
        unifiedPlan,
        unifiedPlanUpper,
        subscriptionPlan: subscription?.plan,
        subscriptionPlanUpper,
      })
      
      if (unifiedPlanUpper === 'ENTERPRISE') {
        // 統一プランがENTERPRISEの場合、常にENTERPRISEを優先（UserServiceSubscriptionのプランに関係なく）
        planToUse = 'ENTERPRISE'
        console.log('[INTERVIEW] Current plan API - Using ENTERPRISE (unified plan is ENTERPRISE, overriding subscription plan)')
      } else if (unifiedPlanUpper === 'PRO') {
        // 統一プランがPROの場合、UserServiceSubscriptionのプランと統一プランの最大値を取る
        if (subscriptionPlanUpper === 'ENTERPRISE') {
          planToUse = 'ENTERPRISE'
          console.log('[INTERVIEW] Current plan API - Using ENTERPRISE (subscription plan is ENTERPRISE)')
        } else {
          planToUse = 'PRO'
          console.log('[INTERVIEW] Current plan API - Using PRO (unified plan is PRO)')
        }
      } else {
        // それ以外の場合、UserServiceSubscriptionのプランがあればそれを使用、なければ統一プランを使用
        planToUse = subscription?.plan || unifiedPlan
        console.log('[INTERVIEW] Current plan API - Using subscription plan or unified plan:', planToUse)
      }
      
      plan = await getUserPlan(userId, null, planToUse)
      
      console.log('[INTERVIEW] Current plan API - Final resolved plan:', {
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

