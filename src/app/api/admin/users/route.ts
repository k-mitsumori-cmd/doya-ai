import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { findActiveLikeSubscriptions, ACTIVE_LIKE_STATUSES } from '@/lib/stripe'
import { syncUnifiedBilling } from '@/lib/billing-sync'
import { prisma } from '@/lib/prisma'
import { summarizeBannerMonthlyQuota } from '@/lib/admin/banner-quota'
import { shouldResetDailyUsage, shouldResetMonthlyUsage } from '@/lib/pricing'
import Stripe from 'stripe'

// cookies() を使用するため、静的最適化を無効化
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

export async function GET(request: NextRequest) {
  try {
    // 管理者認証チェック
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    // ユーザー一覧を取得（サービス別サブスクリプション情報も含む）
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        plan: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        serviceSubscriptions: {
          select: {
            id: true,
            serviceId: true,
            plan: true,
            dailyUsage: true,
            monthlyUsage: true,
            lastUsageReset: true,
            stripeSubscriptionId: true,
          },
        },
        _count: {
          select: { generations: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Stripe情報を取得（サブスクリプションがあるユーザーのみ）
    const stripeInfoMap: Record<string, any> = {}
    const usersWithStripe = users.filter((u: any) => u.stripeSubscriptionId)
    
    // 並列でStripe情報を取得（パフォーマンス向上）
    await Promise.all(
      usersWithStripe.map(async (user: any) => {
        try {
          const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
          stripeInfoMap[user.id] = {
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
            created: new Date(subscription.created * 1000).toISOString(),
            amount: subscription.items.data[0]?.price?.unit_amount || 0,
            interval: subscription.items.data[0]?.price?.recurring?.interval || 'month',
          }
        } catch (e) {
          console.error(`Stripe fetch error for user ${user.id}:`, e)
          stripeInfoMap[user.id] = null
        }
      })
    )

    const formattedUsers = users.map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      plan: user.plan,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      stripeInfo: stripeInfoMap[user.id] || null,
      totalGenerations: user._count.generations,
      bannerQuota: summarizeBannerMonthlyQuota(user.serviceSubscriptions.find((sub: any) => sub.serviceId === 'banner') ?? null, user.plan),
      // サービス別の情報
      serviceSubscriptions: user.serviceSubscriptions.map((sub: any) => ({
        id: sub.id,
        serviceId: sub.serviceId,
        plan: sub.plan,
        dailyUsage: sub.dailyUsage,
        monthlyUsage: sub.monthlyUsage,
        lastUsageReset: sub.lastUsageReset,
        hasStripe: !!sub.stripeSubscriptionId,
      })),
      // 利用中のサービスID一覧
      services: user.serviceSubscriptions.map((sub: any) => sub.serviceId),
    }))

    return NextResponse.json(formattedUsers)
  } catch (error) {
    console.error('Admin users error:', error)
    return NextResponse.json(
      { error: 'ユーザー一覧の取得に失敗しました' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // 管理者認証チェック
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const body = await req.json()
    const { userId, plan, role, serviceId, servicePlan, resetDailyUsage, resetMonthlyUsage, setDailyUsage, setMonthlyUsage } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // 旧UIの servicePlan 指定も統一プランとして反映する。サービス個別課金は廃止済み。
    const requestedPlan = plan ?? servicePlan
    const validPlans = ['FREE', 'LIGHT', 'PRO', 'BUNDLE', 'ENTERPRISE']
    if (requestedPlan !== undefined && !validPlans.includes(requestedPlan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }
    if (plan !== undefined && servicePlan !== undefined && plan !== servicePlan) {
      return NextResponse.json({ error: 'Conflicting plans' }, { status: 400 })
    }
    if (role !== undefined && !['USER', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    if (requestedPlan !== undefined) {
      await syncUnifiedBilling({ userId, plan: requestedPlan, role, preserveManualGrant: false })
    } else if (role !== undefined) {
      await prisma.user.update({ where: { id: userId }, data: { role } })
    }

    // サービス別プラン・使用回数の更新（個別サービスの設定用）
    if (serviceId) {
      const existing = await prisma.userServiceSubscription.findUnique({
        where: { userId_serviceId: { userId, serviceId } },
      })

      const updateData: any = {}
      if (resetDailyUsage) updateData.dailyUsage = 0
      if (resetMonthlyUsage) updateData.monthlyUsage = 0
      if (typeof setDailyUsage === 'number') updateData.dailyUsage = setDailyUsage
      if (typeof setMonthlyUsage === 'number') updateData.monthlyUsage = setMonthlyUsage
      if (resetDailyUsage || resetMonthlyUsage || typeof setDailyUsage === 'number' || typeof setMonthlyUsage === 'number') {
        // Both counters share one reset timestamp. Preserve only counters that
        // belong to the current JST day/month before moving that timestamp.
        if (existing) {
          if (updateData.dailyUsage === undefined && shouldResetDailyUsage(existing.lastUsageReset)) updateData.dailyUsage = 0
          if (updateData.monthlyUsage === undefined && shouldResetMonthlyUsage(existing.lastUsageReset)) updateData.monthlyUsage = 0
        }
        updateData.lastUsageReset = new Date()
      }

      if (existing) {
        await prisma.userServiceSubscription.update({
          where: { id: existing.id },
          data: updateData,
        })
      } else if (requestedPlan) {
        // 存在しない場合は作成
        await prisma.userServiceSubscription.create({
          data: {
            userId,
            serviceId,
            plan: requestedPlan === 'BUNDLE' ? 'PRO' : requestedPlan,
            dailyUsage: 0,
            monthlyUsage: 0,
          },
        })
      }
    }

    // 更新後のユーザー情報を返す
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        role: true,
        serviceSubscriptions: {
          select: {
            serviceId: true,
            plan: true,
            dailyUsage: true,
            monthlyUsage: true,
          },
        },
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Admin user update error:', error)
    return NextResponse.json(
      { error: 'ユーザーの更新に失敗しました' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // 管理者認証チェック
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // ユーザーの存在確認
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
    }

    // 契約照会・停止に失敗した場合はアカウントを残す。課金中の顧客を孤立させない。
    const live = await findActiveLikeSubscriptions({ email: user.email, stripeCustomerId: user.stripeCustomerId })
    const ids = new Set(live.map((subscription) => subscription.id))
    if (user.stripeSubscriptionId && !ids.has(user.stripeSubscriptionId)) {
      try {
        const stored = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
        if (ACTIVE_LIKE_STATUSES.has(String(stored.status))) ids.add(stored.id)
      } catch (error: any) {
        if (error?.code !== 'resource_missing') throw error
      }
    }
    for (const subscriptionId of ids) await stripe.subscriptions.cancel(subscriptionId)

    // 部分削除を防ぐ。外部のStripe操作はトランザクションの外に置く。
    await prisma.$transaction(async (tx) => {
      await tx.userServiceSubscription.deleteMany({ where: { userId } })
      await tx.generation.deleteMany({ where: { userId } })
      await tx.session.deleteMany({ where: { userId } })
      await tx.account.deleteMany({ where: { userId } })
      await tx.user.delete({ where: { id: userId } })
    })

    return NextResponse.json({ 
      success: true, 
      message: `ユーザー ${user.email || userId} を削除しました` 
    })
  } catch (error) {
    console.error('Admin user delete error:', error)
    return NextResponse.json(
      { error: 'ユーザーの削除に失敗しました' },
      { status: 500 }
    )
  }
}
