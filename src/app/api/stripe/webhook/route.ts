import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import {
  constructWebhookEvent,
  stripe,
  ACTIVE_LIKE_STATUSES,
  resolvePlanIdFromSubscription,
  planTierFromPlanId,
  findActiveLikeSubscriptions,
} from '@/lib/stripe'
import { prisma, withRetry } from '@/lib/prisma'
import { syncUnifiedBilling } from '@/lib/billing-sync'
import { sendEventNotification } from '@/lib/notifications'
import Stripe from 'stripe'

// ========================================
// Stripe Webhook Handler
// ========================================
// POST /api/stripe/webhook
// Stripeからのイベントを処理

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  let event: Stripe.Event

  try {
    event = constructWebhookEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    )
  }

  console.log(`Stripe webhook received: ${event.type}`)

  try {
    switch (event.type) {
      // ========================================
      // Checkout完了
      // ========================================
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }

      // ========================================
      // サブスクリプション作成
      // ========================================
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionCreated(subscription)
        break
      }

      // ========================================
      // サブスクリプション更新
      // ========================================
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription)
        break
      }

      // ========================================
      // サブスクリプション削除
      // ========================================
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      // ========================================
      // 支払い成功
      // ========================================
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentSucceeded(invoice)
        break
      }

      // ========================================
      // 支払い失敗
      // ========================================
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(invoice)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error: any) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// ========================================
// 表示ヘルパー（通知文面で使う）
// ========================================
const yen = (n: number) => `¥${Number(n || 0).toLocaleString('ja-JP')}`
/** UNIXミリ秒 → 日本時間の「YYYY年M月D日」 */
const jstDate = (ms: number) =>
  new Date(ms).toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

// ========================================
// イベントハンドラー
// ========================================

type WebhookUser = { id: string; email: string | null; name: string | null; plan: string }

const USER_SELECT = { id: true, email: true, name: true, plan: true } as const

/**
 * サブスクリプションからユーザーを特定する（reference/11-billing-spec.md INV-6 / R-1）。
 *
 * `stripeCustomerId` 単独で引くと、顧客レコードが分裂している場合
 * （checkout は customer_email で都度 Customer を作るため必ず起きうる）に
 * **ユーザーが見つからず解約や更新が反映されない**。
 * metadata → customerId → Stripe顧客のメール、の順に3段で救済する。
 */
async function findUserForSubscription(subscription: Stripe.Subscription): Promise<WebhookUser | null> {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id

  // 1) checkout が subscription_data.metadata に入れている userId（最も確実）
  const metaUserId = subscription.metadata?.userId
  if (metaUserId) {
    const byId = await prisma.user.findUnique({ where: { id: metaUserId }, select: USER_SELECT })
    if (byId) return byId
  }

  // 2) DB に保存済みの customerId
  if (customerId) {
    const byCustomer = await prisma.user.findFirst({ where: { stripeCustomerId: customerId }, select: USER_SELECT })
    if (byCustomer) return byCustomer
  }

  // 3) Stripe 顧客のメールで引き当てる（顧客分裂の救済）
  if (customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId)
      const email = (customer as any)?.email as string | undefined
      if (email) {
        const byEmail = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: USER_SELECT,
        })
        if (byEmail) return byEmail
      }
    } catch (e: any) {
      console.error(`[Webhook] customer retrieve failed: ${customerId}`, e?.message)
    }
  }

  return null
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id || session.metadata?.userId
  const customerId = session.customer as string
  const subscriptionId = session.subscription as string

  if (!userId) {
    console.error('No userId found in checkout session')
    return
  }

  console.log(`Checkout completed for user: ${userId}`)

  // ユーザーにStripe Customer IDを保存（DB接続エラー時はリトライ）
  const user = await withRetry(() => prisma.user.update({
    where: { id: userId },
    data: {
      stripeCustomerId: customerId,
    },
    select: { email: true, name: true },
  }))

  // サブスクリプション情報を取得
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    await updateUserSubscription(userId, subscription)
  }

  // ------------------------------------------------------------------
  // 申し込み通知（無料トライアルか、即課金かを必ず区別する）
  // ------------------------------------------------------------------
  // ⚠️ 「申し込み＝売上」ではない。初月無料の方はこの時点で1円も入金されていない。
  //    区別せずに通知すると、売上の見込みが立たず、入金遅れにも気づけない。
  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId).catch(() => null)
    if (sub) {
      const amount = sub.items.data[0]?.price.unit_amount ?? 0
      const isTrial = sub.status === 'trialing' && Boolean(sub.trial_end)
      sendEventNotification({
        type: isTrial ? 'trial_start' : 'subscription',
        userEmail: user.email,
        userName: user.name,
        details: isTrial
          ? `プロプラン（初月無料・30日）｜ ${jstDate(sub.trial_end! * 1000)} まで無料 ｜ ` +
            `初回請求 ${jstDate(sub.current_period_end * 1000)} に ${yen(amount)}（現時点の入金はありません）`
          : `プロプラン（無料期間なし）｜ ${yen(amount)} を請求 ｜ 次回請求 ${jstDate(sub.current_period_end * 1000)}`,
      }).catch(() => {})
    }
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const user = await findUserForSubscription(subscription)
  if (!user) {
    console.error(
      `[Webhook] subscription.created: user not found for subscription ${subscription.id} — subscription will NOT be recorded`
    )
    return
  }
  await updateUserSubscription(user.id, subscription)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const user = await findUserForSubscription(subscription)

  if (!user) {
    console.error(`[Webhook] subscription.updated: user not found for subscription ${subscription.id}`)
    return
  }

  // canceled / unpaid は FREE に戻す。
  // - canceled: 期間終了時の解約、またはトライアル終了時に支払い方法が無く missing_payment_method:'cancel' で解約
  // - unpaid: トライアル後/更新の初回課金が失敗しダンニング(再試行)も尽きた終端状態。
  //   updateUserSubscription は status を見ず PRO 付与するため、ここで弾かないと未入金のまま PRO が残る。
  if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    console.log(`Subscription ${subscription.status} via updated event for user: ${user.id}`)
    await handleSubscriptionDeleted(subscription)
    return
  }

  await updateUserSubscription(user.id, subscription)
}

