import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe, findActiveLikeSubscriptions, isDoyaSubscriptionOwnedByUser, resolvePlanIdFromSubscription, ACTIVE_LIKE_STATUSES } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { notifyAlert } from '@/lib/alert'
import { enqueueBillingOperationalNotification, deliverStripeWebhookNotification } from '@/lib/stripe-webhook-notifications'

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

    // ------------------------------------------------------------------
    // 解約対象の決定（reference/11-billing-spec.md）
    // ------------------------------------------------------------------
    // ⚠️ 以前はここが「DBのID → 無ければ stripeCustomerId の status:'active' を検索」
    //    だった。これには利用者が自分で課金を止められなくなる穴が3つあった。
    //    1) Checkout は customer_email で都度 Customer を作るため**顧客が分裂**する。
    //       DB の stripeCustomerId 側にしか契約が無いと、もう一方の課金中契約に到達できない
    //       （2026-08 の二重契約者が、解約ボタンでもポータルでも active を止められなかった実例）。
    //    2) status:'active' 縛りのため **trialing の契約が見つからない**。
    //       トライアル中に解約したい方が 404 になる。
    //    3) DB の ID が古い/解約済みでも、そのまま Stripe に投げて 500 になる。
    //
    //    統一プランは「1契約＝全サービス」なので、解約の意図は**課金を止めること**。
    //    メール横断で生きている契約を全部拾い、すべて止める。
    let live = await findActiveLikeSubscriptions({
      userId: user.id,
      email: user.email,
      stripeCustomerId: user.stripeCustomerId,
    })

    // メール横断で見つからないときだけ、DB に残っている ID を最後の頼みにする
    if (live.length === 0) {
      const dbId = user.serviceSubscriptions?.[0]?.stripeSubscriptionId || user.stripeSubscriptionId
      if (dbId) {
        try {
          const s = await stripe.subscriptions.retrieve(dbId)
          const customerId = typeof s.customer === 'string' ? s.customer : String(s.customer?.id || '')
          if (ACTIVE_LIKE_STATUSES.has(String(s.status)) && customerId) {
            // 保存済みIDの一致だけでは他人の契約を操作し得るため、Stripe側の所有者を照合。
            if (!(await isDoyaSubscriptionOwnedByUser(s, user))) {
              return NextResponse.json({ error: '契約情報の一致を確認できませんでした。' }, { status: 409 })
            }
            const { priceId, planId } = resolvePlanIdFromSubscription(s)
            live = [
              {
                id: s.id,
                status: String(s.status),
                customerId,
                priceId,
                planId,
              },
            ]
          }
        } catch (e: any) {
          if (e?.code !== 'resource_missing') throw e
          console.warn('[Cancel] 保存済みsubscriptionIdがStripeに存在しない:', dbId)
        }
      }
    }

    if (live.length === 0) {
      return NextResponse.json(
        { error: '有効なご契約が見つかりませんでした。すでに解約済みの可能性があります。' },
        { status: 404 }
      )
    }

    // ⚠️ 二重契約が残っている場合、1本だけ止めると課金が続く。生きているものは全部止める。
    type CancelOk = {
      subscriptionId: string
      status: string
      cancelAtPeriodEnd: boolean
      currentPeriodEnd: number
    }
    type CancelNg = { subscriptionId: string; error: string }
    const results: Array<CancelOk | CancelNg> = []
    for (const s of live) {
      try {
        const current = await stripe.subscriptions.retrieve(s.id)
        if (current.id !== s.id || !ACTIVE_LIKE_STATUSES.has(String(current.status)) ||
            !(await isDoyaSubscriptionOwnedByUser(current, user))) {
          results.push({ subscriptionId: s.id, error: '契約情報の一致を確認できませんでした' })
          continue
        }
        const updated =
          mode === 'immediate'
            ? await stripe.subscriptions.cancel(s.id)
            : await stripe.subscriptions.update(s.id, { cancel_at_period_end: true })
        results.push({
          subscriptionId: updated.id,
          status: updated.status,
          cancelAtPeriodEnd: updated.cancel_at_period_end,
          currentPeriodEnd: updated.current_period_end,
        })
      } catch (e: any) {
        console.error("[api/stripe/subscription/cancel] failed")
        results.push({ subscriptionId: s.id, error: '解約処理に失敗しました' })
      }
    }

    const succeeded = results.filter((r): r is CancelOk => !('error' in r))
    const failed = results.filter((r): r is CancelNg => 'error' in r)
    if (succeeded.length === 0) {
      await notifyCancellationFailure(user, results, failed)
      return NextResponse.json(
        { error: '解約処理に失敗しました。お手数ですがお問い合わせください。', results },
        { status: 500 }
      )
    }

    const primary = succeeded[0]!
    const primaryCustomerId = live.find(s => s.id === primary.subscriptionId)?.customerId

    // DBも更新しておく（顧客が分裂していた場合は、実在する顧客IDへ寄せる）
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeSubscriptionId: primary.subscriptionId,
          ...(primaryCustomerId ? { stripeCustomerId: primaryCustomerId } : {}),
        },
      })
    } catch {}

    // 一部でも失敗が残っていたら運営が気づけるようにする（課金が止まっていない可能性）
    if (failed.length > 0) {
      await notifyCancellationFailure(user, results, failed)
      return NextResponse.json({
        ok: false,
        code: 'CANCELLATION_INCOMPLETE',
        error: '一部の契約を解約できませんでした。解約は完了しておらず、課金が続く可能性があります。再度解約をお試しいただき、解消しない場合はお問い合わせください。',
        canceledCount: succeeded.length,
        failedCount: results.length - succeeded.length,
        results,
      }, { status: 502 })
    }

    return NextResponse.json({
      ok: true,
      mode,
      // 後方互換（画面は単一契約を前提に読んでいる）
      subscriptionId: primary.subscriptionId,
      status: primary.status,
      cancelAtPeriodEnd: primary.cancelAtPeriodEnd,
      currentPeriodEnd: primary.currentPeriodEnd,
      // 二重契約が残っていた場合の内訳
      canceledCount: succeeded.length,
      results,
    })
  } catch (e: any) {
    console.error('Subscription cancel error:')
    return NextResponse.json(
      { error: '解約処理を完了できませんでした。時間をおいて再試行し、解消しない場合はお問い合わせください。' },
      { status: 500 }
    )
  }
}

