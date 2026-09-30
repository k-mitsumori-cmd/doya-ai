/**
 * 課金監査（Stripe を正として毎日突き合わせる）
 *
 * なぜ必要か（2026-08 障害）:
 *   Stripe Webhook のエンドポイントが本番から消えていたため、
 *   - 有料契約が DB に反映されず（お客様は課金されたまま無料プラン扱い）
 *   - 課金の Slack 通知も飛ばなかった（通知は Webhook ハンドラ内でしか呼ばれていない）
 *   という二重の無音障害が、少なくとも 2 名・約 2 か月にわたり気づかれなかった。
 *
 * 対策の考え方: **通知を Webhook に依存させない**。
 *   この監査は Stripe API を直接叩いて「契約の実態」を毎日読み、
 *   DB との差分・二重契約・Webhook エンドポイントの存在まで点検して Slack に出す。
 *   Webhook が死んでも、この経路は生き続ける。
 */
import {
  stripe,
  resolvePlanIdFromSubscription,
  isDoyaSubscription,
  planTierFromPlanId,
  ALL_SERVICE_IDS,
  ACTIVE_LIKE_STATUSES,
} from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { getManualGrantEmails } from '@/lib/billing-manual-grants'

export const BILLING_WEBHOOK_EXPECTED_URL =
  process.env.STRIPE_WEBHOOK_EXPECTED_URL || 'https://doya-ai.surisuta.jp/api/stripe/webhook'


export type AuditSubscription = {
  id: string
  /** Stripe 契約に記録された所有者。DB に存在しなくても保持して異常を検知する。 */
  declaredUserId: string | null
  userId: string | null
  status: string
  customerId: string
  email: string | null
  name: string | null
  planId: string
  tier: string
  amount: number
  monthlyAmount: number
  billingInterval: 'month' | 'year' | 'other'
  currency: string
  createdAt: Date
  trialEnd: Date | null
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  dbPlan: string | null
  dbUserFound: boolean
}

export type BillingAudit = {
  subscriptions: AuditSubscription[]
  newInWindow: AuditSubscription[]
  canceledInWindow: Array<{ id: string; email: string | null; endedAt: Date | null }>
  mismatched: AuditSubscription[]
  /** 有効なStripe契約の最上位階層とUser.planの不一致。手動の上位付与は除外する。 */
  tierDrift: Array<{ userId: string; email: string | null; stripeTier: string; dbPlan: string; subscriptionIds: string[] }>
  unmappedPlans: AuditSubscription[]
  /** User.plan は有料なのにサービス別の行が揃っていない（INV-2 違反）。障害#5 の再発検知 */
  serviceDrift: Array<{ email: string | null; userPlan: string; expected: string; broken: string[] }>
  /** Stripe に生きた契約が無いのに DB が有料のまま（＝過剰付与・解約の反映漏れ） */
  overGranted: Array<{ email: string | null; plan: string }>
  duplicates: Array<{ email: string; subs: AuditSubscription[] }>
  unknownBillingIntervals: AuditSubscription[]
  webhookOk: boolean
  webhookDetail: string
  mrr: number
}

const PLAN_RANK: Record<string, number> = { FREE: 0, GUEST: 0, LIGHT: 1, PRO: 2, BUNDLE: 3, ENTERPRISE: 4 }

function jstDate(d: Date): string {
  return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' })
}

function jstDateTime(d: Date): string {
  return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
}

