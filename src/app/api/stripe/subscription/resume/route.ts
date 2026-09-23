import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe, findActiveLikeSubscriptions, ACTIVE_LIKE_STATUSES } from '@/lib/stripe'
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

    // 統一契約はサービス名や古いDB参照で絞らず、現在の契約を横断して探す。
    const live = await findActiveLikeSubscriptions({ email: session.user.email, stripeCustomerId: user.stripeCustomerId })
    if (live.length === 0) {
      return NextResponse.json({ error: '継続できる契約が見つかりません。すでに契約が終了している可能性があります。' }, { status: 404 })
    }
    if (live.length > 1) {
      return NextResponse.json({
        code: 'MULTIPLE_SUBSCRIPTIONS',
        error: '複数の契約が見つかりました。二重のご請求を防ぐため自動で継続していません。継続する契約の確認をお問い合わせください。',
      }, { status: 409 })
    }
    const subscriptionId = live[0]!.id
    const current = await stripe.subscriptions.retrieve(subscriptionId)
    const customerId = typeof current.customer === 'string' ? current.customer : current.customer?.id
    if (customerId !== live[0]!.customerId || !ACTIVE_LIKE_STATUSES.has(current.status)) {
      return NextResponse.json({ error: '契約の状態が変更されました。再読み込みしてご確認ください。' }, { status: 409 })
    }
    // 再送時は、すでに継続中なら変更せず現在の状態を返す。
    const updated = current.cancel_at_period_end
      ? await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false })
      : current
    if (updated.cancel_at_period_end || !ACTIVE_LIKE_STATUSES.has(updated.status)) {
      return NextResponse.json({ error: '解約取り消しを確認できませんでした。契約状態を再確認してください。' }, { status: 502 })
    }

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

