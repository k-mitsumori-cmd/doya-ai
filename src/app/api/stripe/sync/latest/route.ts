import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, getPlanIdFromStripePriceId, getServiceIdFromPlanId } from '@/lib/stripe'

// ========================================
// Stripe再同期（session_id が無い/リダイレクト未経由の救済）
// ========================================
// POST /api/stripe/sync/latest
// - ユーザーemailからStripe Customerを特定（DBのstripeCustomerId優先）
// - アクティブ系サブスクを取得して、最も上位のbannerプランをDBへ反映

const ACTIVE_LIKE = new Set(['active', 'trialing', 'past_due', 'unpaid'])

function pickBestBannerPlan(planIds: Array<string | null | undefined>) {
  const ids = planIds.filter(Boolean).map(String)
  if (ids.some((p) => p === 'banner-enterprise')) return 'banner-enterprise'
  if (ids.some((p) => p === 'banner-pro')) return 'banner-pro'
  if (ids.some((p) => p === 'banner-basic' || p === 'banner-starter' || p === 'banner-business')) return 'banner-basic'
  return null
}

export async function POST(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, stripeCustomerId: true },
    })
    if (!user?.id || !user.email) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Customer特定（DB優先 → Stripe検索）
    let customerId = user.stripeCustomerId || null
    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 10 })
      const c = customers.data?.[0]
      customerId = c?.id || null
    }
    if (!customerId) {
      return NextResponse.json({ error: 'Stripe customer not found' }, { status: 404 })
    }

    // サブスク取得（all→フィルタ）
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 })
    const activeSubs = subs.data.filter((s) => ACTIVE_LIKE.has(String(s.status)))

    // bannerの候補を抽出
    const candidates = activeSubs
      .map((s) => {
        const priceId = s.items.data[0]?.price.id || null
        const planIdFromPrice = getPlanIdFromStripePriceId(priceId)
        const planIdFromMeta = (s.metadata?.planId as any) || null
        const planId = (planIdFromPrice || planIdFromMeta) as any
        return { subscription: s, priceId, planId }
      })
      .filter((x) => typeof x.planId === 'string' && String(x.planId).startsWith('banner-'))

    const bestPlanId = pickBestBannerPlan(candidates.map((c) => c.planId))
    if (!bestPlanId) {
      return NextResponse.json({ error: 'No active banner subscription found' }, { status: 404 })
    }

    // bestPlanId に一致するsubscriptionを選ぶ（なければ先頭）
    const best = candidates.find((c) => c.planId === bestPlanId) || candidates[0]
    const subscription = best.subscription
    const priceId = best.priceId

    // DBへ反映
    await prisma.user.update({
      where: { id: user.id },
      data: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId || undefined,
        stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
        plan: bestPlanId === 'banner-enterprise' ? 'ENTERPRISE' : bestPlanId === 'banner-pro' ? 'PRO' : 'PRO',
      },
    })

    const serviceId = getServiceIdFromPlanId(bestPlanId as any)
    await prisma.userServiceSubscription.upsert({
      where: { userId_serviceId: { userId: user.id, serviceId } },
      create: {
        userId: user.id,
        serviceId,
        plan: bestPlanId === 'banner-enterprise' ? 'ENTERPRISE' : 'PRO',
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId || undefined,
        stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
        dailyUsage: 0,
        monthlyUsage: 0,
        lastUsageReset: new Date(),
      },
      update: {
        plan: bestPlanId === 'banner-enterprise' ? 'ENTERPRISE' : 'PRO',
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId || undefined,
        stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    })

    return NextResponse.json({
      ok: true,
      customerId,
      subscriptionId: subscription.id,
      planId: bestPlanId,
      priceId,
      status: subscription.status,
    })
  } catch (e: any) {
    console.error('Stripe sync/latest error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to sync latest subscription' }, { status: 500 })
  }
}


