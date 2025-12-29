import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

// ========================================
// サブスクリプション再開（解約取り消し）
// ========================================
// POST /api/stripe/subscription/resume
// body: { serviceId?: 'banner' | 'seo' | 'kantan' }
//
// 解約予約（cancel_at_period_end = true）を取り消してプランを継続させる

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const serviceId = String(body?.serviceId || 'banner')

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

    // DBにない場合、Stripeから直接顧客のサブスクリプションを検索
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
        subscriptionId = matched?.id || subscriptions.data[0]?.id || null
      } catch (e) {
        console.error('Failed to fetch subscriptions from Stripe:', e)
      }
    }

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // 解約予約を取り消す（cancel_at_period_end を false に戻す）
    const updated = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    })

    // localStorageの解約日時キャッシュをクリアするためにフラグを返す
    return NextResponse.json({
      ok: true,
      subscriptionId: updated.id,
      status: updated.status,
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      currentPeriodEnd: updated.current_period_end,
    })
  } catch (e: any) {
    console.error('Subscription resume error:', e)
    return NextResponse.json(
      { error: e?.message || 'Failed to resume subscription' },
      { status: 500 }
    )
  }
}

