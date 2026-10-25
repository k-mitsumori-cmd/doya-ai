// ============================================
// チームの人数（買った人数）の確認と変更 /api/pricing/seats
// ============================================
// ⚠️ 旗 NEW_PRICING_ROLLOUT の内側。off なら 404（新しい表も Stripe も読まない）。
// ⚠️ 操作できるのは、チームの契約の持ち主（account_companies.userId）だけ。body の会社や契約の ID は受け取らない。
// ⚠️ 人数の正は Stripe の契約の数量。先に Stripe を変え、そのあと控え（account_company_billing）を書き直す。User.plan は書かない。
// 決まり（team.ts の decideSeatChange）: 増やす → その場で日割りを請求する。支払いが済まなければ人数を変えない（error_if_incomplete）。
//                                       増えた席の分のドヤパワーは、席の番号ごとに月1回・今月の残りの割合で足す（seatAddGrants）。
//                                     減らす → 返金なし。使っている人数（持ち主＋招待中＋参加）より下げられない。
// ⚠️ 冪等キーには、クライアントが確かめの画面ごとに作る操作 ID（operationKey）を入れる。
//    同じ人数の変更をあとで繰り返したとき、前の結果が返って何も変わらない、を防ぐ。
// ⚠️ Stripe から返った契約の数量が、求めた人数と同じときだけ控えを書き、ドヤパワーを足す。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe } from '@/lib/stripe'
import { isNewPricingEnabledFor } from '@/lib/pricing-v2/rollout'
import { newPricingPriceIds, teamPriceConfig } from '@/lib/pricing-v2/prices'
import { subscriberKind } from '@/lib/pricing-v2/view'
import { decideSeatChange, findSeatItem, isValidOperationKey, seatAddGrants } from '@/lib/pricing-v2/team'
import { teamMonthly, teamMonthlyPoints } from '@/lib/pricing-v2/plans'
import { ownerTeamContext, readOwnerTeamSubscription, saveSeatCache, teamSeatsUsed, teamTablesAllowed } from '@/lib/pricing-v2/team.server'
import { doyaPowerLedgerAllowed } from '@/lib/doya-power/flag'
import { jstMonthKey } from '@/lib/doya-power/rules'
import { sendEventNotification } from '@/lib/notifications'

const NO_STORE = { 'Cache-Control': 'private, no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

async function context() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  const email = session?.user?.email ?? null
  if (!userId || !email) return { error: json({ error: 'ログインが必要です。' }, 401) }
  if (!isNewPricingEnabledFor(email) || !teamTablesAllowed()) return { error: json({ error: '見つかりません。' }, 404) }
  const ctx = await ownerTeamContext(userId)
  if (!ctx) return { error: json({ code: 'OWNER_REQUIRED', error: '人数を変えられるのは、会社の持ち主の方だけです。' }, 403) }
  const kind = subscriberKind({ plan: ctx.owner.plan, stripePriceId: ctx.owner.stripePriceId, newPriceIds: newPricingPriceIds() })
  if (kind !== 'team') return { error: json({ code: 'NOT_TEAM', error: 'チームプランのご契約がありません。' }, 409) }
  return { ctx }
}

export async function GET() {
  try {
    const c = await context()
    if ('error' in c) return c.error
    const t = await readOwnerTeamSubscription(c.ctx)
    if (!t) return json({ code: 'NO_TEAM_SUBSCRIPTION', error: 'チームプランのご契約を確認できませんでした。' }, 409)
    await saveSeatCache(c.ctx.companyId, t)
    const used = await teamSeatsUsed(c.ctx.companyId)
    return json({ seats: t.seats, used, interval: t.interval, monthly: teamMonthly(t.seats), points: teamMonthlyPoints(t.seats) })
  } catch {
    console.error('[pricing/seats] could not read seats')
    return json({ error: '人数を確認できませんでした。時間をおいて再度お試しください。' }, 503)
  }
}

