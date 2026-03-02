import { NextResponse } from 'next/server'
import { sendDailySummary, sendErrorNotification } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ========================================
// 期限切れサブスクリプションのフォールバック処理
// ========================================
// Stripe Webhook が未着の場合に備え、
// stripeCurrentPeriodEnd が過ぎているのに FREE でないユーザーを検出して
// Stripe 側の実際のステータスを確認し、必要に応じて FREE に戻す
async function resetExpiredSubscriptions() {
  const now = new Date()
  const expiredUsers = await prisma.user.findMany({
    where: {
      plan: { not: 'FREE' },
      stripeCurrentPeriodEnd: { lt: now },
      stripeSubscriptionId: { not: null },
    },
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      stripeSubscriptionId: true,
      stripeCurrentPeriodEnd: true,
    },
  })

  if (expiredUsers.length === 0) return 0

  let resetCount = 0
  const allServiceIds = ['banner', 'seo', 'interview', 'persona', 'kantan', 'copy', 'voice', 'movie', 'lp', 'opening', 'shindan', 'tenkai']

  for (const user of expiredUsers) {
    try {
      // Stripe 側の実際のステータスを確認（誤ってFREEに戻さないため）
      let shouldReset = false
      if (user.stripeSubscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
          // canceled or unpaid or past_due のみリセット対象
          if (['canceled', 'unpaid', 'incomplete_expired'].includes(sub.status)) {
            shouldReset = true
          } else if (sub.status === 'active' && !sub.cancel_at_period_end) {
            // まだ有効（更新された可能性あり）→ 期間終了日を更新
            await prisma.user.update({
              where: { id: user.id },
              data: {
                stripeCurrentPeriodEnd: new Date(sub.current_period_end * 1000),
              },
            })
            continue
          } else if (sub.cancel_at_period_end && sub.current_period_end * 1000 < now.getTime()) {
            shouldReset = true
          }
        } catch (stripeErr: any) {
          // Stripe 上でサブスクが見つからない → 削除済み
          if (stripeErr?.statusCode === 404 || stripeErr?.code === 'resource_missing') {
            shouldReset = true
          } else {
            console.error(`[Cron] Stripe API error for user ${user.id}:`, stripeErr?.message)
            continue
          }
        }
      } else {
        shouldReset = true
      }

      if (!shouldReset) continue

      // ユーザーの plan を FREE に戻す
      await prisma.user.update({
        where: { id: user.id },
        data: {
          plan: 'FREE',
          stripeSubscriptionId: null,
          stripePriceId: null,
          stripeCurrentPeriodEnd: null,
        },
      })

      // 全サービスも FREE に戻す
      for (const serviceId of allServiceIds) {
        await prisma.userServiceSubscription.update({
          where: { userId_serviceId: { userId: user.id, serviceId } },
          data: {
            plan: 'FREE',
            stripeSubscriptionId: null,
            stripePriceId: null,
            stripeCurrentPeriodEnd: null,
          },
        }).catch(() => {})
      }

      resetCount++
      console.log(`[Cron] Reset expired subscription: user=${user.id} email=${user.email} oldPlan=${user.plan}`)
    } catch (err: any) {
      console.error(`[Cron] Failed to reset user ${user.id}:`, err?.message)
    }
  }

  return resetCount
}

export async function GET(request: Request) {
  // Vercel Cron からの呼び出しを認証
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 期限切れサブスクリプションのフォールバック処理
    const resetCount = await resetExpiredSubscriptions()
    if (resetCount > 0) {
      console.log(`[Cron] Reset ${resetCount} expired subscription(s)`)
    }

    await sendDailySummary()
    return NextResponse.json({ success: true, expiredResets: resetCount })
  } catch (error: any) {
    console.error('[Cron] daily-summary error:', error)
    await sendErrorNotification({
      errorMessage: error?.message || 'Failed to send daily summary',
      errorStack: error?.stack,
      pathname: '/api/cron/daily-summary',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    return NextResponse.json(
      { error: error?.message || 'Failed to send daily summary', stack: error?.stack },
      { status: 500 }
    )
  }
}
