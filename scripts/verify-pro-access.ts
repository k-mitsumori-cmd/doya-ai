// ============================================
// プロ契約者が全サービスでプロ権限になっているかの検証（読み取り専用）
// ============================================
// 「お金を払っている人が、どのサービスでもプロとして使えるか」を
// **各サービスが実際に使っている判定関数を呼んで**確認する。
// 判定を写経すると本体だけ直って検証が古いまま通るため、必ず import する。
//
// 実行: npx tsx scripts/verify-pro-access.ts
//
// 背景（2026-08）:
//   統一プランは「1契約で全サービスのプロ機能」が約束。ところが判定の入口が
//   サービスごとにバラバラで、UserServiceSubscription の行が1つ欠けただけで
//   そのサービスだけ無料に落ちる状態だった。約束が守られているかを機械で確かめる。
import { loadEnv } from './_env'
loadEnv()

import { prisma } from '../src/lib/prisma'
import { stripe, ACTIVE_LIKE_STATUSES } from '../src/lib/stripe'
import { isPaidPlan } from '../src/lib/unified-plan'
import { higherPlan, tierFrom, isPaidTier } from '../src/lib/plan-utils'
import { isUserPro } from '../src/lib/plan-limit'
import { normalizeSeoPlan } from '../src/lib/seoAccess'
import { normalizePlan as normalizeInterviewPlan } from '../src/lib/interview/access'
import {
  getBannerMonthlyLimitByUserPlan,
  BANNER_PRICING,
  getPersonaDailyLimitByUserPlan,
  getShindanDailyLimitByUserPlan,
} from '../src/lib/pricing'
import * as doyaslide from '../src/lib/doyaslide/limits'
import * as cunning from '../src/lib/cunning/limits'
import * as promane from '../src/lib/promane/limits'
import * as doyalist from '../src/lib/doyalist/limits'
import { DAILY_CONCEPT_LIMIT } from '../src/lib/adimage/access'
import { DAILY_LIMIT as ADBANNER_DAILY_LIMIT } from '../src/lib/adbanner/access'
import { getOrgPlan, getOrgPlanLimits } from '../src/lib/hr/billing'

let ng = 0
const ok = (s: string) => console.log(`    OK   ${s}`)
const bad = (s: string) => {
  ng++
  console.log(`    NG   ${s}`)
}
const check = (cond: boolean, s: string) => (cond ? ok(s) : bad(s))

