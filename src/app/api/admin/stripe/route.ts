import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { stripe, findActiveLikeSubscriptions, isDoyaSubscriptionOwnedByUser, resolvePlanIdFromSubscription, planTierFromPlanId, ACTIVE_LIKE_STATUSES } from '@/lib/stripe'
import { syncUnifiedBilling } from '@/lib/billing-sync'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const PLAN_RANK: Record<string, number> = { FREE: 0, LIGHT: 1, PRO: 2, BUNDLE: 3, ENTERPRISE: 4 }

// ユーザーのStripe情報を取得
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userIdが必要です' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        plan: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
    }

    let subscriptionInfo = null
    if (user.stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
        if (!(await isDoyaSubscriptionOwnedByUser(subscription, user))) {
          return NextResponse.json({ error: '契約の所有者を確認できませんでした' }, { status: 409 })
        }
        subscriptionInfo = {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          priceId: subscription.items.data[0]?.price?.id,
          amount: subscription.items.data[0]?.price?.unit_amount,
          interval: subscription.items.data[0]?.price?.recurring?.interval,
        }
      } catch (e) {
        console.error('Stripe subscription fetch error:')
        return NextResponse.json({ error: '契約情報を確認できませんでした' }, { status: 502 })
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        plan: user.plan,
      },
      subscription: subscriptionInfo,
    })
  } catch (error) {
    console.error('Admin stripe GET error:')
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}

// Stripeサブスクリプションを管理（キャンセル、再開など）
export async function POST(request: NextRequest) {
  let canceledSubscriptionId: string | null = null
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, action } = body

    if (!userId || !action) {
      return NextResponse.json({ error: 'userIdとactionが必要です' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        stripeSubscriptionId: true,
        stripeCustomerId: true,
      },
    })

    if (!user?.stripeSubscriptionId) {
      return NextResponse.json({ error: 'Stripeサブスクリプションがありません' }, { status: 400 })
    }
    if (!['cancel', 'cancel_immediately', 'resume'].includes(action)) {
      return NextResponse.json({ error: '不明なactionです' }, { status: 400 })
    }
    const current = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
    if (current.id !== user.stripeSubscriptionId ||
        !(await isDoyaSubscriptionOwnedByUser(current, user)) ||
        !ACTIVE_LIKE_STATUSES.has(String(current.status))) {
      return NextResponse.json({ error: '契約の所有者または状態を確認できませんでした' }, { status: 409 })
    }

    let result
    switch (action) {
      case 'cancel':
        // 期間終了時にキャンセル（即時キャンセルではない）
        result = await stripe.subscriptions.update(user.stripeSubscriptionId, {
          cancel_at_period_end: true,
        })
        break

      case 'cancel_immediately': {
        // 即時キャンセル
        result = await stripe.subscriptions.cancel(user.stripeSubscriptionId)
        if (result.id !== user.stripeSubscriptionId || result.status !== 'canceled') {
          return NextResponse.json({
            code: 'CANCELLATION_UNCONFIRMED',
            error: 'Stripeでの即時解約を確認できませんでした。契約状態を再読み込みしてください。',
          }, { status: 502 })
        }
        canceledSubscriptionId = result.id
        // 二重契約が残っているなら有料権利を保つ。全サービスの反映は同一TXで行う。
        const remaining = await findActiveLikeSubscriptions({ userId: user.id, email: user.email, stripeCustomerId: user.stripeCustomerId })
        const best = remaining
          .map((sub) => ({ ...sub, tier: planTierFromPlanId(sub.planId) }))
          .filter((sub) => sub.tier !== 'FREE')
          .sort((a, b) => PLAN_RANK[b.tier]! - PLAN_RANK[a.tier]!)[0]
        if (remaining.length > 0 && !best) {
          return NextResponse.json({ code: 'BILLING_SYNC_INCOMPLETE', error: '残存契約のプランを確認できませんでした。課金状態を再同期してください。' }, { status: 502 })
        }
        if (best) {
          const survivor = await stripe.subscriptions.retrieve(best.id)
          const survivorCustomerId = typeof survivor.customer === 'string' ? survivor.customer : survivor.customer.id
          if (survivor.id !== best.id || survivorCustomerId !== best.customerId || !ACTIVE_LIKE_STATUSES.has(String(survivor.status)) ||
              !(await isDoyaSubscriptionOwnedByUser(survivor, user))) {
            return NextResponse.json({ code: 'BILLING_SYNC_INCOMPLETE', error: '残存契約を確認できませんでした。課金状態を再同期してください。' }, { status: 502 })
          }
          const { planId, priceId } = resolvePlanIdFromSubscription(survivor)
          const tier = planTierFromPlanId(planId)
          if (tier === 'FREE') {
            return NextResponse.json({ code: 'BILLING_SYNC_INCOMPLETE', error: '残存契約のプランを確認できませんでした。課金状態を再同期してください。' }, { status: 502 })
          }
          await syncUnifiedBilling({ userId: user.id, plan: tier,
            stripeCustomerId: survivorCustomerId, stripeSubscriptionId: survivor.id,
            stripePriceId: priceId, stripeCurrentPeriodEnd: new Date(survivor.current_period_end * 1000) })
        } else {
          await syncUnifiedBilling({ userId: user.id, plan: 'FREE', stripeSubscriptionId: null,
            stripePriceId: null, stripeCurrentPeriodEnd: null })
        }
        break
      }

      case 'resume':
        // キャンセル予定を取り消し
        result = await stripe.subscriptions.update(user.stripeSubscriptionId, {
          cancel_at_period_end: false,
        })
        break

      default:
        return NextResponse.json({ error: '不明なactionです' }, { status: 400 })

    }

    return NextResponse.json({
      success: true,
      action,
      subscription: {
        id: result.id,
        status: result.status,
        cancelAtPeriodEnd: result.cancel_at_period_end,
      },
    })
  } catch (error) {
    console.error('Admin stripe POST error:')
    if (canceledSubscriptionId) {
      return NextResponse.json({
        code: 'BILLING_SYNC_INCOMPLETE',
        error: 'Stripeでの即時解約は完了しましたが、アプリの契約表示を更新できませんでした。再同期して状態を確認してください。',
      }, { status: 502 })
    }
    return NextResponse.json({ error: 'Stripe操作に失敗しました' }, { status: 500 })
  }
}
