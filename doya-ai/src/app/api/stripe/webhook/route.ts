import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { constructWebhookEvent, getPlanIdFromStripePriceId, getServiceIdFromPlanId, stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
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
  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeCustomerId: customerId,
    },
  })

  // サブスクリプション情報を取得
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    await updateUserSubscription(userId, subscription)
  }
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

  // サービス別プランもフリーに戻す（どのサービスの解約かは価格ID/metadataから推定）
  try {
    const priceId = subscription.items.data[0]?.price.id
    const planIdFromPrice = getPlanIdFromStripePriceId(priceId)
    const planIdFromMeta = (subscription.metadata?.planId as any) || null
    const planId = (planIdFromPrice || planIdFromMeta) as any
    if (planId && typeof planId === 'string') {
      const serviceId = getServiceIdFromPlanId(planId)
      if (serviceId !== 'bundle') {
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
    }
  } catch {}

  console.log(`Subscription canceled for user: ${user.id}`)
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log(`Payment succeeded for invoice: ${invoice.id}`)
  // 必要に応じて通知メールなどを送信
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

  // まずはサービス別に確実に反映
  if (planId && typeof planId === 'string' && planId.includes('-')) {
    const serviceId = getServiceIdFromPlanId(planId)
    if (serviceId !== 'bundle') {
      const servicePlan =
        planId === 'seo-business'
          ? 'BUSINESS'
          : planId.endsWith('-pro')
            ? 'PRO'
            : 'FREE'
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
      })
    }
  }

  // ポータル全体のplanも更新（互換用）
  const userPlan =
    planId === 'bundle' ? 'BUNDLE'
      : planId === 'seo-business' ? 'BUSINESS'
        : planId && String(planId).endsWith('-pro') ? 'PRO'
          : 'FREE'

  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: userPlan,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  })

  console.log(`Updated subscription for user ${userId}: ${userPlan} (${subscription.status})`)
}
