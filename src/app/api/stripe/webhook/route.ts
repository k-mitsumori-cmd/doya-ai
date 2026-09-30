import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import {
  constructWebhookEvent,
  stripe,
  ACTIVE_LIKE_STATUSES,
  resolvePlanIdFromSubscription,
  getPlanIdFromStripePriceId,
  isDoyaPlanId,
  isDoyaSubscription,
  planTierFromPlanId,
  findActiveLikeSubscriptions,
} from '@/lib/stripe'
import { prisma, withRetry } from '@/lib/prisma'
import { syncUnifiedBilling } from '@/lib/billing-sync'
import type { EventNotification } from '@/lib/notifications'
import { claimStripeWebhookEvent, finishStripeWebhookEvent } from '@/lib/stripe-webhook-receipts'
import { enqueueStripeWebhookNotification, deliverStripeWebhookNotification } from '@/lib/stripe-webhook-notifications'
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
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    )
  }

  console.log(`Stripe webhook received: ${event.type}`)

  let receiptToken: string | null = null
  try {
    const receipt = await claimStripeWebhookEvent(event.id, event.type)
    if (receipt.kind === 'processed') return NextResponse.json({ received: true })
    if (receipt.kind === 'inflight') {
      return NextResponse.json({ error: 'Webhook processing in progress' }, { status: 503 })
    }
    receiptToken = receipt.token
    let notification: EventNotification | null = null
    switch (event.type) {
      // ========================================
      // Checkout完了
      // ========================================
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        notification = await handleCheckoutCompleted(session)
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
        notification = await handleSubscriptionUpdated(subscription)
        break
      }

      // ========================================
      // サブスクリプション削除
      // ========================================
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        notification = await handleSubscriptionDeleted(subscription)
        break
      }

      // ========================================
      // 支払い成功
      // ========================================
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        notification = await handlePaymentSucceeded(invoice)
        break
      }

      // ========================================
      // 支払い失敗
      // ========================================
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        notification = await handlePaymentFailed(invoice)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    if (notification) {
      await enqueueStripeWebhookNotification(event.id, event.type, receipt.token, {
        ...notification,
        occurredAt: new Date((event.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      })
    }
    await finishStripeWebhookEvent(event.id, receipt.token, true)
    if (notification) {
      // 送信失敗はDBにpendingとして残す。Stripe本体の再処理は不要。
      await deliverStripeWebhookNotification(event.id).catch((error) => {
        console.error('[Webhook] notification dispatch failed:', event.id, error)
      })
    }
    return NextResponse.json({ received: true })

  } catch (error: any) {
    console.error('Webhook handler error:', error)
    if (receiptToken) {
      try {
        await finishStripeWebhookEvent(event.id, receiptToken, false)
      } catch (receiptError) {
        console.error('Webhook receipt update failed:', receiptError)
      }
    }
    return NextResponse.json(
      { error: 'Webhook processing failed' },
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

/** 同じStripeアカウントにある別アプリの請求を、ドヤAIの通知に混ぜない。 */
async function isDoyaInvoice(invoice: Stripe.Invoice): Promise<boolean> {
  const subscription = invoice.subscription
  if (subscription) {
    const resolved = typeof subscription === 'string'
      ? await stripe.subscriptions.retrieve(subscription)
      : subscription
    // 明示された他アプリの識別子は、共有価格IDより優先する。
    return isDoyaSubscription(resolved)
  }
  return Boolean(invoice.lines?.data?.some((line) => getPlanIdFromStripePriceId(line.price?.id) !== null))
}

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
    // 明示IDが存在しない場合、同じ顧客/メールの別ユーザーへ付け替えない。
    return prisma.user.findUnique({ where: { id: metaUserId }, select: USER_SELECT })
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
      throw e
    }
  }

  return null
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<EventNotification | null> {
  const userId = session.client_reference_id || session.metadata?.userId
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
  const explicitDoya = session.metadata?.app === 'doya-ai' || isDoyaPlanId(session.metadata?.planId)

  if (session.metadata?.app && session.metadata.app !== 'doya-ai') return null
  if (!subscriptionId) {
    if (explicitDoya) throw new Error(`[Webhook] checkout.session.completed: subscription missing for session ${session.id}`)
    console.log(`[Webhook] checkout.session.completed: unrelated session ${session.id} skipped`)
    return null
  }
  const sub = await stripe.subscriptions.retrieve(subscriptionId)
  if (!isDoyaSubscription(sub)) return null
  if (!userId || !customerId) {
    throw new Error(`[Webhook] checkout.session.completed: user/customer missing for session ${session.id}`)
  }
  const subCustomerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
  if (subCustomerId !== customerId ||
      (session.metadata?.userId && session.metadata.userId !== userId) ||
      (sub.metadata?.userId && sub.metadata.userId !== userId)) {
    throw new Error(`[Webhook] checkout.session.completed: identity mismatch for session ${session.id}`)
  }
  if (!ACTIVE_LIKE_STATUSES.has(String(sub.status))) return null

  console.log(`Checkout completed for user: ${userId}`)

  // 課金情報は syncUnifiedBilling でまとめて保存する。通知用のユーザーは先に読む。
  const user = await withRetry(() => prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  }))
  if (!user) throw new Error(`[Webhook] checkout.session.completed: user not found for session ${session.id}`)

  await updateUserSubscription(userId, sub)

  // ------------------------------------------------------------------
  // 申し込み通知（無料トライアルか、即課金かを必ず区別する）
  // ------------------------------------------------------------------
  // ⚠️ 「申し込み＝売上」ではない。初月無料の方はこの時点で1円も入金されていない。
  //    区別せずに通知すると、売上の見込みが立たず、入金遅れにも気づけない。
  if (sub) {
    const amount = sub.items.data[0]?.price.unit_amount ?? 0
    const isTrial = sub.status === 'trialing' && Boolean(sub.trial_end)
    return {
      type: isTrial ? 'trial_start' : 'subscription',
      userEmail: user.email,
      userName: user.name,
      details: isTrial
        ? `プロプラン（初月無料・30日）｜ ${jstDate(sub.trial_end! * 1000)} まで無料 ｜ ` +
          `初回請求 ${jstDate(sub.current_period_end * 1000)} に ${yen(amount)}（現時点の入金はありません）`
        : `プロプラン（無料期間なし）｜ ${yen(amount)} を請求 ｜ 次回請求 ${jstDate(sub.current_period_end * 1000)}`,
    }
  }
  return null
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  if (!isDoyaSubscription(subscription)) return
  const user = await findUserForSubscription(subscription)
  if (!user) {
    throw new Error(`[Webhook] subscription.created: user not found for subscription ${subscription.id}`)
  }
  await updateUserSubscription(user.id, subscription)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<EventNotification | null> {
  if (!isDoyaSubscription(subscription)) return null
  const user = await findUserForSubscription(subscription)

  if (!user) {
    throw new Error(`[Webhook] subscription.updated: user not found for subscription ${subscription.id}`)
  }

  // canceled / unpaid は FREE に戻す。
  // - canceled: 期間終了時の解約、またはトライアル終了時に支払い方法が無く missing_payment_method:'cancel' で解約
  // - unpaid: トライアル後/更新の初回課金が失敗しダンニング(再試行)も尽きた終端状態。
  //   updateUserSubscription は status を見ず PRO 付与するため、ここで弾かないと未入金のまま PRO が残る。
  if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    console.log(`Subscription ${subscription.status} via updated event for user: ${user.id}`)
    return handleSubscriptionDeleted(subscription)
  }

  await updateUserSubscription(user.id, subscription)
  return null
}

