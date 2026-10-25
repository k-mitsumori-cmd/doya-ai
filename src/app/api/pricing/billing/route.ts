// ============================================
// 請求のまとめ（次回の請求・請求の履歴・支払いの状態）/api/pricing/billing
// ============================================
// ⚠️ 旗 NEW_PRICING_ROLLOUT の内側。off なら 404。読むだけ（Stripe も DB も書かない）。
// ⚠️ 見られるのは本人の契約だけ。契約はメール横断で探し（INV-6）、本人の契約か確かめる（findActiveLikeSubscriptions）。
// ⚠️ 請求の履歴は、本人の契約に結びついた請求書だけを返す（同じ Stripe の顧客に別アプリの請求があっても出さない）。
// 領収書は Stripe の請求書の画面（hosted_invoice_url）と PDF（invoice_pdf）。支払い方法・宛名の変更はカスタマーポータル。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, findActiveLikeSubscriptions } from '@/lib/stripe'
import { isPaidPlan } from '@/lib/unified-plan'
import { isNewPricingEnabledFor } from '@/lib/pricing-v2/rollout'
import { subscriptionAmount } from '@/lib/pricing-v2/amount'
import { billingStatusView } from '@/lib/pricing-v2/billing'

const NO_STORE = { 'Cache-Control': 'private, no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string } | undefined)?.id
    const email = session?.user?.email ?? null
    if (!userId || !email) return json({ error: 'ログインが必要です。' }, 401)
    if (!isNewPricingEnabledFor(email)) return json({ error: '見つかりません。' }, 404)
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, stripeCustomerId: true } })
    if (!user || !isPaidPlan(user.plan)) return json({ subscription: null, upcoming: null, invoices: [] })

    const live = await findActiveLikeSubscriptions({ userId, email, stripeCustomerId: user.stripeCustomerId })
    if (live.length === 0) return json({ subscription: null, upcoming: null, invoices: [] })
    const sub = await stripe.subscriptions.retrieve(live[0]!.id)
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
    const ownIds = new Set(live.map((s) => s.id))

    // 次回の請求（取れなければ null。取れないことを「請求なし」と言わない）
    let upcoming: { amount: number; at: string } | null = null
    try {
      const inv = await stripe.invoices.retrieveUpcoming({ customer: customerId, subscription: sub.id })
      upcoming = { amount: inv.amount_due, at: new Date((inv.next_payment_attempt ?? inv.period_end) * 1000).toISOString() }
    } catch {
      upcoming = null
    }

    const list = await stripe.invoices.list({ customer: customerId, limit: 24 })
    const invoices = list.data
      .filter((i) => {
        const sid = typeof i.subscription === 'string' ? i.subscription : i.subscription?.id
        return !!sid && ownIds.has(sid) && i.status !== 'draft'
      })
      .slice(0, 12)
      .map((i) => ({
        id: i.id,
        number: i.number,
        createdAt: new Date(i.created * 1000).toISOString(),
        total: i.total,
        status: i.status,
        url: i.hosted_invoice_url ?? null,
        pdf: i.invoice_pdf ?? null,
      }))

    const amount = subscriptionAmount(sub.items.data as any[])
    return json({
      subscription: {
        status: sub.status,
        view: billingStatusView({ status: String(sub.status), cancelAtPeriodEnd: sub.cancel_at_period_end }),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        interval: amount.interval,
      },
      upcoming,
      invoices,
    })
  } catch {
    console.error('[pricing/billing] could not read billing')
    return json({ error: '請求の情報を読み込めませんでした。時間をおいて再度お試しください。' }, 503)
  }
}