/** Stripe の全サブスクリプションをページングして取得 */
async function listAllSubscriptions(): Promise<any[]> {
  const out: any[] = []
  let startingAfter: string | undefined
  const cursors = new Set<string>()
  while (true) {
    const res: any = await stripe.subscriptions.list({
      status: 'all',
      limit: 100,
      expand: ['data.customer'],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    out.push(...res.data)
    if (!res.has_more) break
    const next = res.data[res.data.length - 1]?.id
    if (!next || cursors.has(next)) throw new Error('Billing audit subscription pagination did not advance')
    cursors.add(next)
    startingAfter = next
  }
  return out
}

/** 本番の Webhook エンドポイントが登録され有効かを確認する */
export async function checkWebhookEndpoint(): Promise<{ ok: boolean; detail: string }> {
  try {
    const endpoints: Array<{ id: string; url: string; status: string; enabled_events: string[] }> = []
    let cursor: string | undefined
    const cursors = new Set<string>()
    while (true) {
      const res = await stripe.webhookEndpoints.list({ limit: 100, ...(cursor ? { starting_after: cursor } : {}) })
      endpoints.push(...res.data)
      if (!res.has_more) break
      const next = res.data[res.data.length - 1]?.id
      if (!next || cursors.has(next)) throw new Error('Webhook endpoint pagination did not advance')
      cursors.add(next)
      cursor = next
    }
    const target = endpoints.find((e) => String(e.url) === BILLING_WEBHOOK_EXPECTED_URL)
    if (!target) {
      return {
        ok: false,
        detail:
          `本番の Stripe Webhook エンドポイント（${BILLING_WEBHOOK_EXPECTED_URL}）が Stripe に登録されていません。` +
          `現在登録されているURL: ${endpoints.map((e) => e.url).join(' / ') || '（0件）'}`,
      }
    }
    if (String(target.status) !== 'enabled') {
      return { ok: false, detail: `Webhook エンドポイントが ${target.status} です（id: ${target.id}）` }
    }
    const required = [
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ]
    const events = (target.enabled_events || []) as string[]
    const missing = events.includes('*') ? [] : required.filter((e) => !events.includes(e))
    if (missing.length > 0) {
      return { ok: false, detail: `Webhook が必要イベントを購読していません: ${missing.join(', ')}（id: ${target.id}）` }
    }
    return { ok: true, detail: `OK（id: ${target.id}）` }
  } catch (e: any) {
    return { ok: false, detail: `Webhook エンドポイントの確認に失敗: ${e?.message || e}` }
  }
}

/**
 * @param windowHours 「新規」とみなす直近時間（日次=24h, 週次=168h）
 */
export async function runBillingAudit(windowHours = 24): Promise<BillingAudit> {
  const since = new Date(Date.now() - windowHours * 3600_000)
  const all = await listAllSubscriptions()

  const live = all.filter((s) => ACTIVE_LIKE_STATUSES.has(String(s.status)) && isDoyaSubscription(s))

  // 新契約は metadata.userId が所有者の正本。メール変更後の顧客や同一メールの
  // 別人に契約を誤帰属させない。メール照合は userId のない旧契約だけに使う。
  const userIds = Array.from(new Set(live.map((s) => String(s.metadata?.userId || '').trim()).filter(Boolean)))
  const emails = Array.from(
    new Set(
      live
        .filter((s) => !String(s.metadata?.userId || '').trim())
        .map((s) => (typeof s.customer === 'object' ? s.customer?.email : null))
        .filter((e): e is string => Boolean(e))
        .map((e) => e.toLowerCase())
    )
  )
  const usersById = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, name: true, plan: true },
      })
    : []
  const usersByEmail = emails.length
    ? await prisma.user.findMany({
        where: { email: { in: emails, mode: 'insensitive' } },
        select: { id: true, email: true, name: true, plan: true },
      })
    : []
  const userById = new Map(usersById.map((u) => [u.id, u]))
  const userByEmail = new Map(usersByEmail.map((u) => [String(u.email).toLowerCase(), u]))
  const resolvedUserById = new Map([...usersByEmail, ...usersById].map((u) => [u.id, u]))

  const subscriptions: AuditSubscription[] = live.map((s) => {
    const cust = typeof s.customer === 'object' ? s.customer : null
    const customerEmail = (cust?.email as string | undefined)?.toLowerCase() || null
    const metadataUserId = String(s.metadata?.userId || '').trim()
    const dbUser = metadataUserId ? userById.get(metadataUserId) : customerEmail ? userByEmail.get(customerEmail) : undefined
    const email = dbUser?.email?.toLowerCase() || customerEmail
    const { planId } = resolvePlanIdFromSubscription(s)
    const price = s.items?.data?.[0]?.price
    const interval = price?.recurring?.interval
    const intervalCount = Math.max(1, Number(price?.recurring?.interval_count || 1))
    const amount = Number(price?.unit_amount || 0)
    const billingInterval: AuditSubscription['billingInterval'] = interval === 'year' ? 'year' : interval === 'month' ? 'month' : 'other'
    const monthlyAmount = billingInterval === 'year' ? amount / (12 * intervalCount) :
      billingInterval === 'month' ? amount / intervalCount : 0
    return {
      id: s.id,
      declaredUserId: metadataUserId || null,
      userId: dbUser?.id ?? null,
      status: String(s.status),
      customerId: typeof s.customer === 'string' ? s.customer : String(cust?.id || ''),
      email,
      name: dbUser?.name || (cust?.name as string | undefined) || null,
      planId,
      tier: planTierFromPlanId(planId),
      amount,
      monthlyAmount,
      billingInterval,
      currency: String(s.items?.data?.[0]?.price?.currency || 'jpy'),
      createdAt: new Date(s.created * 1000),
      trialEnd: s.trial_end ? new Date(s.trial_end * 1000) : null,
      currentPeriodEnd: new Date(s.current_period_end * 1000),
      cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
      dbPlan: dbUser?.plan ?? null,
      dbUserFound: Boolean(dbUser),
    }
  })

  const newInWindow = subscriptions.filter((s) => s.createdAt >= since)

  const canceledInWindow = all
    .filter((s) => String(s.status) === 'canceled' && isDoyaSubscription(s) && s.ended_at && new Date(s.ended_at * 1000) >= since)
    .map((s) => ({
      id: s.id,
      email: (typeof s.customer === 'object' ? (s.customer?.email as string | undefined) : null) || null,
      endedAt: s.ended_at ? new Date(s.ended_at * 1000) : null,
    }))

  const manualGrantEmails = await getManualGrantEmails()

  // 課金されているのに DB が FREE / ユーザーが見つからない＝反映漏れ
  const mismatched = subscriptions
    .filter((s) => !s.dbUserFound || s.dbPlan === 'FREE' || s.dbPlan === 'GUEST' || s.dbPlan === null)

  // User.plan が有料でも契約より下位／上位なら、全サービス行が揃っていても異常。
  // 顧客分裂による複数契約は最上位の階層を採用し、同一利用者を一度だけ報告する。
  const highestTierByUser = new Map<string, { tier: string; subs: AuditSubscription[] }>()
  for (const sub of subscriptions) {
    if (!sub.userId || !PLAN_RANK[sub.tier]) continue
    const previous = highestTierByUser.get(sub.userId)
    if (previous) {
      previous.subs.push(sub)
      if (PLAN_RANK[sub.tier] > PLAN_RANK[previous.tier]) previous.tier = sub.tier
    } else {
      highestTierByUser.set(sub.userId, { tier: sub.tier, subs: [sub] })
    }
  }
  const tierDrift: BillingAudit['tierDrift'] = []
  for (const [userId, { tier, subs }] of highestTierByUser) {
    const dbUser = resolvedUserById.get(userId)
    if (!dbUser || dbUser.plan === 'FREE' || dbUser.plan === 'GUEST' || dbUser.plan === tier) continue
    const manualGrant = manualGrantEmails.has(String(dbUser.email || '').toLowerCase())
    if (manualGrant && (PLAN_RANK[dbUser.plan] ?? -1) >= PLAN_RANK[tier]) continue
    tierDrift.push({ userId, email: dbUser.email, stripeTier: tier, dbPlan: dbUser.plan, subscriptionIds: subs.map((s) => s.id) })
  }
  const unmappedPlans = subscriptions.filter((sub) => !sub.planId)

  // 同一ユーザーの分裂Customerも二重契約として検出する。
  const byOwner = new Map<string, AuditSubscription[]>()
  for (const s of subscriptions) {
    const ownerId = s.declaredUserId || s.userId
    const owner = ownerId ? `user:${ownerId}` : s.email ? `email:${s.email}` : s.customerId ? `customer:${s.customerId}` : null
    if (!owner) continue
    byOwner.set(owner, [...(byOwner.get(owner) || []), s])
  }
  const duplicates = Array.from(byOwner.entries())
    .filter(([, subs]) => subs.length > 1)
    .map(([, subs]) => ({ email: subs[0]?.email || subs[0]?.userId || subs[0]?.customerId || '不明', subs }))

  // ------------------------------------------------------------------
  // INV-2 違反の検知（reference/11-billing-spec.md R-3）
  // ------------------------------------------------------------------
  // User.plan だけを見ていると、障害#5（UserServiceSubscription の一意制約で
  // banner 以外がプロにならない）と同じ状態が起きても監査が沈黙する。
  // 有料契約者について、全サービス行が期待どおり揃っているかを突き合わせる。
  const uniquePaidUserIds = Array.from(new Set(subscriptions.map((s) => s.userId).filter((id): id is string => Boolean(id))))

  const serviceDrift: BillingAudit['serviceDrift'] = []
  if (uniquePaidUserIds.length > 0) {
    const rows = await prisma.userServiceSubscription.findMany({
      where: { userId: { in: uniquePaidUserIds } },
      select: { userId: true, serviceId: true, plan: true },
    })
    const byUser = new Map<string, Map<string, string>>()
    for (const r of rows) {
      if (!byUser.has(r.userId)) byUser.set(r.userId, new Map())
      byUser.get(r.userId)!.set(r.serviceId, r.plan)
    }
    const checkedUsers = new Set<string>()
    for (const sub of subscriptions) {
      const dbUser = sub.userId ? resolvedUserById.get(sub.userId) : undefined
      if (!dbUser || dbUser.plan === 'FREE') continue // 反映漏れは mismatched 側で報告済み
      if (checkedUsers.has(dbUser.id)) continue
      checkedUsers.add(dbUser.id)
      const expected = dbUser.plan === 'BUNDLE' ? 'PRO' : dbUser.plan
      const rowsOfUser = byUser.get(dbUser.id) || new Map<string, string>()
      const broken = ALL_SERVICE_IDS.filter((sid) => (rowsOfUser.get(sid) ?? 'MISSING') !== expected)
      if (broken.length > 0 && !manualGrantEmails.has(String(sub.email || '').toLowerCase())) {
        serviceDrift.push({ email: sub.email, userPlan: dbUser.plan, expected, broken: [...broken] })
      }
    }
  }

  // ------------------------------------------------------------------
  // 過剰付与の検知（解約が反映されていない／手動更新の消し忘れ）
  // ------------------------------------------------------------------
  const liveUserIds = new Set(subscriptions.map((s) => s.userId).filter((id): id is string => Boolean(id)))
  const paidInDb = await prisma.user.findMany({
    where: { plan: { notIn: ['FREE', 'GUEST'] } },
    select: { id: true, email: true, plan: true },
  })
  const overGranted = paidInDb
    .filter((u) => !liveUserIds.has(u.id))
    .filter((u) => !manualGrantEmails.has(String(u.email || '').toLowerCase()))
    .map((u) => ({ email: u.email, plan: u.plan }))

  const webhook = await checkWebhookEndpoint()

  // MRR（トライアル中は未課金なので除外）
  const mrr = subscriptions
    .filter((s) => s.status === 'active' || s.status === 'past_due')
    .reduce((sum, s) => sum + s.monthlyAmount, 0)
  const unknownBillingIntervals = subscriptions.filter((s) => s.billingInterval === 'other')

  return {
    subscriptions,
    newInWindow,
    canceledInWindow,
    mismatched,
    tierDrift,
    unmappedPlans,
    serviceDrift,
    overGranted,
    duplicates,
    unknownBillingIntervals,
    webhookOk: webhook.ok,
    webhookDetail: webhook.detail,
    mrr,
  }
}