export async function POST(req: NextRequest) {
  let stage: 'check' | 'stripe' | 'after' = 'check'
  try {
    const c = await context()
    if ('error' in c) return c.error
    const body = await req.json().catch(() => null)
    const requested = body?.seats
    const operationKey = body?.operationKey
    if (!isValidOperationKey(operationKey)) return json({ code: 'INVALID_OPERATION', error: '画面を読み込み直して、もう一度お試しください。' }, 400)
    const t = await readOwnerTeamSubscription(c.ctx)
    if (!t) return json({ code: 'NO_TEAM_SUBSCRIPTION', error: 'チームプランのご契約を確認できませんでした。' }, 409)
    const used = await teamSeatsUsed(c.ctx.companyId)
    const d = decideSeatChange({ current: t.seats, requested, used })
    if (!d.ok) {
      const messages: Record<typeof d.code, string> = {
        INVALID_SEATS: '人数を選び直してください。',
        ENTERPRISE_QUOTE: '50人以上は個別にお見積りします。お問い合わせください。',
        BELOW_USED: `今使っている人数（${used}人）より少なくはできません。先にメンバーを外してください。`,
        NO_CHANGE: '今と同じ人数です。',
      }
      return json({ code: d.code, error: messages[d.code], used }, d.status)
    }
    const seats = requested as number
    // 無料の期間のあいだは人数を変えない（請求が0円のまま席とドヤパワーだけが増えるため。統括の点検 B1）
    if (t.status === 'trialing') return json({ code: 'TRIALING', error: '無料の期間のあいだは、人数を変えられません。期間が終わってからお手続きください。' }, 409)
    // 増やすときは、先にこの月の毎月の付与を、今の人数で済ませる（あとで増えた人数で毎月の分が付き、席の分と二重になるのを防ぐ。B2）
    if (d.direction === 'up' && doyaPowerLedgerAllowed()) {
      const { grantMonthlyForPlan } = await import('@/lib/doya-power')
      // 失敗したら人数の変更に進まない（例外は下の catch で 503。付けられなかった結果も止める。統括の点検 軽）
      const m = await grantMonthlyForPlan(c.ctx.companyId, c.ctx.owner.plan)
      if (!m.ok) {
        console.error(`[pricing/seats] monthly grant before the seat change failed: ${m.reason}`)
        return json({ code: 'MONTHLY_GRANT_FAILED', error: '人数を変える準備ができませんでした。時間をおいて再度お試しください。人数は変わっていません。' }, 503)
      }
    }

    // 同じ操作（確かめの画面の1回）を2回送っても、Stripe では1回だけ
    stage = 'stripe'
    const updated = await stripe.subscriptions.update(t.subscriptionId, {
      items: [{ id: t.seatItemId, quantity: seats }],
      proration_behavior: d.prorationBehavior,
      // 増やすときの日割りの支払いが済まなければ、Stripe は人数を変えずに失敗を返す（払わずに席を増やせない）
      ...(d.direction === 'up' ? { payment_behavior: 'error_if_incomplete' as const } : {}),
    }, { idempotencyKey: `doya-seats:${t.subscriptionId}:${t.seats}:${seats}:${operationKey}` })

    stage = 'after'
    const c2 = teamPriceConfig()
    const seatItem = c2.ok ? findSeatItem(updated.items.data as any[], new Set([c2.seat.monthly, c2.seat.yearly])) : null
    if (!seatItem || seatItem.quantity !== seats) {
      // 求めた人数になっていない（前の操作の結果が返った、など）。今の Stripe の人数で控えを書き直し、ドヤパワーは足さない
      const now = await readOwnerTeamSubscription(c.ctx)
      await saveSeatCache(c.ctx.companyId, now)
      return json({ code: 'SEATS_NOT_CHANGED', error: '人数を変えられませんでした。画面を読み込み直して、今の人数をご確認ください。', seats: now?.seats ?? null }, 409)
    }
    await saveSeatCache(c.ctx.companyId, { ...t, seats })

    // 増えた席の分のドヤパワー（席の番号ごとに月1回・今月の残りの割合。台帳の旗が off なら足さない）
    let addedPoints = 0
    if (d.direction === 'up' && doyaPowerLedgerAllowed()) {
      const { grant } = await import('@/lib/doya-power')
      const nowDate = new Date()
      for (const g of seatAddGrants({ subscriptionId: t.subscriptionId, monthKey: jstMonthKey(nowDate), addedSeats: d.addedSeats, now: nowDate })) {
        const r = await grant(c.ctx.companyId, 'monthly', g.amount, null, { sourceKey: g.sourceKey, note: 'seat-add' })
        if (r.ok && !r.duplicated) addedPoints += r.granted
      }
    }
    // 運営への知らせ（人数を増やしたときだけ。日割りの請求が済んでいる）。メールは伏せ字で出る（notifications.ts）
    if (d.direction === 'up') {
      void sendEventNotification({ type: 'payment', userId: c.ctx.owner.id, userEmail: c.ctx.owner.email, details: `チームの人数を ${t.seats}人 から ${seats}人 に増やしました（日割りを請求済み）` })
    }
    return json({ ok: true, seats, used, monthly: teamMonthly(seats), points: teamMonthlyPoints(seats), addedPoints })
  } catch (e) {
    // 支払いの失敗（カードの拒否など）は、Stripe が人数を変えずに返す
    if (stage === 'stripe' && (e as { type?: string })?.type === 'StripeCardError') {
      return json({ code: 'PAYMENT_FAILED', error: 'お支払いができなかったため、人数は変えていません。お支払い方法を確かめてください。' }, 402)
    }
    console.error(`[pricing/seats] seat change failed at ${stage}`)
    // Stripe を変えたかどうか分からないときは、もう一度押さず確かめるよう伝える（同じ変更はキーで1回にまとまる）
    const msg = stage === 'check'
      ? '人数を確認できませんでした。時間をおいて再度お試しください。'
      : '人数を変えられたか確認できませんでした。画面を読み込み直して、今の人数をご確認ください。'
    return json({ error: msg }, stage === 'check' ? 503 : 502)
  }
}