async function notifyCancellationFailure(
  user: { id: string; email: string | null },
  results: Array<{ subscriptionId: string; error?: string }>,
  failed: Array<{ subscriptionId: string; error: string }>
): Promise<void> {
  const failedIds = failed.map((item) => item.subscriptionId).sort().join(',')
  // 同じ失敗の連打は10分単位でまとめ、異なる失敗対象や次の時間帯は再通知する。
  const digest = createHash('sha256').update(failedIds).digest('hex').slice(0, 12)
  const eventId = `billing-cancel-failed:${user.id}:${Math.floor(Date.now() / 600_000)}:${digest}`
  const details = `解約 ${results.length} 件中 ${failed.length} 件失敗。対象: ${failedIds}。課金が続く可能性があります。`
  try {
    await enqueueBillingOperationalNotification(eventId, 'billing.cancel.failed', {
      type: 'cancellation_incomplete', userId: user.id, userEmail: user.email, details,
    })
  } catch (error) {
    // DB障害で登録できない場合は従来の直接通知を試みる。利用者への失敗応答は維持する。
    console.error('[Cancel] failure notification enqueue failed:')
    try {
      await notifyAlert({
        level: 'critical',
        title: '解約処理に失敗しました（課金が止まっていない可能性）',
        detail: `user=${user.email}\n${details}`,
        dedupKey: `cancel-failure:${user.id}:${digest}`,
      })
    } catch {
      console.error('[Cancel] failure notification fallback failed:', eventId)
    }
    return
  }
  try {
    await deliverStripeWebhookNotification(eventId)
  } catch (error) {
    // 登録済みならCronが再送する。ここで直接送ると二重通知になり得る。
    console.error('[Cancel] failure notification delivery deferred:')
  }
}
