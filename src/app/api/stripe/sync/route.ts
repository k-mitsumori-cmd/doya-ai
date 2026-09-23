import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe, ACTIVE_LIKE_STATUSES, resolvePlanIdFromSubscription, planTierFromPlanId } from '@/lib/stripe'
import { syncUnifiedBilling } from '@/lib/billing-sync'
import { prisma } from '@/lib/prisma'
import { sendEventNotification } from '@/lib/notifications'

// ========================================
// Stripe決済直後の同期（Webhook遅延/不達の保険）
// ========================================
// POST /api/stripe/sync
// body: { sessionId: string }
//
// - success_url で受け取った session_id を使って Stripe から checkout session / subscription を取得
// - DBに stripeCustomerId / stripeSubscriptionId / サービス別plan を反映

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
      select: { id: true, email: true, name: true, plan: true, stripeCustomerId: true },
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
    if (!ACTIVE_LIKE_STATUSES.has(String(subscription.status))) {
      return NextResponse.json({ error: 'この契約は有効ではありません。現在の契約を再同期してください。' }, { status: 409 })
    }
    const subscriptionCustomerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
    if (subscriptionCustomerId !== customerId || (subscription.metadata?.userId && subscription.metadata.userId !== user.id)) {
      return NextResponse.json({ error: 'Subscription does not match user' }, { status: 403 })
    }
    const { planId, priceId } = resolvePlanIdFromSubscription(subscription as any)
    const resolvedPlan = planTierFromPlanId(planId)
    if (resolvedPlan === 'FREE') return NextResponse.json({ error: '契約プランを確認できませんでした。再度同期してください。' }, { status: 409 })
    const { userPlan } = await syncUnifiedBilling({
      userId: user.id, plan: resolvedPlan,
      stripeCustomerId: customerId, stripeSubscriptionId: subscription.id,
      stripePriceId: priceId, stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
    })

    // 課金通知は Webhook ハンドラにしか無く、Webhook が不達だと運営が誰も気づけない。
    // 決済直後の同期経路からも通知する（FREE→有料の遷移時のみ）。
    if (user.plan === 'FREE' && userPlan !== 'FREE') {
      const notice = subscriptionNotice(subscription as any)
      sendEventNotification({
        type: notice.type,
        userEmail: user.email,
        userName: user.name,
        details: `${notice.text} ｜ 決済直後の同期で反映（sub: ${subscription.id}）`,
      }).catch(() => {})
    }

    return NextResponse.json({
      ok: true,
      plan: userPlan,
      servicePlan: planId,
      subscriptionId: subscription.id,
      priceId,
    })
  } catch (e: any) {
    console.error('Stripe sync error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to sync subscription' }, { status: 500 })
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
