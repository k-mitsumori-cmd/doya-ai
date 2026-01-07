import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { constructWebhookEvent, getPlanIdFromStripePriceId, getServiceIdFromPlanId, stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'
import { normalizeUnifiedPlan, type UnifiedPlan, syncUserPlanAcrossServices, maxPlan } from '@/lib/planSync'
import { sendPaymentNotification } from '@/lib/notifications'

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

const ACTIVE_LIKE = new Set(['active', 'trialing', 'past_due', 'unpaid'])

// ========================================
// イベントハンドラー
// ========================================

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id || session.metadata?.userId
  const customerId = session.customer as string
  const subscriptionId = session.subscription as string

  if (!userId) {
    console.error('No userId found in checkout session')
    return
  }

  console.log(`Checkout completed for user: ${userId}`)

  // ユーザー情報を取得
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, plan: true },
  })

  // ユーザーにStripe Customer IDを保存
  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeCustomerId: customerId,
    },
  })

  // サブスクリプション情報を取得
  let subscription: Stripe.Subscription | null = null
  if (subscriptionId) {
    subscription = await stripe.subscriptions.retrieve(subscriptionId)
    await updateUserSubscription(userId, subscription)
  }

  // 課金通知を送信（非同期、エラーはログに記録するだけ）
  if (user && subscription) {
    const price = subscription.items.data[0]?.price
    const amount = price?.unit_amount || session.amount_total || 0
    const currency = price?.currency || session.currency || 'jpy'
    const plan = normalizeUnifiedPlan(user.plan || 'FREE')

    sendPaymentNotification({
      userId,
      email: user.email,
      name: user.name,
      plan,
      amount,
      currency,
      subscriptionId,
      isRecurring: false, // 初回チェックアウト
    }).catch((e) => {
      console.error('Failed to send payment notification:', e)
    })
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId
  let user = null
  
  if (!userId) {
    // Customer IDからユーザーを検索
    user = await prisma.user.findFirst({
      where: { stripeCustomerId: subscription.customer as string },
      select: { id: true, email: true, name: true, plan: true },
    })
    if (user) {
      await updateUserSubscription(user.id, subscription)
    } else {
      return
    }
  } else {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, plan: true },
    })
    if (!user) {
      return
    }
    await updateUserSubscription(userId, subscription)
  }

  // 初回サブスクリプション作成時にも通知を送信（checkout.session.completedと重複する可能性があるが、確実性を優先）
  const price = subscription.items.data[0]?.price
  const amount = price?.unit_amount || 0
  const currency = price?.currency || 'jpy'
  const plan = normalizeUnifiedPlan(user.plan || 'FREE')

  sendPaymentNotification({
    userId: user.id,
    email: user.email,
    name: user.name,
    plan,
    amount,
    currency,
    subscriptionId: subscription.id,
    isRecurring: false, // 初回サブスクリプション
  }).catch((e) => {
    console.error('Failed to send payment notification:', e)
  })
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  })

  if (!user) {
    console.error(`User not found for customer: ${customerId}`)
    return
  }

  await updateUserSubscription(user.id, subscription)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  })

  if (!user) {
    console.error(`User not found for customer: ${customerId}`)
    return
  }

  // 削除イベントは「現時点の有効サブスク」から統一プランを再計算して反映する
  const resolved = await resolveUnifiedPlanForCustomer(customerId)
  await syncUserPlanAcrossServices({
    userId: user.id,
    plan: resolved.plan,
    stripeSubscriptionId: resolved.best?.subscriptionId || null,
    stripePriceId: resolved.best?.priceId || null,
    stripeCurrentPeriodEnd: resolved.best?.currentPeriodEnd || null,
  })

  console.log(`Subscription canceled for user: ${user.id}`)
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log(`Payment succeeded for invoice: ${invoice.id}`)
  
  // 顧客IDからユーザーを検索
  const customerId = invoice.customer as string
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true, email: true, name: true, plan: true },
  })

  if (!user) {
    console.error(`User not found for customer: ${customerId}`)
    return
  }

  // サブスクリプション情報を取得
  const subscriptionId = invoice.subscription as string
  let subscription: Stripe.Subscription | null = null
  if (subscriptionId) {
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId)
    } catch (e) {
      console.error('Failed to retrieve subscription:', e)
    }
  }

  // 課金通知を送信（非同期、エラーはログに記録するだけ）
  const amount = invoice.amount_paid || invoice.total || 0
  const currency = invoice.currency || 'jpy'
  const plan = normalizeUnifiedPlan(user.plan || 'FREE')

  sendPaymentNotification({
    userId: user.id,
    email: user.email,
    name: user.name,
    plan,
    amount,
    currency,
    subscriptionId: subscriptionId || undefined,
    invoiceId: invoice.id,
    isRecurring: true, // 定期課金
  }).catch((e) => {
    console.error('Failed to send payment notification:', e)
  })
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log(`Payment failed for invoice: ${invoice.id}`)
  // 必要に応じてユーザーに通知
}