function yen(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`
}

function subLine(s: AuditSubscription): string {
  const who = s.name ? `${s.name}（${s.email || '不明'}）` : s.email || '不明'
  const trial = s.trialEnd && s.trialEnd > new Date() ? `トライアル中（${jstDate(s.trialEnd)}まで無料）` : '課金中'
  const cancel = s.cancelAtPeriodEnd ? '・解約予約あり' : ''
  const priceLabel = s.billingInterval === 'year' ? `${yen(s.amount)}/年` :
    s.billingInterval === 'month' ? `${yen(s.amount)}/月` : `${yen(s.amount)}（請求周期未確認）`
  return `・${who} ｜ ${s.tier} ｜ ${trial}${cancel} ｜ ${priceLabel} ｜ 申込 ${jstDateTime(s.createdAt)}`
}

/** 日次/週次レポートの本文を組み立てる */
export function formatBillingAuditMessage(audit: BillingAudit, opts: { windowLabel: string }): string {
  const lines: string[] = []
  const hasProblem =
    !audit.webhookOk ||
    audit.mismatched.length > 0 ||
    audit.tierDrift.length > 0 ||
    audit.unmappedPlans.length > 0 ||
    audit.duplicates.length > 0 ||
    audit.serviceDrift.length > 0 ||
    audit.overGranted.length > 0 ||
    audit.unknownBillingIntervals.length > 0

  lines.push(hasProblem ? '<!channel>' : '')
  lines.push(`:credit_card: *[課金レポート/${opts.windowLabel}]* ${jstDateTime(new Date())}`)
  lines.push('')

  lines.push(`*${opts.windowLabel}の新規有料契約: ${audit.newInWindow.length}件*`)
  if (audit.newInWindow.length === 0) {
    lines.push('・なし')
  } else {
    for (const s of audit.newInWindow) lines.push(subLine(s))
  }
  lines.push('')

  const trialing = audit.subscriptions.filter((s) => s.status === 'trialing').length
  const active = audit.subscriptions.filter((s) => s.status === 'active').length
  const pastDue = audit.subscriptions.filter((s) => s.status === 'past_due').length
  lines.push(
    `*契約の現在数: ${audit.subscriptions.length}件*（課金中 ${active} / トライアル ${trialing} / 支払い遅延 ${pastDue}）｜ 月次売上見込 ${yen(Math.round(audit.mrr))}`
  )

  if (audit.canceledInWindow.length > 0) {
    lines.push(`*${opts.windowLabel}の解約: ${audit.canceledInWindow.length}件* — ${audit.canceledInWindow.map((c) => c.email || c.id).join(', ')}`)
  }

  if (!audit.webhookOk) {
    lines.push('')
    lines.push(`:rotating_light: *Stripe Webhook 異常*`)
    lines.push(`・${audit.webhookDetail}`)
    lines.push('・このままでは新規契約がプランに反映されず、課金通知も飛びません。')
  }

  if (audit.mismatched.length > 0) {
    lines.push('')
    lines.push(`:rotating_light: *課金されているのに無料プランのままの方: ${audit.mismatched.length}名*`)
    for (const s of audit.mismatched) {
      lines.push(
        `・${s.email || s.customerId} ｜ Stripe: ${s.tier}(${s.status}) ｜ DB: ${s.dbUserFound ? s.dbPlan : 'ユーザー未登録'} ｜ sub: ${s.id}`
      )
    }
    lines.push('・対処: 本人にいずれかの料金ページ（例 /pricing）で「課金状態を確認してプランを反映する」を押してもらうか、運営で反映してください。')
  }

  if (audit.tierDrift.length > 0) {
    lines.push('')
    lines.push(`:rotating_light: *Stripe契約とDBプランの階層不一致: ${audit.tierDrift.length}名*`)
    for (const d of audit.tierDrift) {
      lines.push(`・${d.email || d.userId} ｜ Stripe: ${d.stripeTier} ｜ DB: ${d.dbPlan} ｜ sub: ${d.subscriptionIds.join(', ')}`)
    }
    lines.push('・対処: 契約の価格と手動付与の有無を確認し、必要ならプランを再同期してください。')
  }

  if (audit.unmappedPlans.length > 0) {
    lines.push('')
    lines.push(`:rotating_light: *プランを特定できない契約: ${audit.unmappedPlans.length}件*`)
    for (const sub of audit.unmappedPlans) {
      lines.push(`・${sub.email || sub.customerId} ｜ sub: ${sub.id} ｜ Stripe状態: ${sub.status}`)
    }
    lines.push('・契約の価格IDとプラン設定を確認してください。階層の整合性を判定できません。')
  }

  if (audit.duplicates.length > 0) {
    lines.push('')
    lines.push(`:rotating_light: *同一利用者で契約が重複: ${audit.duplicates.length}件（過剰請求の恐れ）*`)
    for (const d of audit.duplicates) {
      lines.push(`・${d.email}: ${d.subs.map((s) => `${s.id}(${s.status})`).join(' / ')}`)
    }
  }

  if (audit.serviceDrift.length > 0) {
    lines.push('')
    lines.push(`:rotating_light: *有料なのにサービス別プランが揃っていない方: ${audit.serviceDrift.length}名*`)
    for (const d of audit.serviceDrift) {
      lines.push(`・${d.email || '不明'} ｜ User.plan=${d.userPlan}（期待 ${d.expected}）｜ 未反映: ${d.broken.join(', ')}`)
    }
    lines.push('・対処: 本人に料金ページの「課金状態を確認してプランを反映する」を押してもらうか、運営で全サービス行を反映してください。')
  }

  if (audit.overGranted.length > 0) {
    lines.push('')
    lines.push(`:warning: *Stripeに有効な契約が無いのに有料プランのまま: ${audit.overGranted.length}名*`)
    for (const o of audit.overGranted.slice(0, 20)) {
      lines.push(`・${o.email || '不明'} ｜ DB: ${o.plan}`)
    }
    if (audit.overGranted.length > 20) lines.push(`・ほか ${audit.overGranted.length - 20}名`)
    lines.push('・解約の反映漏れ、または運営による手動付与（招待/検証アカウント等）の可能性があります。')
  }

  if (audit.unknownBillingIntervals.length > 0) {
    lines.push('')
    lines.push(`:warning: *請求周期を確認できない契約: ${audit.unknownBillingIntervals.length}件*`)
    for (const s of audit.unknownBillingIntervals) lines.push(`・${s.email || s.customerId} ｜ sub: ${s.id}`)
    lines.push('・月次売上見込にはこれらの契約を含めていません。Stripeの価格設定を確認してください。')
  }

  if (!hasProblem) {
    lines.push('')
    lines.push('整合性チェック: 異常なし（Webhook正常・反映漏れ0・階層ズレ0・プラン不明0・サービス別ズレ0・重複0・過剰付与0）')
  }

  return lines.filter((l) => l !== undefined).join('\n')
}

// ============================================
// 月次の売上レポート
// ============================================
// なぜ Stripe を直接読むか: DB には「入金の事実」が無い（プランしか持っていない）。
// 売上は請求書（invoice）の実入金額が唯一の正本。
// ⚠️ 「契約数 × ¥9,980」で売上を出さないこと。トライアル中は1円も入っていない。

export type MonthlyRevenue = {
  label: string
  paidCount: number
  paidTotal: number
  refundTotal: number
  pendingRefundCount: number
  pendingRefundTotal: number
  netTotal: number
  newSubscriptions: number
  canceled: number
  activeCount: number
  trialingCount: number
  /** トライアル中の方が、いつ・いくら売上になるか */
  upcoming: Array<{ email: string | null; at: Date; amount: number }>
}

/** JSTでの「前月1日0:00」と「当月1日0:00」を返す */
function jstMonthRange(now = new Date()): { since: Date; until: Date; label: string } {
  const jst = new Date(now.getTime() + 9 * 3600_000)
  const y = jst.getUTCFullYear()
  const m = jst.getUTCMonth()
  // JSTの月初 = UTCでは前日15:00
  const until = new Date(Date.UTC(y, m, 1, 0, 0, 0) - 9 * 3600_000)
  const since = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0) - 9 * 3600_000)
  const prev = new Date(Date.UTC(y, m - 1, 1))
  return { since, until, label: `${prev.getUTCFullYear()}年${prev.getUTCMonth() + 1}月` }
}

export async function runMonthlyRevenue(now = new Date()): Promise<MonthlyRevenue> {
  const { since, until, label } = jstMonthRange(now)
  const sinceSeconds = Math.floor(since.getTime() / 1000)
  const untilSeconds = Math.floor(until.getTime() / 1000)

  // Stripeアカウントは他アプリと共有。請求書を集計する前にDoya契約を確定する。
  const all = (await listAllSubscriptions()).filter((s) => isDoyaSubscription(s))
  const doyaSubscriptionIds = new Set(all.map((s) => s.id))

  // 請求書の作成月と入金月は異なりうる。前月より前に作成された請求書も
  // paid_at が前月に入っていれば計上するため、履歴を最後までページングする。
  const paid: any[] = []
  const doyaInvoiceIds = new Set<string>()
  let startingAfter: string | undefined
  const cursors = new Set<string>()
  while (true) {
    const res: any = await stripe.invoices.list({
      status: 'paid',
      created: { lt: untilSeconds },
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    for (const invoice of res.data) {
      const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
      if (!subscriptionId || !doyaSubscriptionIds.has(subscriptionId) || invoice.status !== 'paid' || (invoice.amount_paid || 0) <= 0) continue
      const paidAt = invoice.status_transitions?.paid_at
      if (!Number.isSafeInteger(paidAt) || paidAt <= 0) throw new Error(`Monthly invoice payment timestamp is missing: ${invoice.id}`)
      if (invoice.currency !== 'jpy') throw new Error(`Monthly invoice currency is not JPY: ${invoice.id}`)
      doyaInvoiceIds.add(invoice.id)
      if (paidAt >= sinceSeconds && paidAt < untilSeconds) paid.push(invoice)
    }
    if (!res.has_more) break
    const next = res.data[res.data.length - 1]?.id
    if (!next || cursors.has(next)) throw new Error('Monthly invoice pagination did not advance')
    cursors.add(next)
    startingAfter = next
  }
  const paidTotal = paid.reduce((sum, i) => sum + (i.amount_paid || 0), 0)

  // 請求書の post_payment_credit_notes_amount は累計であり、残高クレジットや
  // Stripe外の調整も含む。返金作成月の Refund を請求書へ紐付けて別途集計する。
  let refundTotal = 0
  let pendingRefundCount = 0
  let pendingRefundTotal = 0
  startingAfter = undefined
  cursors.clear()
  while (true) {
    const res: any = await stripe.refunds.list({
      created: { gte: sinceSeconds, lt: untilSeconds },
      limit: 100,
      expand: ['data.charge', 'data.payment_intent'],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    for (const refund of res.data) {
      if (refund.currency !== 'jpy') continue
      let charge = refund.charge
      if (typeof charge === 'string') charge = await stripe.charges.retrieve(charge)
      let paymentIntent = refund.payment_intent
      if (!charge?.invoice && typeof paymentIntent === 'string') paymentIntent = await stripe.paymentIntents.retrieve(paymentIntent)
      const invoice = charge?.invoice || paymentIntent?.invoice
      const invoiceId = typeof invoice === 'string' ? invoice : invoice?.id
      if (!invoiceId) {
        if (!charge && !paymentIntent) throw new Error(`Monthly refund invoice cannot be resolved: ${refund.id}`)
        continue // 共有Stripeアカウントの請求書を持たない決済
      }
      if (!doyaInvoiceIds.has(invoiceId)) continue
      if (!Number.isSafeInteger(refund.amount) || refund.amount <= 0) throw new Error(`Monthly refund amount is invalid: ${refund.id}`)
      if (refund.status === 'succeeded') refundTotal += refund.amount
      else if (refund.status === 'pending' || refund.status === 'requires_action') {
        pendingRefundCount++
        pendingRefundTotal += refund.amount
      } else if (refund.status !== 'failed' && refund.status !== 'canceled') {
        throw new Error(`Monthly refund status is unknown: ${refund.id}`)
      }
    }
    if (!res.has_more) break
    const next = res.data[res.data.length - 1]?.id
    if (!next || cursors.has(next)) throw new Error('Monthly refund pagination did not advance')
    cursors.add(next)
    startingAfter = next
  }

  // 契約の現況
  const live = all.filter((s) => ACTIVE_LIKE_STATUSES.has(String(s.status)))
  const activeCount = live.filter((s) => s.status === 'active').length
  const trialingCount = live.filter((s) => s.status === 'trialing').length
  const newSubscriptions = all.filter(
    (s) => s.created * 1000 >= since.getTime() && s.created * 1000 < until.getTime()
  ).length
  const canceled = all.filter(
    (s) => s.ended_at && s.ended_at * 1000 >= since.getTime() && s.ended_at * 1000 < until.getTime()
  ).length

  // トライアル中の方がいつ売上になるか（見込みの根拠）
  const upcoming = live
    .filter((s) => s.status === 'trialing')
    .map((s) => ({
      email: (typeof s.customer === 'object' ? (s.customer?.email as string | undefined) : null) || null,
      at: new Date(s.current_period_end * 1000),
      amount: s.items?.data?.[0]?.price?.unit_amount ?? 0,
    }))
    .sort((a, b) => a.at.getTime() - b.at.getTime())

  return {
    label,
    paidCount: paid.length,
    paidTotal,
    refundTotal,
    pendingRefundCount,
    pendingRefundTotal,
    netTotal: paidTotal - refundTotal,
    newSubscriptions,
    canceled,
    activeCount,
    trialingCount,
    upcoming,
  }
}

export function formatMonthlyRevenueMessage(r: MonthlyRevenue): string {
  const lines: string[] = []
  lines.push(`:chart_with_upwards_trend: *[月次売上レポート/${r.label}]*`)
  lines.push('')
  lines.push(`*${r.label}の売上: ${yen(r.netTotal)}*`)
  lines.push(`・入金 ${r.paidCount}件 ｜ 合計 ${yen(r.paidTotal)}`)
  if (r.refundTotal > 0) lines.push(`・返金 -${yen(r.refundTotal)}`)
  if (r.pendingRefundCount > 0) lines.push(`・処理中の返金 ${r.pendingRefundCount}件 ｜ ${yen(r.pendingRefundTotal)}（上記の売上から未控除）`)
  lines.push('')
  lines.push(`*契約の現況*`)
  lines.push(`・課金中: ${r.activeCount}件`)
  lines.push(`・無料トライアル中: ${r.trialingCount}件（**まだ売上ではありません**）`)
  lines.push(`・${r.label}の新規申し込み: ${r.newSubscriptions}件 ｜ 解約: ${r.canceled}件`)

  if (r.upcoming.length > 0) {
    lines.push('')
    lines.push(`*トライアルが終わって売上になる予定*`)
    for (const u of r.upcoming) {
      lines.push(`・${u.email || '不明'}: ${jstDate(u.at)} に ${yen(u.amount)}`)
    }
  }
  return lines.join('\n')
}
