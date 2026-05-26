export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

// POST /api/hr/billing/webhook
// ドヤHR専用のStripe Webhookハンドラー
// Stripeダッシュボードで /api/hr/billing/webhook を対象に
// STRIPE_HR_WEBHOOK_SECRET を別途設定する
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

  const webhookSecret = process.env.STRIPE_HR_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[HrWebhook] STRIPE_HR_WEBHOOK_SECRET is not set')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('[HrWebhook] Signature verification failed:', err.message)
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    )
  }

  console.log(`[HrWebhook] Received: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleHrCheckoutCompleted(session)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleHrSubscriptionUpdated(subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleHrSubscriptionDeleted(subscription)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        console.log(`[HrWebhook] Payment failed for invoice: ${invoice.id}`)
        break
      }

      default:
        console.log(`[HrWebhook] Unhandled event: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[HrWebhook] Handler error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ========================================
// ハンドラー
// ========================================

async function handleHrCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orgId = session.metadata?.hrOrganizationId
  const planId = session.metadata?.planId
  const subscriptionId = session.subscription as string
  const customerId = session.customer as string

  if (!orgId) {
    console.error('[HrWebhook] No hrOrganizationId in checkout metadata')
    return
  }

  console.log(`[HrWebhook] Checkout completed for org: ${orgId}, plan: ${planId}`)

  // サブスクリプション詳細を取得
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const priceId = subscription.items.data[0]?.price.id || null

  // プラン判定
  const plan = resolveHrPlan(planId || '')

  await prisma.hrOrganization.update({
    where: { id: orgId },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      plan,
    },
  })
}

async function handleHrSubscriptionUpdated(subscription: Stripe.Subscription) {
  const orgId = subscription.metadata?.hrOrganizationId
  const customerId = subscription.customer as string

  // metadataにorgIdがない場合はcustomerIdで検索
  const org = orgId
    ? await prisma.hrOrganization.findUnique({ where: { id: orgId } })
    : await prisma.hrOrganization.findFirst({ where: { stripeCustomerId: customerId } })

  if (!org) {
    console.error(`[HrWebhook] Organization not found for subscription update: orgId=${orgId}, customerId=${customerId}`)
    return
  }

  // canceledになった場合
  if (subscription.status === 'canceled') {
    await handleHrSubscriptionDeleted(subscription)
    return
  }

  const priceId = subscription.items.data[0]?.price.id || null
  const planId = subscription.metadata?.planId || ''
  const plan = resolveHrPlan(planId)

  await prisma.hrOrganization.update({
    where: { id: org.id },
    data: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      plan,
    },
  })

  console.log(`[HrWebhook] Subscription updated for org ${org.id}: ${plan}`)
}

async function handleHrSubscriptionDeleted(subscription: Stripe.Subscription) {
  const orgId = subscription.metadata?.hrOrganizationId
  const customerId = subscription.customer as string

  const org = orgId
    ? await prisma.hrOrganization.findUnique({ where: { id: orgId } })
    : await prisma.hrOrganization.findFirst({ where: { stripeCustomerId: customerId } })

  if (!org) {
    console.error(`[HrWebhook] Organization not found for subscription deletion: orgId=${orgId}, customerId=${customerId}`)
    return
  }

  await prisma.hrOrganization.update({
    where: { id: org.id },
    data: {
      plan: 'FREE',
      stripeSubscriptionId: null,
      stripePriceId: null,
      stripeCurrentPeriodEnd: null,
    },
  })

  console.log(`[HrWebhook] Subscription deleted for org ${org.id}: reset to FREE`)
}

/**
 * planId文字列からHRプランを解決
 */
function resolveHrPlan(planId: string): string {
  if (planId.includes('enterprise')) return 'ENTERPRISE'
  if (planId.includes('pro')) return 'PRO'
  if (planId.includes('starter')) return 'STARTER'
  return 'FREE'
}
