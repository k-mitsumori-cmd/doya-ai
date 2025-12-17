import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = headers().get('stripe-signature')!
  
  let event: Stripe.Event
  
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    )
  }
  
  console.log(`Stripe webhook: ${event.type}`)
  
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription)
        break
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(invoice)
        break
      }
      
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentSucceeded(invoice)
        break
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
    
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

/**
 * Checkout完了時
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId
  if (!userId) {
    console.error('No userId in checkout session metadata')
    return
  }
  
  const subscriptionId = session.subscription as string
  const customerId = session.customer as string
  
  // Subscription詳細を取得
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      status: 'active',
      planId: 'pro',
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      status: 'active',
      planId: 'pro',
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  })
  
  // 監査ログ
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'SUBSCRIPTION_CREATED',
      resourceType: 'subscription',
      metadata: {
        subscriptionId,
        customerId,
      },
    },
  })
  
  console.log(`Subscription created for user: ${userId}`)
}

/**
 * Subscription更新時（更新、プラン変更など）
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId
  
  // userIdがメタデータにない場合、customerIdから検索
  let dbSubscription = userId
    ? await prisma.subscription.findUnique({ where: { userId } })
    : await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      })
  
  if (!dbSubscription) {
    console.error('Subscription not found in database')
    return
  }
  
  await prisma.subscription.update({
    where: { id: dbSubscription.id },
    data: {
      status: mapStripeStatus(subscription.status),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  })
  
  // 監査ログ
  await prisma.auditLog.create({
    data: {
      userId: dbSubscription.userId,
      action: 'SUBSCRIPTION_UPDATED',
      resourceType: 'subscription',
      metadata: {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    },
  })
  
  console.log(`Subscription updated: ${subscription.id}`)
}

/**
 * Subscription削除時（キャンセル完了）
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const dbSubscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  })
  
  if (!dbSubscription) {
    console.error('Subscription not found in database')
    return
  }
  
  await prisma.subscription.update({
    where: { id: dbSubscription.id },
    data: {
      status: 'canceled',
    },
  })
  
  // 監査ログ
  await prisma.auditLog.create({
    data: {
      userId: dbSubscription.userId,
      action: 'SUBSCRIPTION_CANCELED',
      resourceType: 'subscription',
      metadata: {
        subscriptionId: subscription.id,
      },
    },
  })
  
  console.log(`Subscription canceled: ${subscription.id}`)
}

/**
 * 支払い失敗時
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string
  
  const dbSubscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  })
  
  if (!dbSubscription) {
    console.error('Subscription not found for customer')
    return
  }
  
  await prisma.subscription.update({
    where: { id: dbSubscription.id },
    data: {
      status: 'past_due',
    },
  })
  
  // 監査ログ
  await prisma.auditLog.create({
    data: {
      userId: dbSubscription.userId,
      action: 'PAYMENT_FAILED',
      resourceType: 'subscription',
      metadata: {
        invoiceId: invoice.id,
        amountDue: invoice.amount_due,
      },
    },
  })
  
  // TODO: メール通知を送信
  
  console.log(`Payment failed for customer: ${customerId}`)
}

/**
 * 支払い成功時（更新時）
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string
  
  // billing_reason が 'subscription_cycle' の場合は更新
  if (invoice.billing_reason !== 'subscription_cycle') {
    return
  }
  
  const dbSubscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  })
  
  if (!dbSubscription) {
    return
  }
  
  // past_dueから復帰
  if (dbSubscription.status === 'past_due') {
    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: 'active',
      },
    })
    
    // 監査ログ
    await prisma.auditLog.create({
      data: {
        userId: dbSubscription.userId,
        action: 'PAYMENT_RECOVERED',
        resourceType: 'subscription',
        metadata: {
          invoiceId: invoice.id,
        },
      },
    })
  }
  
  console.log(`Payment succeeded for customer: ${customerId}`)
}

/**
 * Stripeのステータスをアプリのステータスにマッピング
 */
function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): string {
  const statusMap: Record<Stripe.Subscription.Status, string> = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'past_due',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
    trialing: 'active',
    paused: 'past_due',
  }
  return statusMap[stripeStatus] || 'incomplete'
}