async function main() {
  // Stripe で課金中の方を対象にする（DBだけ見ると手動付与が混ざる）
  const all: any[] = []
  let after: string | undefined
  for (let p = 0; p < 20; p++) {
    const r: any = await stripe.subscriptions.list({
      status: 'all',
      limit: 100,
      expand: ['data.customer'],
      ...(after ? { starting_after: after } : {}),
    })
    all.push(...r.data)
    if (!r.has_more || !r.data.length) break
    after = r.data[r.data.length - 1].id
  }
  const emails = Array.from(
    new Set(
      all
        .filter((s) => ACTIVE_LIKE_STATUSES.has(String(s.status)))
        .map((s) => String((typeof s.customer === 'object' ? s.customer?.email : '') || '').toLowerCase())
        .filter(Boolean)
    )
  )

  console.log(`課金中のアカウント: ${emails.length}名\n`)

  for (const email of emails) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, plan: true, serviceSubscriptions: { select: { serviceId: true, plan: true } } },
    })
    console.log(`■ ${email}（User.plan=${user?.plan}）`)
    if (!user) {
      bad('DBにユーザーが存在しない')
      continue
    }
    const rows = new Map(user.serviceSubscriptions.map((r) => [r.serviceId, r.plan]))
    const uid = user.id

    // --- 統一プランの単一判定 ---
    check(isPaidPlan(user.plan), `統一判定 isPaidPlan(${user.plan})`)
    check(isPaidTier(tierFrom(user.plan)), `階層 tierFrom(${user.plan}) = ${tierFrom(user.plan)}`)

    // --- 組織スコープ系（見積 / AI商談 / 面接 / SFA / 商談準備 / AIO はここを通る）---
    check(await isUserPro(uid), 'plan-limit.isUserPro（見積・AI商談・面接などの無料枠判定）')

    // --- サービス個別の判定関数を実際に呼ぶ ---
    const dsTier = await doyaslide.getUserTier(uid)
    check(isPaidTier(dsTier), `ドヤスライド getUserTier = ${dsTier}`)

    const cuTier = await cunning.getUserTier(uid)
    check(isPaidTier(cuTier), `ドヤカンニング getUserTier = ${cuTier}`)

    const pmTier = await promane.getUserPromaneTier(uid)
    check(isPaidTier(pmTier), `ドヤプロマネ getUserPromaneTier = ${pmTier}`)

    const dlTier = await doyalist.getUserTier(uid)
    check(isPaidTier(dlTier), `ドヤリスト getUserTier = ${dlTier}`)

    // --- セッション由来の派生プラン（消費側は `x || plan` で読む）---
    const seoPlan = normalizeSeoPlan(higherPlan(user.plan, rows.get('writing') || rows.get('seo')))
    check(seoPlan === 'PRO' || seoPlan === 'ENTERPRISE', `ドヤSEO normalizeSeoPlan = ${seoPlan}`)

    const ivPlan = normalizeInterviewPlan(higherPlan(user.plan, rows.get('interview')))
    check(String(ivPlan) !== 'FREE' && String(ivPlan) !== 'GUEST', `ドヤインタビュー normalizePlan = ${ivPlan}`)

    // --- 上限テーブル系 ---
    const bannerLimit = getBannerMonthlyLimitByUserPlan(rows.get('banner') || user.plan)
    check(
      bannerLimit === BANNER_PRICING.proLimit || bannerLimit === -1,
      `ドヤバナー 月間上限 = ${bannerLimit === -1 ? '無制限' : bannerLimit + '枚'}（無料枠 ${BANNER_PRICING.freeLimit}枚）`
    )
    const personaLimit = getPersonaDailyLimitByUserPlan(user.plan)
    check(personaLimit === -1 || personaLimit > 5, `ドヤペルソナ 1日上限 = ${personaLimit === -1 ? '無制限' : personaLimit}`)
    const shindanLimit = getShindanDailyLimitByUserPlan(user.plan)
    check(shindanLimit === -1 || shindanLimit > 5, `ドヤ診断 1日上限 = ${shindanLimit === -1 ? '無制限' : shindanLimit}`)

    // --- Cookie/識別子スコープ系（ログイン済みなら User.plan で PRO 判定になる）---
    const adimagePro = isPaidPlan(user.plan) ? DAILY_CONCEPT_LIMIT.PRO : DAILY_CONCEPT_LIMIT.FREE
    check(adimagePro === DAILY_CONCEPT_LIMIT.PRO, `ドヤ広告画像 1日上限 = ${adimagePro}（無料枠 ${DAILY_CONCEPT_LIMIT.FREE}）`)
    const adbannerPro = isPaidPlan(user.plan) ? ADBANNER_DAILY_LIMIT.PRO : ADBANNER_DAILY_LIMIT.FREE
    check(adbannerPro === ADBANNER_DAILY_LIMIT.PRO, `ドヤ広告バナー 1日上限 = ${adbannerPro}（無料枠 ${ADBANNER_DAILY_LIMIT.FREE}）`)

    // --- 組織単位のプラン（ドヤHR）---
    const owned = await prisma.hrOrganizationMember.findMany({
      where: { userId: uid, role: 'OWNER', status: 'ACTIVE' },
      select: { organizationId: true },
    })
    if (owned.length === 0) {
      console.log('    --   ドヤHR: オーナーの組織なし（判定対象外）')
    } else {
      for (const o of owned) {
        const plan = await getOrgPlan(o.organizationId)
        const lim = getOrgPlanLimits(plan)
        check(isPaidPlan(plan), `ドヤHR 組織プラン = ${plan}（従業員上限 ${lim.maxEmployees === -1 ? '無制限' : lim.maxEmployees}）`)
      }
    }
    console.log('')
  }

  console.log('===========================================')
  console.log(ng === 0 ? ' 結果: 全サービスでプロ権限が有効' : ` 結果: NG ${ng}件`)
  console.log('===========================================')
  await prisma.$disconnect()
  process.exit(ng === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
