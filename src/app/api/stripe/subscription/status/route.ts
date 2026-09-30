import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, findActiveLikeSubscriptions, isDoyaSubscription, resolvePlanIdFromSubscription } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

// ========================================
// サブスク状態取得（解約予約中の停止日時表示用）
// ========================================
// GET /api/stripe/subscription/status?serviceId=banner
// - cancel_at_period_end / current_period_end を返す
// - subscriptionId がDBに無い場合は customer から探索（安全側で読み取りのみ）

const ACTIVE_LIKE = new Set(['active', 'trialing', 'past_due', 'unpaid'])
const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
const privateJson = (body: unknown, init?: ResponseInit) => NextResponse.json(body, { ...init, headers: privateHeaders })

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return privateJson({ error: 'Unauthorized' }, { status: 401 })
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
    if (!user) return privateJson({ error: 'User not found' }, { status: 404 })

    const live = await findActiveLikeSubscriptions({ email: user.email, stripeCustomerId: user.stripeCustomerId })
    if (live.length > 1) {
      return privateJson({
        ok: false,
        code: 'MULTIPLE_SUBSCRIPTIONS',
        error: '複数の契約が見つかったため、単一の停止日時を表示できません。契約内容をお問い合わせください。',
      }, { status: 409 })
    }
    // unpaidは継続可能契約の探索対象外だが、保存済みの支払停止状態は確認する。
    const savedId = user.serviceSubscriptions?.[0]?.stripeSubscriptionId || user.stripeSubscriptionId
    const subscriptionId = live[0]?.id || savedId
    if (!subscriptionId) return privateJson({ ok: true, hasSubscription: false })
    let sub
    try {
      sub = await stripe.subscriptions.retrieve(subscriptionId)
    } catch (e: any) {
      if (live.length === 0 && e?.code === 'resource_missing') {
        return privateJson({ ok: true, hasSubscription: false })
      }
      throw e
    }
    if (!ACTIVE_LIKE.has(String(sub.status)) || !isDoyaSubscription(sub)) return privateJson({ ok: true, hasSubscription: false })
    if (sub.metadata?.userId && sub.metadata.userId !== user.id) {
      return privateJson({ error: '契約情報の一致を確認できませんでした。' }, { status: 409 })
    }
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
    const expectedCustomerId = live[0]?.customerId || user.stripeCustomerId
    if (!expectedCustomerId || customerId !== expectedCustomerId) {
      return privateJson({ error: '契約情報の一致を確認できませんでした。' }, { status: 409 })
    }
    const { planId, priceId } = resolvePlanIdFromSubscription(sub)
    return privateJson({
      ok: true,
      hasSubscription: true,
      subscriptionId: sub.id,
      status: sub.status,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      currentPeriodEnd: sub.current_period_end,
      planId: planId || null,
      priceId,
    })
  } catch (e: any) {
    console.error('Subscription status error:', e)
    return privateJson({ error: '契約状態を確認できませんでした。時間をおいて再試行してください。' }, { status: 500 })
  }
}
