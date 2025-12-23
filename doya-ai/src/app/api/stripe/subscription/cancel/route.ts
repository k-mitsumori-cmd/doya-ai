import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

// ========================================
// サブスクリプション解約（アプリ側直通）
// ========================================
// POST /api/stripe/subscription/cancel
// body: { serviceId?: 'banner' | 'seo' | 'kantan', mode?: 'period_end' | 'immediate' }
//
// - まずは安全側：period_end（期間末に解約）をデフォルトにする
// - immediate を指定すると即時解約（返金は行わない）

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const serviceId = String(body?.serviceId || 'banner')
    const mode = String(body?.mode || 'period_end') as 'period_end' | 'immediate'

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        stripeSubscriptionId: true,
        serviceSubscriptions: {
          where: { serviceId },
          select: { stripeSubscriptionId: true },
          take: 1,
        },
      },
    })

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const subscriptionId =
      user.serviceSubscriptions?.[0]?.stripeSubscriptionId || user.stripeSubscriptionId || null

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    const updated =
      mode === 'immediate'
        ? await stripe.subscriptions.cancel(subscriptionId)
        : await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })

    return NextResponse.json({
      ok: true,
      mode,
      subscriptionId: updated.id,
      status: updated.status,
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      currentPeriodEnd: updated.current_period_end,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}


