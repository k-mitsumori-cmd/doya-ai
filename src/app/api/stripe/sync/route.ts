import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe, ACTIVE_LIKE_STATUSES, findActiveLikeSubscriptions, isDoyaSubscription, isDoyaSubscriptionOwnedByUser, resolvePlanIdFromSubscription, planTierFromPlanId } from '@/lib/stripe'
import { syncUnifiedBilling } from '@/lib/billing-sync'
import { prisma } from '@/lib/prisma'
import { deliverStripeWebhookNotification } from '@/lib/stripe-webhook-notifications'
import { billingSubscriptionNotice } from '@/lib/billing-subscription-notice'

// ========================================
// Stripe決済直後の同期（Webhook遅延/不達の保険）
// ========================================
// POST /api/stripe/sync
// body: { sessionId: string }
//
// - success_url で受け取った session_id を使って Stripe から checkout session / subscription を取得
// - DBに stripeCustomerId / stripeSubscriptionId / サービス別plan を反映

const TIER_RANK: Record<string, number> = { FREE: 0, LIGHT: 1, PRO: 2, BUNDLE: 3, ENTERPRISE: 4 }

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const sessionId = String(body?.sessionId || '').trim()
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, name: true, stripeCustomerId: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const checkout = await stripe.checkout.sessions.retrieve(sessionId)
    const customerId = (checkout.customer as string) || null
    const subscriptionId = (checkout.subscription as string) || null

    if (!customerId || !subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription not found in checkout session', customerId, subscriptionId },
        { status: 404 }
      )
    }

    // 別ユーザーのcheckoutを誤って同期しない最低限のガード
    // - client_reference_id は createCheckoutSession で userId を入れている
    const ref = String(checkout.client_reference_id || '').trim()
    const customerEmail = String(checkout.customer_email || checkout.customer_details?.email || '').trim()
    // 古い決済で ref が email になっている/空のケースも救済しつつ、他人の決済は弾く
    if (ref && ref !== user.id && ref !== String(user.email || '').trim()) {
      return NextResponse.json({ error: 'Checkout session does not match user' }, { status: 403 })
    }
    if (customerEmail && user.email && customerEmail.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: 'Checkout session email does not match user' }, { status: 403 })
    }

    // 識別情報が空の旧Checkoutも、Stripe顧客のメール一致を確認できた場合のみ救済。
    if (!ref && !customerEmail) {
      const customer = await stripe.customers.retrieve(customerId)
      if (customer.deleted || !customer.email || customer.email.trim().toLowerCase() !== user.email?.trim().toLowerCase()) {
        return NextResponse.json({ error: 'Checkout session does not match user' }, { status: 403 })
      }
    }
    if (checkout.status !== 'complete') {
      return NextResponse.json({ error: '決済が完了していません' }, { status: 409 })
    }
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (!isDoyaSubscription(subscription)) {
      return NextResponse.json({ error: 'この決済はドヤAIの契約ではありません。' }, { status: 403 })
    }
    if (!ACTIVE_LIKE_STATUSES.has(String(subscription.status))) {
      return NextResponse.json({ error: 'この契約は有効ではありません。現在の契約を再同期してください。' }, { status: 409 })
    }
    const subscriptionCustomerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
    if (subscriptionCustomerId !== customerId || (subscription.metadata?.userId && subscription.metadata.userId !== user.id)) {
      return NextResponse.json({ error: 'Subscription does not match user' }, { status: 403 })
    }
    const { planId } = resolvePlanIdFromSubscription(subscription as any)
    const resolvedPlan = planTierFromPlanId(planId)
    if (resolvedPlan === 'FREE') return NextResponse.json({ error: '契約プランを確認できませんでした。再度同期してください。' }, { status: 409 })

    // The checkout subscription is verified above, but another live subscription may
    // already grant a higher tier. Include this freshly retrieved subscription even
    // if Stripe's list endpoint has not yet caught up with checkout completion.
    const candidates = await findActiveLikeSubscriptions({
      userId: user.id, email: user.email, stripeCustomerId: customerId,
    })
    let selected = subscription
    let selectedPlan: ReturnType<typeof planTierFromPlanId> = resolvedPlan
    for (const candidate of candidates) {
      const tier = planTierFromPlanId(candidate.planId)
      if ((TIER_RANK[tier] ?? 0) <= (TIER_RANK[selectedPlan] ?? 0)) continue
      const live = await stripe.subscriptions.retrieve(candidate.id)
      if (!ACTIVE_LIKE_STATUSES.has(String(live.status))) continue
      if (!(await isDoyaSubscriptionOwnedByUser(live, user))) {
        return NextResponse.json({ error: '契約情報の一致を確認できませんでした。再度同期してください。' }, { status: 409 })
      }
      const livePlan = planTierFromPlanId(resolvePlanIdFromSubscription(live).planId)
      if ((TIER_RANK[livePlan] ?? 0) > (TIER_RANK[selectedPlan] ?? 0)) {
        selected = live
        selectedPlan = livePlan
      }
    }
    const selectedCustomerId = typeof selected.customer === 'string' ? selected.customer : selected.customer.id
    const { planId: selectedPlanId, priceId: selectedPriceId } = resolvePlanIdFromSubscription(selected)
    const notice = billingSubscriptionNotice(subscription, planId)
    const notificationId = `billing-sync:${subscription.id}:${randomUUID()}`
    const { userPlan } = await syncUnifiedBilling({
      userId: user.id, plan: selectedPlan,
      stripeCustomerId: selectedCustomerId, stripeSubscriptionId: selected.id,
      stripePriceId: selectedPriceId, stripeCurrentPeriodEnd: new Date(selected.current_period_end * 1000),
      notificationOnUpgrade: {
        id: notificationId,
        payload: {
          type: notice.type,
          userEmail: user.email,
          userName: user.name,
          details: `${notice.text} ｜ 決済直後の同期で反映（sub: ${subscription.id}）`,
        },
      },
    })
    // 送信失敗はキューに残し、Cronが再試行する。FREE→有料の遷移ごとに固有IDを持つ。
    try {
      await deliverStripeWebhookNotification(notificationId)
    } catch (error) {
      // 登録は確定済み。送信の一時障害はCronへ委ね、購入者の同期成功を維持する。
      console.error('Stripe sync notification delivery deferred:')
    }

    return NextResponse.json({
      ok: true,
      plan: userPlan,
      servicePlan: selectedPlanId,
      subscriptionId: selected.id,
      priceId: selectedPriceId,
      paymentStatus: checkout.payment_status,
      amountTotal: checkout.amount_total,
      subscriptionStatus: selected.status,
    })
  } catch (e: any) {
    console.error('Stripe sync error:')
    return NextResponse.json({ error: '契約情報を同期できませんでした。時間をおいて再試行してください。' }, { status: 500 })
  }
}
