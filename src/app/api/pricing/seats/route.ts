// ============================================
// チームの人数（買った人数）の確認と変更 /api/pricing/seats
// ============================================
// ⚠️ 旗 NEW_PRICING_ROLLOUT の内側。off なら 404（新しい表も Stripe も読まない）。
// ⚠️ 操作できるのは、チームの契約の持ち主（account_companies.userId）だけ。body の会社や契約の ID は受け取らない。
// ⚠️ 人数の正は Stripe の契約の数量。先に Stripe を変え、そのあと控え（account_company_billing）を書き直す。User.plan は書かない。
// 決まり（team.ts の decideSeatChange）: 増やす → その場で日割りを請求し、増えた人数の分のドヤパワーをその月に1回だけ足す。
//                                     減らす → 返金なし。使っている人数（持ち主＋招待中＋参加）より下げられない。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe } from '@/lib/stripe'
import { isNewPricingEnabledFor } from '@/lib/pricing-v2/rollout'
import { newPricingPriceIds } from '@/lib/pricing-v2/prices'
import { subscriberKind } from '@/lib/pricing-v2/view'
import { decideSeatChange } from '@/lib/pricing-v2/team'
import { teamMonthly, teamMonthlyPoints } from '@/lib/pricing-v2/plans'
import { ownerTeamContext, readOwnerTeamSubscription, saveSeatCache, teamSeatsUsed, teamTablesAllowed } from '@/lib/pricing-v2/team.server'
import { doyaPowerLedgerAllowed } from '@/lib/doya-power/flag'
import { jstMonthKey } from '@/lib/doya-power/rules'

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

    // 同じ変更を2回送っても、Stripe では1回だけ（契約・前の人数・後の人数で決まるキー）
    stage = 'stripe'
    await stripe.subscriptions.update(t.subscriptionId, {
      items: [{ id: t.seatItemId, quantity: seats }],
      proration_behavior: d.prorationBehavior,
    }, { idempotencyKey: `doya-seats:${t.subscriptionId}:${t.seats}:${seats}` })

    stage = 'after'
    await saveSeatCache(c.ctx.companyId, { ...t, seats })

    // 増えた人数の分のドヤパワーを、その月に1回だけ足す（台帳の旗が off なら足さない）
    let addedPoints = 0
    if (d.direction === 'up' && d.addPoints > 0 && doyaPowerLedgerAllowed()) {
      const { grant } = await import('@/lib/doya-power')
      const r = await grant(c.ctx.companyId, 'monthly', d.addPoints, null, {
        sourceKey: `seat-add:${t.subscriptionId}:${jstMonthKey(new Date())}:${t.seats}-${seats}`,
        note: 'seat-add',
      })
      if (r.ok) addedPoints = r.granted
    }
    return json({ ok: true, seats, used, monthly: teamMonthly(seats), points: teamMonthlyPoints(seats), addedPoints })
  } catch {
    console.error(`[pricing/seats] seat change failed at ${stage}`)
    // Stripe を変えたかどうか分からないときは、もう一度押さず確かめるよう伝える（同じ変更はキーで1回にまとまる）
    const msg = stage === 'check'
      ? '人数を確認できませんでした。時間をおいて再度お試しください。'
      : '人数を変えられたか確認できませんでした。画面を読み込み直して、今の人数をご確認ください。'
    return json({ error: msg }, stage === 'check' ? 503 : 502)
  }
}
