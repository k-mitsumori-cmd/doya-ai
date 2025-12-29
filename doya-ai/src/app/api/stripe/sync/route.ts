import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe, getPlanIdFromStripePriceId, getServiceIdFromPlanId } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

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
      select: { id: true, email: true, stripeCustomerId: true },
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
    const customerEmail = String((checkout.customer_email as any) || '').trim()
    // 古い決済で ref が email になっている/空のケースも救済しつつ、他人の決済は弾く
    if (ref && ref !== user.id && ref !== String(user.email || '').trim()) {
      return NextResponse.json({ error: 'Checkout session does not match user' }, { status: 403 })
    }
    if (customerEmail && user.email && customerEmail.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: 'Checkout session email does not match user' }, { status: 403 })
    }

    // Customer IDを保存（Webhookが遅延してもポータル等が使える）
    await prisma.user.update({
      where: { id: user.id },
      data: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      },
    })

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const priceId = subscription.items.data[0]?.price.id || null
    const planIdFromPrice = getPlanIdFromStripePriceId(priceId)
    const planIdFromMeta = (subscription.metadata?.planId as any) || null
    const planId = (planIdFromPrice || planIdFromMeta) as any

    if (planId && typeof planId === 'string' && planId.includes('-')) {
      const serviceId = getServiceIdFromPlanId(planId)
      if (serviceId !== 'bundle') {
        const isBannerPaid =
          serviceId === 'banner' &&
          (planId === 'banner-basic' ||
            planId === 'banner-pro' ||
            planId === 'banner-enterprise' ||
            planId === 'banner-starter' ||
            planId === 'banner-business')
        const servicePlan =
          serviceId === 'seo' && planId === 'seo-enterprise'
            ? 'ENTERPRISE'
            : serviceId === 'banner' && planId === 'banner-enterprise'
              ? 'ENTERPRISE'
              : planId.endsWith('-pro') || isBannerPaid
                ? 'PRO'
                : 'FREE'

        await prisma.userServiceSubscription.upsert({
          where: { userId_serviceId: { userId: user.id, serviceId } },
          create: {
            userId: user.id,
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

    // 互換用の全体planも更新
    const userPlan =
      planId === 'bundle'
        ? 'BUNDLE'
        : planId === 'seo-enterprise'
          ? 'ENTERPRISE'
          : planId === 'banner-enterprise'
            ? 'ENTERPRISE'
            : planId === 'banner-basic' || (planId && String(planId).endsWith('-pro'))
              ? 'PRO'
              : 'FREE'

    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: userPlan,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    })

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


