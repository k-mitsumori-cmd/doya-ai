import { NextResponse } from 'next/server'
import { sendDailySummary, sendErrorNotification } from '@/lib/notifications'
import { prisma, withRetry } from '@/lib/prisma'
import { stripe, findActiveLikeSubscriptions } from '@/lib/stripe'
import { syncUnifiedBilling } from '@/lib/billing-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

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
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      stripeCurrentPeriodEnd: true,
    },
  })

  if (expiredUsers.length === 0) return 0

  let resetCount = 0

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
            console.error("[api/cron/daily-summary] failed")
            continue
          }
        }
      } else {
        shouldReset = true
      }

      if (!shouldReset) continue

      // ------------------------------------------------------------------
      // 誤ダウングレード防止（reference/11-billing-spec.md R-2。Webhook の解約処理と同じ考え方）
      // ------------------------------------------------------------------
      // 顧客が分裂して二重契約になっていると、DB の ID が解約済みの側を指していることがある。
      // ほかに生きている契約が残っていれば、ここでは落とさない（照会に失敗したときも、外側の catch で落とさない）。
      const remaining = (
        await findActiveLikeSubscriptions({ userId: user.id, email: user.email, stripeCustomerId: user.stripeCustomerId })
      ).filter((s) => s.id !== user.stripeSubscriptionId)
      if (remaining.length > 0) {
        console.warn(`[Cron] Skip expired-subscription reset: user=${user.id} has another live subscription`)
        continue
      }

      // FREE に戻すときも、正規の同期処理を通す（以前は User と各サービスの行を直接書き換えていた）。
      // これで手動付与の保護、HR 組織の同期、全行を 1 つのトランザクションで更新することが効く。
      const synced = await syncUnifiedBilling({
        userId: user.id, plan: 'FREE', stripeSubscriptionId: null,
        stripePriceId: null, stripeCurrentPeriodEnd: null,
      })

      resetCount++
      console.log(`[Cron] Reset expired subscription: user=${user.id} oldPlan=${user.plan} newPlan=${synced.userPlan}`)
    } catch (err: any) {
      console.error("[api/cron/daily-summary] failed")
    }
  }

  return resetCount
}

export async function GET(request: Request) {
  // Vercel Cron からの呼び出しを認証
  // ⚠️ CRON_SECRET が未設定だとテンプレートが "Bearer undefined" になり、
    //    その文字列を送れば通ってしまう。未設定なら動かさないこと。
    const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 期限切れサブスクリプションのフォールバック処理（DB接続エラー時はリトライ）
    const resetCount = await withRetry(() => resetExpiredSubscriptions())
    if (resetCount > 0) {
      console.log(`[Cron] Reset ${resetCount} expired subscription(s)`)
    }

    await withRetry(() => sendDailySummary())
    return NextResponse.json({ success: true, expiredResets: resetCount })
  } catch (error: any) {
    console.error('[Cron] daily-summary error:')
    await sendErrorNotification({
      errorMessage: error?.message || 'Failed to send daily summary',
      errorStack: error?.stack,
      pathname: '/api/cron/daily-summary',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    return NextResponse.json(
      { error: '定期処理を完了できませんでした' },
      { status: 500 }
    )
  }
}
