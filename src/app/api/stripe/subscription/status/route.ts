import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, getPlanIdFromStripePriceId } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

// ========================================
// サブスク状態取得（解約予約中の停止日時表示用）
// ========================================
// GET /api/stripe/subscription/status?serviceId=banner
// - cancel_at_period_end / current_period_end を返す
// - subscriptionId がDBに無い場合は customer から探索（安全側で読み取りのみ）

const ACTIVE_LIKE = new Set(['active', 'trialing', 'past_due', 'unpaid'])

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const serviceId = String(url.searchParams.get('serviceId') || 'banner')

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        serviceSubscriptions: {
          where: { serviceId },
          select: { stripeSubscriptionId: true },
          take: 1,
        },
      },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    let subscriptionId =
      user.serviceSubscriptions?.[0]?.stripeSubscriptionId || user.stripeSubscriptionId || null

    // DBに無い場合、Customerから探索（読み取りのみ）
    if (!subscriptionId && user.stripeCustomerId) {
      const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: 'all', limit: 20 })
      const activeSubs = subs.data.filter((s) => ACTIVE_LIKE.has(String(s.status)))
      const candidate = activeSubs.find((s) => {
        const priceId = s.items.data[0]?.price.id
        const planIdFromPrice = getPlanIdFromStripePriceId(priceId)
        const planIdFromMeta = (s.metadata?.planId as any) || null
        const planId = String(planIdFromPrice || planIdFromMeta || '')
        const metaService = String((s.metadata?.serviceId as any) || '').trim()
        if (metaService && metaService === serviceId) return true
        if (planId && planId.startsWith(`${serviceId}-`)) return true
        return false
      })
      subscriptionId = candidate?.id || activeSubs[0]?.id || null
    }

    if (!subscriptionId) {
      return NextResponse.json({ ok: true, hasSubscription: false })
    }

    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    const priceId = sub.items.data[0]?.price.id || null
    const planIdFromPrice = getPlanIdFromStripePriceId(priceId)
    const planIdFromMeta = (sub.metadata?.planId as any) || null

    return NextResponse.json({
      ok: true,
      hasSubscription: true,
      subscriptionId: sub.id,
      status: sub.status,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      currentPeriodEnd: sub.current_period_end, // unix seconds
      planId: planIdFromPrice || planIdFromMeta || null,
      priceId,
    })
  } catch (e: any) {
    console.error('Subscription status error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to get subscription status' }, { status: 500 })
  }
}


