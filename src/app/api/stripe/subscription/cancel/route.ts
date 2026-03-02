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

    // まずDBから取得を試みる
    let subscriptionId =
      user.serviceSubscriptions?.[0]?.stripeSubscriptionId || user.stripeSubscriptionId || null

    // DBにない場合、Stripeから直接顧客のアクティブなサブスクリプションを検索
    if (!subscriptionId && user.stripeCustomerId) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: 'active',
          limit: 10,
        })
        // serviceId に一致するサブスクリプションを探す（metadata優先、次にplanId）
        const matched = subscriptions.data.find((sub) => {
          const priceId = sub.items.data[0]?.price.id || ''
          const productId = sub.items.data[0]?.price.product as string || ''
          const metaService = String(sub.metadata?.serviceId || '')
          const metaPlanId = String(sub.metadata?.planId || '')
          if (metaService && metaService === serviceId) return true
          if (metaPlanId && metaPlanId.startsWith(`${serviceId}-`)) return true
          // 最後のフォールバック（旧データ互換）：priceId/productId に serviceId が含まれている
          return priceId.includes(serviceId) || productId.includes(serviceId)
        })
        // 見つからない場合は最初のアクティブなサブスクリプションを使用
        subscriptionId = matched?.id || subscriptions.data[0]?.id || null
      } catch (e) {
        console.error('Failed to fetch subscriptions from Stripe:', e)
      }
    }

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    const updated =
      mode === 'immediate'
        ? await stripe.subscriptions.cancel(subscriptionId)
        : await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })

    // DBも更新しておく
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeSubscriptionId: subscriptionId },
      })
    } catch {}

    return NextResponse.json({
      ok: true,
      mode,
      subscriptionId: updated.id,
      status: updated.status,
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      currentPeriodEnd: updated.current_period_end,
    })
  } catch (e: any) {
    console.error('Subscription cancel error:', e)
    return NextResponse.json(
      { error: e?.message || 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}


