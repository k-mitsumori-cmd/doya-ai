// ============================================
// 課金の実地検証（読み取り専用）
// ============================================
// 「お金を払っている人が、本当にプロとして使えるか」を
// **アプリ本体と同じ関数を呼んで**確認する。判定ロジックを写経すると
// 本体だけ直って検証が古いまま通る、という事故が起きるため必ず import する。
//
// 実行: npx tsx scripts/verify-billing.ts
//
// 検証する3つのこと（reference/11-billing-spec.md）
//   A. 権利  … Stripeで課金中の人が全経路でPRO判定になるか
//   B. 請求  … 金額・状態・次回請求日が正しいか。取りこぼし/未入金が無いか
//   C. 安全網 … Webhook・監査・二重契約ガードが実際に効く状態にあるか
import { loadEnv } from './_env'
loadEnv()

import { prisma } from '../src/lib/prisma'
import {
  stripe,
  ALL_SERVICE_IDS,
  ACTIVE_LIKE_STATUSES,
  findActiveLikeSubscriptions,
  resolvePlanIdFromSubscription,
  planTierFromPlanId,
} from '../src/lib/stripe'
import { isPaidPlan, UNIFIED_PRO_PRICE } from '../src/lib/unified-plan'
import { tierFrom, higherPlan, isPaidTier } from '../src/lib/plan-utils'
import { getBannerMonthlyLimitByUserPlan, BANNER_PRICING } from '../src/lib/pricing'
import { checkWebhookEndpoint } from '../src/lib/billing-audit'
import { getManualGrantEmails } from '../src/lib/billing-manual-grants'

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`
const jst = (d: Date | null) => (d ? d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '—')

let ng = 0
const ok = (label: string) => console.log(`  OK   ${label}`)
const bad = (label: string) => {
  ng++
  console.log(`  NG   ${label}`)
}
const check = (cond: boolean, label: string) => (cond ? ok(label) : bad(label))

async function main() {
  // ---- Stripe の生存契約を取得 ----
  const all: any[] = []
  let startingAfter: string | undefined
  for (let p = 0; p < 20; p++) {
    const r: any = await stripe.subscriptions.list({
      status: 'all',
      limit: 100,
      expand: ['data.customer'],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    all.push(...r.data)
    if (!r.has_more || !r.data.length) break
    startingAfter = r.data[r.data.length - 1].id
  }
  const live = all.filter((s) => ACTIVE_LIKE_STATUSES.has(String(s.status)))

  console.log('===========================================')
  console.log(` A. 権利の検証（課金中の方がPROとして使えるか）`)
  console.log('===========================================')

  for (const s of live) {
    const cust = typeof s.customer === 'object' ? s.customer : null
    const email = String(cust?.email || '').toLowerCase()
    console.log(`\n■ ${email || '(メール不明)'}  [${s.status}]`)

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: {
        id: true,
        plan: true,
        serviceSubscriptions: { select: { serviceId: true, plan: true } },
      },
    })
    if (!user) {
      bad('DBにユーザーが存在しない')
      continue
    }

    const rows = new Map(user.serviceSubscriptions.map((r) => [r.serviceId, r.plan]))

    // 1) 統一プランの単一判定
    check(isPaidPlan(user.plan), `isPaidPlan(User.plan=${user.plan}) → 有料`)
    check(isPaidTier(tierFrom(user.plan)), `tierFrom(${user.plan}) = ${tierFrom(user.plan)} → 有料階層`)

    // 2) サービス別の行が全部そろっているか
    const missing = ALL_SERVICE_IDS.filter((id) => !rows.has(id))
    check(missing.length === 0, `サービス行 ${ALL_SERVICE_IDS.length}件がそろっている${missing.length ? `（不足: ${missing.join(', ')}）` : ''}`)
    const notPaid = ALL_SERVICE_IDS.filter((id) => rows.has(id) && !isPaidPlan(rows.get(id)))
    check(notPaid.length === 0, `サービス行が全て有料${notPaid.length ? `（無料のまま: ${notPaid.join(', ')}）` : ''}`)

    // 3) セッションに載る派生プラン（消費側は `x || plan` で読むため 'FREE' が混ざると権利が消える）
    const derived: Record<string, string> = {
      bannerPlan: higherPlan(user.plan, rows.get('banner')),
      seoPlan: higherPlan(user.plan, rows.get('writing') || rows.get('seo')),
      kantanPlan: higherPlan(user.plan, rows.get('kantan')),
      interviewPlan: higherPlan(user.plan, rows.get('interview')),
      openingPlan: higherPlan(user.plan, rows.get('opening')),
      doyalistPlan: higherPlan(user.plan, rows.get('doyalist')),
      kintaiPlan: higherPlan(user.plan, rows.get('kintai')),
    }
    const freeDerived = Object.entries(derived).filter(([, v]) => !isPaidPlan(v))
    check(freeDerived.length === 0, `セッションの派生プランが全て有料（${Object.entries(derived).map(([k, v]) => `${k}=${v}`).join(' / ')}）`)

    // 4) 実際の上限値（バナー）が有料枠になっているか
    const limit = getBannerMonthlyLimitByUserPlan(rows.get('banner') || user.plan)
    check(
      limit === BANNER_PRICING.proLimit || limit === -1,
      `バナー月間上限 = ${limit === -1 ? '無制限' : limit + '枚'}（無料枠は ${BANNER_PRICING.freeLimit}枚 / プロ枠は ${BANNER_PRICING.proLimit}枚）`
    )
  }

  console.log('\n===========================================')
  console.log(' B. 請求の検証（正しく請求できているか）')
  console.log('===========================================')

  let mrr = 0
  for (const s of live) {
    const cust = typeof s.customer === 'object' ? s.customer : null
    const email = String(cust?.email || '').toLowerCase()
    const amount = s.items?.data?.[0]?.price?.unit_amount ?? 0
    const { planId } = resolvePlanIdFromSubscription(s)
    const tier = planTierFromPlanId(planId)
    console.log(`\n■ ${email} [${s.status}]`)

    check(amount === UNIFIED_PRO_PRICE, `契約金額 ${yen(amount)} = 統一プロ価格 ${yen(UNIFIED_PRO_PRICE)}`)
    check(tier === 'PRO', `価格から解決した階層 = ${tier}`)
    check(String(s.status) !== 'past_due', `支払い遅延ではない（status=${s.status}）`)

    const invoices = await stripe.invoices.list({ subscription: s.id, limit: 20 })
    const paid = invoices.data.filter((i) => i.status === 'paid' && (i.amount_paid || 0) > 0)
    const open = invoices.data.filter((i) => i.status === 'open')
    const refunded = invoices.data.filter((i) => (i.post_payment_credit_notes_amount || 0) > 0)
    console.log(
      `       請求実績: 支払済 ${paid.length}件（${paid.map((i) => yen(i.amount_paid)).join(', ') || 'なし'}）` +
        ` / 未払い ${open.length}件 / 返金あり ${refunded.length}件`
    )
    check(open.length === 0, '未払いの請求が無い')

    if (s.status === 'trialing') {
      console.log(`       トライアル中: ${jst(new Date(s.trial_end * 1000))} まで無料 → 初回請求 ${jst(new Date(s.current_period_end * 1000))}`)
      check(paid.length === 0, 'トライアル中なので課金されていない（正しい）')
    } else {
      console.log(`       次回請求: ${jst(new Date(s.current_period_end * 1000))}`)
      check(paid.length > 0, '実際に入金されている')
      mrr += amount
    }
    if (s.cancel_at_period_end) console.log('       解約予約あり（期間末で停止）')
  }
  console.log(`\n  月次売上見込（トライアル除く）: ${yen(mrr)}`)

  // 取りこぼし: DBが有料なのにStripeに契約が無い
  const manual = await getManualGrantEmails()
  const liveEmails = new Set(
    live.map((s) => String((typeof s.customer === 'object' ? s.customer?.email : '') || '').toLowerCase())
  )
  const paidInDb = await prisma.user.findMany({
    where: { plan: { notIn: ['FREE', 'GUEST'] } },
    select: { email: true, plan: true },
  })
  const ghosts = paidInDb.filter(
    (u) => !liveEmails.has(String(u.email).toLowerCase()) && !manual.has(String(u.email).toLowerCase())
  )
  console.log('')
  check(ghosts.length === 0, `課金されていないのに有料プランの方が居ない${ghosts.length ? `（${ghosts.map((g) => g.email).join(', ')}）` : ''}`)
  console.log(`       ※ 手動付与として除外中: ${[...manual].join(', ') || 'なし'}`)

  console.log('\n===========================================')
  console.log(' C. 安全網の検証（同じ事故が再発しないか）')
  console.log('===========================================\n')

  const wh = await checkWebhookEndpoint()
  check(wh.ok, `Stripe Webhook が登録・有効・必要イベント購読済み（${wh.detail}）`)

  // 二重契約ガード: 契約中の人がもう一度申し込もうとしたら checkout が 409 を返せるか
  for (const s of live.slice(0, 5)) {
    const cust = typeof s.customer === 'object' ? s.customer : null
    const email = String(cust?.email || '')
    const found = await findActiveLikeSubscriptions({ email, stripeCustomerId: null })
    check(found.length > 0, `二重契約ガードが効く: ${email} の生存契約を ${found.length}件 検出（checkoutは409で決済を止める）`)
  }

  // 契約が1本だけか（二重契約が残っていないか）
  const byEmail = new Map<string, number>()
  for (const s of live) {
    const e = String((typeof s.customer === 'object' ? s.customer?.email : '') || '').toLowerCase()
    byEmail.set(e, (byEmail.get(e) || 0) + 1)
  }
  const dup = [...byEmail.entries()].filter(([, n]) => n > 1)
  check(dup.length === 0, `二重契約が残っていない${dup.length ? `（${dup.map(([e, n]) => `${e}:${n}本`).join(', ')}）` : ''}`)

  console.log('\n===========================================')
  console.log(ng === 0 ? ' 結果: 全項目 OK' : ` 結果: NG ${ng}件`)
  console.log('===========================================')
  await prisma.$disconnect()
  process.exit(ng === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
