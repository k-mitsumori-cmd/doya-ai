import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import {
  constructWebhookEvent,
  stripe,
  ALL_SERVICE_IDS,
  resolvePlanIdFromSubscription,
  planTierFromPlanId,
  findActiveLikeSubscriptions,
} from '@/lib/stripe'
import { prisma, withRetry } from '@/lib/prisma'
import { isManualGrant } from '@/lib/billing-manual-grants'
import { higherPlan } from '@/lib/plan-utils'
import { sendEventNotification } from '@/lib/notifications'
import Stripe from 'stripe'

// ========================================
// Stripe Webhook Handler
// ========================================
// POST /api/stripe/webhook
// Stripeからのイベントを処理

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = headers()
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

  // 課金通知
  sendEventNotification({
    type: 'subscription',
    userEmail: user.email,
    userName: user.name,
    details: `チェックアウト完了（subscription: ${subscriptionId || 'N/A'}）`,
  }).catch(() => {})
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
  // 照会に失敗したときは従来どおり FREE に落とす（挙動を悪化させない）。
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
    console.error(`[Webhook] subscription.deleted: 残存契約の照会に失敗（FREEへ落とします） user=${user.id}`, e?.message)
  }

  // プランをフリーに戻す（DB接続エラー時はリトライ）
  await withRetry(() => prisma.user.update({
    where: { id: user.id },
    data: {
      plan: 'FREE',
      stripeSubscriptionId: null,
      stripePriceId: null,
      stripeCurrentPeriodEnd: null,
    },
  }))

  // 解約通知
  sendEventNotification({
    type: 'cancellation',
    userEmail: user.email,
    userName: user.name,
    details: `プラン: ${user.plan} → FREE`,
  }).catch(() => {})

  // 統一課金: 全サービスをFREEに戻す
  for (const serviceId of ALL_SERVICE_IDS) {
    await prisma.userServiceSubscription.update({
      where: { userId_serviceId: { userId: user.id, serviceId } },
      data: {
        plan: 'FREE',
        stripeSubscriptionId: null,
        stripePriceId: null,
        stripeCurrentPeriodEnd: null,
      },
    }).catch((e: any) => {
      if (e?.code !== 'P2025') {
        console.error(`[Webhook] Failed to reset service subscription: user=${user.id} service=${serviceId}`, e?.message)
      }
    })
  }

  // HR固有: HrOrganization.planもFREEにリセット
  await syncHrOrganizationPlan(user.id, 'FREE').catch((e: any) => {
    console.error(`[Webhook] Failed to sync HrOrganization.plan on cancellation: user=${user.id}`, e?.message)
  })

  console.log(`Subscription canceled for user: ${user.id} (all services reset to FREE)`)
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log(`Payment succeeded for invoice: ${invoice.id}`)
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
  // 階層判定は planTierFromPlanId() ただ一つに集約する（reference/11-billing-spec.md INV-4）。
  // かつて webhook / sync / sync-latest がそれぞれ独自にif文を持っており、
  // '-starter' や 'bundle' の扱いが経路ごとに食い違っていた。
  const { planId, priceId } = resolvePlanIdFromSubscription(subscription as any)
  let userPlan: string = planTierFromPlanId(planId)

  // ------------------------------------------------------------------
  // 手動付与の保護（reference/11-billing-spec.md）
  // ------------------------------------------------------------------
  // ⚠️ ここは Stripe の価格から算出した階層で User.plan を**上書き**する。
  //    そのため運営が手で付けた上位プラン（例: 請求は¥9,980だがDBはENTERPRISE）は、
  //    次回請求の customer.subscription.updated で**静かに消える**。
  //    billing_manual_grants に登録されたアカウントに限り、DBの方が上位なら下げない。
  const current = await prisma.user
    .findUnique({ where: { id: userId }, select: { email: true, plan: true } })
    .catch(() => null)
  if (current && (await isManualGrant(current.email))) {
    const keep = higherPlan(current.plan, userPlan)
    if (keep !== userPlan) {
      console.warn(
        `[Webhook] 手動付与のため降格しない: user=${userId} DB=${current.plan} / Stripe算出=${userPlan} → ${keep}`
      )
      userPlan = keep
    }
  }

  // グローバルプランを更新（DB接続エラー時はリトライ）
  await withRetry(() => prisma.user.update({
    where: { id: userId },
    data: {
      plan: userPlan,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  }))

  // 統一課金: 全サービスを同じプランに更新
  const servicePlan = userPlan === 'BUNDLE' ? 'PRO' : userPlan
  for (const serviceId of ALL_SERVICE_IDS) {
    await prisma.userServiceSubscription.upsert({
      where: { userId_serviceId: { userId, serviceId } },
      create: {
        userId,
        serviceId,
        plan: servicePlan,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
        dailyUsage: 0,
        monthlyUsage: 0,
        lastUsageReset: new Date(),
      },
      update: {
        plan: servicePlan,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    }).catch((e: any) => {
      console.error(`[Webhook] Failed to upsert service subscription: user=${userId} service=${serviceId}`, e?.message)
    })
  }

  // HR固有: UserServiceSubscription(serviceId:'hr') が更新されたら
  // ユーザーがOWNERの HrOrganization.plan も同期する
  await syncHrOrganizationPlan(userId, servicePlan).catch((e: any) => {
    console.error(`[Webhook] Failed to sync HrOrganization.plan: user=${userId}`, e?.message)
  })

  console.log(`Updated subscription for user ${userId}: ${userPlan} — all services: ${servicePlan} (${subscription.status})`)
}

// ========================================
// HR組織プラン同期
// ========================================
// ユーザーがOWNERである全HrOrganization.planをUserServiceSubscriptionの値と同期
async function syncHrOrganizationPlan(userId: string, plan: string) {
  // hr-starter → STARTER, hr-pro → PRO, hr-enterprise → ENTERPRISE のマッピングは
  // servicePlan が既に LIGHT/PRO/ENTERPRISE/FREE なのでそのまま使える
  const ownerships = await prisma.hrOrganizationMember.findMany({
    where: { userId, role: 'OWNER', status: 'ACTIVE' },
    select: { organizationId: true },
  })

  for (const membership of ownerships) {
    // LIGHT → STARTER にマッピング（HrOrganization.plan は STARTER を使用）
    const hrPlan = plan === 'LIGHT' ? 'STARTER' : plan
    await prisma.hrOrganization.update({
      where: { id: membership.organizationId },
      data: { plan: hrPlan },
    }).catch((e: any) => {
      console.error(`[Webhook] Failed to update HrOrganization.plan: org=${membership.organizationId}`, e?.message)
    })
  }
}
