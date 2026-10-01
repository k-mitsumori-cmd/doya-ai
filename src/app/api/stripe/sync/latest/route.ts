import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { syncUnifiedBilling } from '@/lib/billing-sync'
import { prisma } from '@/lib/prisma'
import {
  stripe,
  findActiveLikeSubscriptions,
  resolvePlanIdFromSubscription,
  isDoyaSubscriptionOwnedByUser,
  planTierFromPlanId,
  ACTIVE_LIKE_STATUSES,
} from '@/lib/stripe'
import { deliverStripeWebhookNotification } from '@/lib/stripe-webhook-notifications'

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

    // 共通探索は全Customer/Subscriptionページを読み、他アプリの契約を除外する。
    const candidates = (await findActiveLikeSubscriptions({
      userId: user.id,
      email: user.email,
      stripeCustomerId: user.stripeCustomerId,
    })).map((subscription) => ({
      ...subscription,
      tier: planTierFromPlanId(subscription.planId),
    })).filter((subscription) => subscription.tier !== 'FREE')

    if (candidates.length === 0) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    // 最上位の階層を採用
    candidates.sort((a, b) => (TIER_RANK[b.tier] ?? 0) - (TIER_RANK[a.tier] ?? 0))
    const best = candidates[0]!
    const subscription = await stripe.subscriptions.retrieve(best.id)
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
    if (!ACTIVE_LIKE_STATUSES.has(String(subscription.status)) ||
        customerId !== best.customerId ||
        !(await isDoyaSubscriptionOwnedByUser(subscription, user))) {
      return NextResponse.json({ error: '契約情報の一致を確認できませんでした。' }, { status: 409 })
    }
    const { planId: bestPlanId, priceId } = resolvePlanIdFromSubscription(subscription)
    const currentTier = planTierFromPlanId(bestPlanId)
    if (currentTier === 'FREE') return NextResponse.json({ error: '契約プランを確認できませんでした。' }, { status: 409 })
    // User.plan は階層をそのまま持ち、サービス行だけ BUNDLE→PRO に落とす。
    // （webhook / sync と同じ規約。以前はここだけ User.plan にも PRO を書いていた）
    const before = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } })
    const notice = subscriptionNotice(subscription as any)
    const notificationId = `billing-sync:${subscription.id}:${randomUUID()}`
    await syncUnifiedBilling({
      userId: user.id, plan: currentTier,
      stripeCustomerId: customerId, stripeSubscriptionId: subscription.id,
      stripePriceId: priceId, stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      notificationOnUpgrade: {
        id: notificationId,
        payload: {
          type: notice.type,
          userEmail: user.email,
          userName: before?.name ?? null,
          details: `${notice.text} ｜ 手動再同期で反映（${bestPlanId} / sub: ${subscription.id}）※Webhook不達の可能性あり`,
        },
      },
    })
    try {
      await deliverStripeWebhookNotification(notificationId)
    } catch (error) {
      // 登録は確定済み。送信の一時障害はCronへ委ね、購入者の同期成功を維持する。
      console.error('Stripe sync/latest notification delivery deferred:')
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
    console.error('Stripe sync/latest error:')
    return NextResponse.json({ error: '契約情報を再同期できませんでした。時間をおいて再試行してください。' }, { status: 500 })
  }
}

/** 通知文面の共通ヘルパー（無料トライアルと即課金を必ず区別する） */
function subscriptionNotice(sub: { status: string; trial_end: number | null; current_period_end: number; items: any }) {
  const yen = (n: number) => `¥${Number(n || 0).toLocaleString('ja-JP')}`
  const jstDate = (ms: number) =>
    new Date(ms).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric' })
  const amount = sub.items?.data?.[0]?.price?.unit_amount ?? 0
  const isTrial = sub.status === 'trialing' && Boolean(sub.trial_end)
  return {
    type: (isTrial ? 'trial_start' : 'subscription') as 'trial_start' | 'subscription',
    text: isTrial
      ? `プロプラン（初月無料・30日）｜ ${jstDate(sub.trial_end! * 1000)} まで無料 ｜ ` +
        `初回請求 ${jstDate(sub.current_period_end * 1000)} に ${yen(amount)}（現時点の入金はありません）`
      : `プロプラン（無料期間なし）｜ ${yen(amount)} を請求 ｜ 次回請求 ${jstDate(sub.current_period_end * 1000)}`,
  }
}
