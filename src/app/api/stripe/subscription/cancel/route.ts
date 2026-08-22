import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe, findActiveLikeSubscriptions, ACTIVE_LIKE_STATUSES } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { notifyAlert } from '@/lib/alert'

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
      email: user.email,
      stripeCustomerId: user.stripeCustomerId,
    })

    // メール横断で見つからないときだけ、DB に残っている ID を最後の頼みにする
    if (live.length === 0) {
      const dbId = user.serviceSubscriptions?.[0]?.stripeSubscriptionId || user.stripeSubscriptionId
      if (dbId) {
        try {
          const s = await stripe.subscriptions.retrieve(dbId)
          if (ACTIVE_LIKE_STATUSES.has(String(s.status))) {
            live = [
              {
                id: s.id,
                status: String(s.status),
                customerId: typeof s.customer === 'string' ? s.customer : String((s.customer as any)?.id || ''),
                priceId: s.items.data[0]?.price.id || null,
                planId: String(s.metadata?.planId || ''),
              },
            ]
          }
        } catch (e: any) {
          console.error('[Cancel] DBのsubscriptionIdがStripeに存在しない:', dbId, e?.message)
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
        console.error(`[Cancel] 解約に失敗: sub=${s.id}`, e?.message)
        results.push({ subscriptionId: s.id, error: e?.message || 'failed' })
      }
    }

    const succeeded = results.filter((r): r is CancelOk => !('error' in r))
    if (succeeded.length === 0) {
      return NextResponse.json(
        { error: '解約処理に失敗しました。お手数ですがお問い合わせください。', results },
        { status: 500 }
      )
    }

    // DBも更新しておく（顧客が分裂していた場合は、実在する顧客IDへ寄せる）
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeSubscriptionId: succeeded[0]!.subscriptionId,
          ...(live[0]?.customerId ? { stripeCustomerId: live[0].customerId } : {}),
        },
      })
    } catch {}

    // 一部でも失敗が残っていたら運営が気づけるようにする（課金が止まっていない可能性）
    if (succeeded.length < results.length) {
      notifyAlert({
        level: 'critical',
        title: '解約処理の一部が失敗しました（課金が止まっていない可能性）',
        detail: `user=${user.email}\n${JSON.stringify(results)}`,
        dedupKey: `cancel-partial-failure:${user.id}`,
      }).catch(() => {})
    }

    const primary = succeeded[0]!
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
    console.error('Subscription cancel error:', e)
    return NextResponse.json(
      { error: e?.message || 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}


