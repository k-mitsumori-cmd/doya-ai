import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  stripe,
  resolvePlanIdFromSubscription,
  planTierFromPlanId,
  ALL_SERVICE_IDS,
  ACTIVE_LIKE_STATUSES,
} from '@/lib/stripe'
import { sendEventNotification } from '@/lib/notifications'

// ========================================
// Stripe再同期（session_id が無い/リダイレクト未経由の救済）
// ========================================
// POST /api/stripe/sync/latest
// - ユーザーemailからStripe Customerを特定（DBのstripeCustomerId優先・メール横断）
// - アクティブ系サブスクを取得して、最上位プランを**全サービス**へ反映（統一課金）
//
// ⚠️ 以前はここで planId が 'banner-' で始まる契約だけを拾っていたが、統一課金では
//    全サービスが同じ価格IDを共有するため価格→planId の逆引きが 'seo-pro' を返し、
//    プロ契約者が1人も一致せず常に 404 を返していた（＝「プラン再同期」ボタンが無効）。
//    サービスを問わず階層（PRO/LIGHT/ENTERPRISE）だけで判定する。

const TIER_RANK: Record<string, number> = { FREE: 0, LIGHT: 1, PRO: 2, BUNDLE: 3, ENTERPRISE: 4 }

export async function POST(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, stripeCustomerId: true },
    })
    if (!user?.id || !user.email) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Customer特定（DB優先 → メール横断で全顧客）
    // checkout は customer_email で都度 Customer を作るため、同一メールで顧客が分裂しうる。
    // 1件だけ見ると「契約はあるのに見つからない」が起きるので全部見る。
    const customerIds = new Set<string>()
    if (user.stripeCustomerId) customerIds.add(user.stripeCustomerId)
    const listed = await stripe.customers.list({ email: user.email, limit: 100 })
    for (const c of listed.data) customerIds.add(c.id)
    if (customerIds.size === 0) {
      return NextResponse.json({ error: 'Stripe customer not found' }, { status: 404 })
    }

    // 全顧客のアクティブ系サブスクを集める
    const candidates: Array<{
      subscription: Awaited<ReturnType<typeof stripe.subscriptions.retrieve>>
      priceId: string | null
      planId: string
      tier: string
      customerId: string
    }> = []
    for (const cid of customerIds) {
      const subs = await stripe.subscriptions.list({ customer: cid, status: 'all', limit: 100 })
      for (const s of subs.data) {
        if (!ACTIVE_LIKE_STATUSES.has(String(s.status))) continue
        const { planId, priceId } = resolvePlanIdFromSubscription(s as any)
        const tier = planTierFromPlanId(planId)
        if (tier === 'FREE') continue
        candidates.push({ subscription: s as any, priceId, planId, tier, customerId: cid })
      }
    }

    if (candidates.length === 0) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    // 最上位の階層を採用
    candidates.sort((a, b) => (TIER_RANK[b.tier] ?? 0) - (TIER_RANK[a.tier] ?? 0))
    const best = candidates[0]!
    const subscription = best.subscription
    const priceId = best.priceId
    const bestPlanId = best.planId
    const customerId = best.customerId
    // User.plan は階層をそのまま持ち、サービス行だけ BUNDLE→PRO に落とす。
    // （webhook / sync と同じ規約。以前はここだけ User.plan にも PRO を書いていた）
    const userPlan = best.tier
    const servicePlan = best.tier === 'BUNDLE' ? 'PRO' : best.tier

    // DBへ反映
    const before = await prisma.user.findUnique({ where: { id: user.id }, select: { plan: true, name: true } })

    await prisma.user.update({
      where: { id: user.id },
      data: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId || undefined,
        stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
        plan: userPlan,
      },
    })

    // 統一課金: 全サービスを同じプランに揃える
    for (const serviceId of ALL_SERVICE_IDS) {
      await prisma.userServiceSubscription.upsert({
        where: { userId_serviceId: { userId: user.id, serviceId } },
        create: {
          userId: user.id,
          serviceId,
          plan: servicePlan,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId || undefined,
          stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
          dailyUsage: 0,
          monthlyUsage: 0,
          lastUsageReset: new Date(),
        },
        update: {
          plan: servicePlan,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId || undefined,
          stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
        },
      }).catch((e: any) => {
        console.error(`[Stripe Sync latest] upsert failed: user=${user.id} service=${serviceId}`, e?.message)
      })
    }

    // Webhook不達でも運営が気づけるよう、ここでも課金通知を出す（FREE→有料の遷移時のみ）
    if (before?.plan === 'FREE' && userPlan !== 'FREE') {
      sendEventNotification({
        type: 'subscription',
        userEmail: user.email,
        userName: before?.name,
        details: `手動再同期でプラン反映（${bestPlanId} / ${subscription.status} / sub: ${subscription.id}）※Webhook不達の可能性あり`,
      }).catch(() => {})
    }

    return NextResponse.json({
      ok: true,
      customerId,
      subscriptionId: subscription.id,
      planId: bestPlanId,
      priceId,
      status: subscription.status,
    })
  } catch (e: any) {
    console.error('Stripe sync/latest error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to sync latest subscription' }, { status: 500 })
  }
}


