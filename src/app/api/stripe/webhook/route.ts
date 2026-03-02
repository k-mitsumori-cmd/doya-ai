import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { constructWebhookEvent, getPlanIdFromStripePriceId, stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
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

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id || session.metadata?.userId
  const customerId = session.customer as string
  const subscriptionId = session.subscription as string

  if (!userId) {
    console.error('No userId found in checkout session')
    return
  }

  console.log(`Checkout completed for user: ${userId}`)

  // ユーザーにStripe Customer IDを保存
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      stripeCustomerId: customerId,
    },
    select: { email: true, name: true },
  })

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
  const userId = subscription.metadata?.userId
  if (!userId) {
    // Customer IDからユーザーを検索
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: subscription.customer as string },
    })
    if (user) {
      await updateUserSubscription(user.id, subscription)
    }
    return
  }
  await updateUserSubscription(userId, subscription)
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

  // サブスクリプションが canceled になった場合は FREE に戻す
  // （Stripe が期間終了時に cancel_at_period_end のサブスクを canceled にする）
  if (subscription.status === 'canceled') {
    console.log(`Subscription canceled via updated event for user: ${user.id}`)
    await handleSubscriptionDeleted(subscription)
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

  // プランをフリーに戻す
  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: 'FREE',
      stripeSubscriptionId: null,
      stripePriceId: null,
      stripeCurrentPeriodEnd: null,
    },
  })

  // 解約通知
  sendEventNotification({
    type: 'cancellation',
    userEmail: user.email,
    userName: user.name,
    details: `プラン: ${user.plan} → FREE`,
  }).catch(() => {})

  // 統一課金: 全サービスをFREEに戻す
  const allServiceIds = ['banner', 'seo', 'interview', 'persona', 'kantan', 'copy', 'voice', 'movie', 'lp', 'opening', 'shindan', 'tenkai']
  for (const serviceId of allServiceIds) {
    await prisma.userServiceSubscription.update({
      where: { userId_serviceId: { userId: user.id, serviceId } },
      data: {
        plan: 'FREE',
        stripeSubscriptionId: null,
        stripePriceId: null,
        stripeCurrentPeriodEnd: null,
      },
    }).catch(() => {})
  }

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
  const priceId = subscription.items.data[0]?.price.id
  const planIdFromPrice = getPlanIdFromStripePriceId(priceId)
  const planIdFromMeta = subscription.metadata?.planId || null
  const planId = String(planIdFromPrice || planIdFromMeta || '')

  // プランレベルを判定
  let userPlan = 'PRO' // 有料プランのデフォルト
  if (planId === 'bundle') {
    userPlan = 'BUNDLE'
  } else if (planId.endsWith('-enterprise')) {
    userPlan = 'ENTERPRISE'
  } else if (planId.endsWith('-pro') || planId === 'banner-basic' || planId.startsWith('banner-')) {
    userPlan = 'PRO'
  } else if (!planId) {
    userPlan = 'FREE'
  }

  // グローバルプランを更新
  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: userPlan,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  })

  // 統一課金: 全サービスを同じプランに更新
  const servicePlan = userPlan === 'BUNDLE' ? 'PRO' : userPlan
  const allServiceIds = ['banner', 'seo', 'interview', 'persona', 'kantan', 'copy', 'voice', 'movie', 'lp', 'opening', 'shindan', 'tenkai']
  for (const serviceId of allServiceIds) {
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
    }).catch(() => {})
  }

  console.log(`Updated subscription for user ${userId}: ${userPlan} — all services: ${servicePlan} (${subscription.status})`)
}
