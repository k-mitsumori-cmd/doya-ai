import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

// ユーザーのStripe情報を取得
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userIdが必要です' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        plan: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
    }

    let subscriptionInfo = null
    if (user.stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
        subscriptionInfo = {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          priceId: subscription.items.data[0]?.price?.id,
          amount: subscription.items.data[0]?.price?.unit_amount,
          interval: subscription.items.data[0]?.price?.recurring?.interval,
        }
      } catch (e) {
        console.error('Stripe subscription fetch error:', e)
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        plan: user.plan,
      },
      subscription: subscriptionInfo,
    })
  } catch (error) {
    console.error('Admin stripe GET error:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}

// Stripeサブスクリプションを管理（キャンセル、再開など）
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, action } = body

    if (!userId || !action) {
      return NextResponse.json({ error: 'userIdとactionが必要です' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeSubscriptionId: true,
        stripeCustomerId: true,
      },
    })

    if (!user?.stripeSubscriptionId) {
      return NextResponse.json({ error: 'Stripeサブスクリプションがありません' }, { status: 400 })
    }

    let result
    switch (action) {
      case 'cancel':
        // 期間終了時にキャンセル（即時キャンセルではない）
        result = await stripe.subscriptions.update(user.stripeSubscriptionId, {
          cancel_at_period_end: true,
        })
        break

      case 'cancel_immediately':
        // 即時キャンセル
        result = await stripe.subscriptions.cancel(user.stripeSubscriptionId)
        // DBも更新
        await prisma.user.update({
          where: { id: userId },
          data: {
            plan: 'FREE',
            stripeSubscriptionId: null,
          },
        })
        break

      case 'resume':
        // キャンセル予定を取り消し
        result = await stripe.subscriptions.update(user.stripeSubscriptionId, {
          cancel_at_period_end: false,
        })
        break

      default:
        return NextResponse.json({ error: '不明なactionです' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      action,
      subscription: {
        id: result.id,
        status: result.status,
        cancelAtPeriodEnd: result.cancel_at_period_end,
      },
    })
  } catch (error) {
    console.error('Admin stripe POST error:', error)
    return NextResponse.json({ error: 'Stripe操作に失敗しました' }, { status: 500 })
  }
}