// ========================================
// ユーザーサブスクリプション更新
// ========================================
async function updateUserSubscription(userId: string, subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id
  const planIdFromPrice = getPlanIdFromStripePriceId(priceId)
  const planIdFromMeta = (subscription.metadata?.planId as any) || null
  const planId = (planIdFromPrice || planIdFromMeta) as any

  // サービス別は「参考として」更新（ただし、権限は後段の Complete Pack 同期が最終決定）
  if (planId && typeof planId === 'string' && planId.includes('-')) {
    const serviceId = getServiceIdFromPlanId(planId as any)
    if (serviceId !== 'bundle') {
      const inferredServicePlan = planFromPlanId(String(planId))
      await prisma.userServiceSubscription.upsert({
        where: { userId_serviceId: { userId, serviceId } },
        create: {
          userId,
          serviceId,
          plan: inferredServicePlan,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId || null,
          stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
          dailyUsage: 0,
          monthlyUsage: 0,
          lastUsageReset: new Date(),
        },
        update: {
          plan: inferredServicePlan,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId || null,
          stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
        },
      })
    }
  }

  // Complete Pack: 顧客に紐づく有効サブスクから「統一プラン」を算出して、全サービスへ同期
  const customerId = subscription.customer as string
  const resolved = await resolveUnifiedPlanForCustomer(customerId).catch(() => null)
  const unified = resolved?.plan || planFromPlanId(String(planId || '')) || normalizeUnifiedPlan('FREE')
  const best = resolved?.best || {
    subscriptionId: subscription.id,
    priceId: priceId || null,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
  }

  await syncUserPlanAcrossServices({
    userId,
    plan: unified,
    stripeSubscriptionId: best.subscriptionId,
    stripePriceId: best.priceId,
    stripeCurrentPeriodEnd: best.currentPeriodEnd,
  })

  console.log(`Updated subscription for user ${userId}: ${unified} (${subscription.status})`)
}

function planFromPlanId(planId: string): UnifiedPlan {
  const p = String(planId || '').toLowerCase()
  if (!p) return 'FREE'
  if (p.includes('enterprise')) return 'ENTERPRISE'
  if (p.includes('-pro') || p.includes('basic') || p.includes('starter') || p.includes('business') || p === 'bundle') return 'PRO'
  return 'FREE'
}

async function resolveUnifiedPlanForCustomer(customerId: string): Promise<{
  plan: UnifiedPlan
  best: null | { subscriptionId: string; priceId: string | null; currentPeriodEnd: Date | null }
}> {
  if (!customerId) return { plan: 'FREE', best: null }
  const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 })
  const activeSubs = subs.data.filter((s) => ACTIVE_LIKE.has(String(s.status)))
  if (activeSubs.length === 0) return { plan: 'FREE', best: null }

  let overall: UnifiedPlan = 'FREE'
  let bestSub: Stripe.Subscription | null = null
  for (const s of activeSubs) {
    const priceId = s.items.data[0]?.price?.id || null
    const planIdFromPrice = getPlanIdFromStripePriceId(priceId)
    const planIdFromMeta = (s.metadata?.planId as any) || null
    const planId = String(planIdFromPrice || planIdFromMeta || '')
    const plan = planFromPlanId(planId)
    const nextOverall = maxPlan(overall, plan)
    if (nextOverall !== overall) {
      overall = nextOverall
      bestSub = s
    }
  }

  const picked = bestSub || activeSubs[0]
  return {
    plan: overall,
    best: picked
      ? {
          subscriptionId: picked.id,
          priceId: picked.items.data[0]?.price?.id || null,
          currentPeriodEnd: picked.current_period_end ? new Date(picked.current_period_end * 1000) : null,
        }
      : null,
  }
}