const TIER_RANK: Record<string, number> = { FREE: 0, LIGHT: 1, PRO: 2, BUNDLE: 3, ENTERPRISE: 4 }

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<EventNotification | null> {
  if (!isDoyaSubscription(subscription)) return null
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id
  const user = await findUserForSubscription(subscription)

  if (!user) {
    throw new Error(`[Webhook] subscription.deleted: user not found for subscription ${subscription.id}`)
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
      return null
    }
  } catch (e: any) {
    console.error(`[Webhook] subscription.deleted: 残存契約の照会に失敗（プラン変更を中止） user=${user.id}`, e?.message)
    throw e
  }

  const synced = await syncUnifiedBilling({
    userId: user.id, plan: 'FREE', stripeSubscriptionId: null,
    stripePriceId: null, stripeCurrentPeriodEnd: null,
  })
  const notification: EventNotification = {
    type: 'cancellation', userEmail: user.email, userName: user.name,
    details: `プラン: ${synced.previousPlan} → ${synced.userPlan}`,
  }
  console.log(`Subscription canceled for user: ${user.id} (plan: ${synced.userPlan})`)
  return notification
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<EventNotification | null> {
  // ------------------------------------------------------------------
  // 入金通知（ここが唯一「本当にお金が入った」瞬間）
  // ------------------------------------------------------------------
  // ⚠️ トライアル開始時にも金額0円の請求書が発行される。これを通知すると
  //    「課金された」と誤認するので、実際に入金があったものだけ通知する。
  const paid = invoice.amount_paid || 0
  if (paid <= 0) return null
  if (!await isDoyaInvoice(invoice)) return null
  console.log(`Payment succeeded for Doya invoice: ${invoice.id}`)

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
  return {
    type: 'payment',
    userEmail: user?.email || invoice.customer_email,
    userName: user?.name,
    details:
      `${yen(paid)} が入金されました（${label}）` +
      (nextAt ? ` ｜ 次回請求 ${jstDate(nextAt * 1000)}` : '') +
      ` ｜ invoice: ${invoice.id}`,
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<EventNotification | null> {
  if (!await isDoyaInvoice(invoice)) return null
  console.log(`Payment failed for Doya invoice: ${invoice.id}`)
  const customerId = invoice.customer as string
  const user = customerId
    ? await prisma.user.findFirst({ where: { stripeCustomerId: customerId } })
    : null
  return {
    type: 'payment_failed',
    userEmail: user?.email || invoice.customer_email,
    userName: user?.name,
    details: `invoice: ${invoice.id}`,
  }
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