const TIER_RANK: Record<string, number> = { FREE: 0, LIGHT: 1, PRO: 2, BUNDLE: 3, ENTERPRISE: 4 }

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id
  const user = await findUserForSubscription(subscription)

  if (!user) {
    console.error(`[Webhook] subscription.deleted: user not found for subscription ${subscription.id}`)
    return
  }

  // ------------------------------------------------------------------
  // 誤ダウングレード防止（reference/11-billing-spec.md R-2）
  // ------------------------------------------------------------------
  // 二重契約が起きたユーザーが片方を解約すると、残っている有効な契約を
  // 無視して FREE に落ちてしまう（＝支払っているのに使えない）。
  // 他に生きている契約があれば、そちらで再反映して終了する。
  // 照会失敗時は変更せずエラーを返し、Stripeの再送で再確認する。
  try {
    const remaining = (
      await findActiveLikeSubscriptions({ email: user.email, stripeCustomerId: customerId })
    ).filter((s) => s.id !== subscription.id)

    if (remaining.length > 0) {
      remaining.sort(
        (a, b) => (TIER_RANK[planTierFromPlanId(b.planId)] ?? 0) - (TIER_RANK[planTierFromPlanId(a.planId)] ?? 0)
      )
      const keep = remaining[0]!
      console.warn(
        `[Webhook] subscription.deleted: user=${user.id} には他に有効な契約が残っているため FREE に落とさない ` +
          `(deleted=${subscription.id} / keep=${keep.id}(${keep.status}))`
      )
      const live = await stripe.subscriptions.retrieve(keep.id)
      await updateUserSubscription(user.id, live)
      return
    }
  } catch (e: any) {
    console.error(`[Webhook] subscription.deleted: 残存契約の照会に失敗（プラン変更を中止） user=${user.id}`, e?.message)
    throw e
  }

  const synced = await syncUnifiedBilling({
    userId: user.id, plan: 'FREE', stripeSubscriptionId: null,
    stripePriceId: null, stripeCurrentPeriodEnd: null,
  })
  sendEventNotification({
    type: 'cancellation', userEmail: user.email, userName: user.name,
    details: `プラン: ${synced.previousPlan} → ${synced.userPlan}`,
  }).catch(() => {})
  console.log(`Subscription canceled for user: ${user.id} (plan: ${synced.userPlan})`)
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log(`Payment succeeded for invoice: ${invoice.id}`)

  // ------------------------------------------------------------------
  // 入金通知（ここが唯一「本当にお金が入った」瞬間）
  // ------------------------------------------------------------------
  // ⚠️ トライアル開始時にも金額0円の請求書が発行される。これを通知すると
  //    「課金された」と誤認するので、実際に入金があったものだけ通知する。
  const paid = invoice.amount_paid || 0
  if (paid <= 0) return

  const customerId = invoice.customer as string
  const user = customerId
    ? await prisma.user.findFirst({ where: { stripeCustomerId: customerId }, select: { email: true, name: true } })
    : null

  // 初回の入金か、毎月の更新かを区別する（トライアル明けの初課金を見逃さないため）
  const reason = String(invoice.billing_reason || '')
  const label =
    reason === 'subscription_create'
      ? '初回'
      : reason === 'subscription_cycle'
        ? '継続（月次更新）'
        : reason === 'subscription_update'
          ? 'プラン変更に伴う請求'
          : reason || '不明'

  const nextAt = invoice.lines?.data?.[0]?.period?.end
  sendEventNotification({
    type: 'payment',
    userEmail: user?.email || invoice.customer_email,
    userName: user?.name,
    details:
      `${yen(paid)} が入金されました（${label}）` +
      (nextAt ? ` ｜ 次回請求 ${jstDate(nextAt * 1000)}` : '') +
      ` ｜ invoice: ${invoice.id}`,
  }).catch(() => {})
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log(`Payment failed for invoice: ${invoice.id}`)
  const customerId = invoice.customer as string
  const user = customerId
    ? await prisma.user.findFirst({ where: { stripeCustomerId: customerId } })
    : null
  sendEventNotification({
    type: 'payment_failed',
    userEmail: user?.email,
    userName: user?.name,
    details: `invoice: ${invoice.id}`,
  }).catch(() => {})
}

// ========================================
// ユーザーサブスクリプション更新（統一課金）
// ========================================
// どのサービスから課金しても、全サービスが同じプランになる
async function updateUserSubscription(userId: string, subscription: Stripe.Subscription) {
  // incomplete/paused等の契約をイベントだけで有料化しない。
  if (!ACTIVE_LIKE_STATUSES.has(String(subscription.status))) return
  const { planId, priceId } = resolvePlanIdFromSubscription(subscription as any)
  const resolvedPlan = planTierFromPlanId(planId)
  if (resolvedPlan === 'FREE') throw new Error('Unable to resolve subscription plan')
  const synced = await syncUnifiedBilling({
    userId, plan: resolvedPlan,
    stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    stripeSubscriptionId: subscription.id, stripePriceId: priceId,
    stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
  })
  console.log(`Updated subscription for user ${userId}: ${synced.userPlan} (${subscription.status})`)
}
