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
  planTierFromPlanId,
  ALL_SERVICE_IDS,
  ACTIVE_LIKE_STATUSES,
} from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export const BILLING_WEBHOOK_EXPECTED_URL =
  process.env.STRIPE_WEBHOOK_EXPECTED_URL || 'https://doya-ai.surisuta.jp/api/stripe/webhook'


export type AuditSubscription = {
  id: string
  status: string
  customerId: string
  email: string | null
  name: string | null
  planId: string
  tier: string
  amount: number
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
  /** User.plan は有料なのにサービス別の行が揃っていない（INV-2 違反）。障害#5 の再発検知 */
  serviceDrift: Array<{ email: string | null; userPlan: string; expected: string; broken: string[] }>
  /** Stripe に生きた契約が無いのに DB が有料のまま（＝過剰付与・解約の反映漏れ） */
  overGranted: Array<{ email: string | null; plan: string }>
  duplicates: Array<{ email: string; subs: AuditSubscription[] }>
  webhookOk: boolean
  webhookDetail: string
  mrr: number
}

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
  for (let page = 0; page < 20; page++) {
    const res: any = await stripe.subscriptions.list({
      status: 'all',
      limit: 100,
      expand: ['data.customer'],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    out.push(...res.data)
    if (!res.has_more || res.data.length === 0) break
    startingAfter = res.data[res.data.length - 1].id
  }
  return out
}

/** 本番の Webhook エンドポイントが登録され有効かを確認する */
export async function checkWebhookEndpoint(): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await stripe.webhookEndpoints.list({ limit: 100 })
    const target = res.data.find((e) => String(e.url) === BILLING_WEBHOOK_EXPECTED_URL)
    if (!target) {
      return {
        ok: false,
        detail:
          `本番の Stripe Webhook エンドポイント（${BILLING_WEBHOOK_EXPECTED_URL}）が Stripe に登録されていません。` +
          `現在登録されているURL: ${res.data.map((e) => e.url).join(' / ') || '（0件）'}`,
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

  const live = all.filter((s) => ACTIVE_LIKE_STATUSES.has(String(s.status)))

  // メール一括でDBのプランを引く
  const emails = Array.from(
    new Set(
      live
        .map((s) => (typeof s.customer === 'object' ? s.customer?.email : null))
        .filter((e): e is string => Boolean(e))
        .map((e) => e.toLowerCase())
    )
  )
  const users = emails.length
    ? await prisma.user.findMany({
        where: { email: { in: emails, mode: 'insensitive' } },
        select: { id: true, email: true, name: true, plan: true },
      })
    : []
  const userByEmail = new Map(users.map((u) => [String(u.email).toLowerCase(), u]))

  const subscriptions: AuditSubscription[] = live.map((s) => {
    const cust = typeof s.customer === 'object' ? s.customer : null
    const email = (cust?.email as string | undefined)?.toLowerCase() || null
    const { planId } = resolvePlanIdFromSubscription(s)
    const dbUser = email ? userByEmail.get(email) : undefined
    return {
      id: s.id,
      status: String(s.status),
      customerId: typeof s.customer === 'string' ? s.customer : String(cust?.id || ''),
      email,
      name: (cust?.name as string | undefined) || dbUser?.name || null,
      planId,
      tier: planTierFromPlanId(planId),
      amount: s.items?.data?.[0]?.price?.unit_amount ?? 0,
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
    .filter((s) => String(s.status) === 'canceled' && s.ended_at && new Date(s.ended_at * 1000) >= since)
    .map((s) => ({
      id: s.id,
      email: (typeof s.customer === 'object' ? (s.customer?.email as string | undefined) : null) || null,
      endedAt: s.ended_at ? new Date(s.ended_at * 1000) : null,
    }))

  // 課金されているのに DB が FREE / ユーザーが見つからない＝反映漏れ
  const mismatched = subscriptions.filter((s) => !s.dbUserFound || s.dbPlan === 'FREE' || s.dbPlan === null)

  // 同一メールで生きている契約が2本以上＝二重契約（過剰請求）
  const byEmail = new Map<string, AuditSubscription[]>()
  for (const s of subscriptions) {
    if (!s.email) continue
    byEmail.set(s.email, [...(byEmail.get(s.email) || []), s])
  }
  const duplicates = Array.from(byEmail.entries())
    .filter(([, subs]) => subs.length > 1)
    .map(([email, subs]) => ({ email, subs }))

  // ------------------------------------------------------------------
  // INV-2 違反の検知（reference/11-billing-spec.md R-3）
  // ------------------------------------------------------------------
  // User.plan だけを見ていると、障害#5（UserServiceSubscription の一意制約で
  // banner 以外がプロにならない）と同じ状態が起きても監査が沈黙する。
  // 有料契約者について、全サービス行が期待どおり揃っているかを突き合わせる。
  const paidUserIds = subscriptions
    .map((s) => (s.email ? userByEmail.get(s.email) : undefined))
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
    .map((u) => u.id)
  const uniquePaidUserIds = Array.from(new Set(paidUserIds))

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
    for (const sub of subscriptions) {
      const dbUser = sub.email ? userByEmail.get(sub.email) : undefined
      if (!dbUser || dbUser.plan === 'FREE') continue // 反映漏れは mismatched 側で報告済み
      const expected = dbUser.plan === 'BUNDLE' ? 'PRO' : dbUser.plan
      const rowsOfUser = byUser.get(dbUser.id) || new Map<string, string>()
      const broken = ALL_SERVICE_IDS.filter((sid) => (rowsOfUser.get(sid) ?? 'MISSING') !== expected)
      if (broken.length > 0) {
        serviceDrift.push({ email: sub.email, userPlan: dbUser.plan, expected, broken: [...broken] })
      }
    }
  }

  // ------------------------------------------------------------------
  // 過剰付与の検知（解約が反映されていない／手動更新の消し忘れ）
  // ------------------------------------------------------------------
  const liveEmails = new Set(subscriptions.map((s) => s.email).filter((e): e is string => Boolean(e)))
  const paidInDb = await prisma.user.findMany({
    where: { plan: { notIn: ['FREE', 'GUEST'] } },
    select: { email: true, plan: true },
  })
  const overGranted = paidInDb
    .filter((u) => !u.email || !liveEmails.has(String(u.email).toLowerCase()))
    .map((u) => ({ email: u.email, plan: u.plan }))

  const webhook = await checkWebhookEndpoint()

  // MRR（トライアル中は未課金なので除外）
  const mrr = subscriptions
    .filter((s) => s.status === 'active' || s.status === 'past_due')
    .reduce((sum, s) => sum + s.amount, 0)

  return {
    subscriptions,
    newInWindow,
    canceledInWindow,
    mismatched,
    serviceDrift,
    overGranted,
    duplicates,
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
  return `・${who} ｜ ${s.tier} ｜ ${trial}${cancel} ｜ ${yen(s.amount)}/月 ｜ 申込 ${jstDateTime(s.createdAt)}`
}

/** 日次/週次レポートの本文を組み立てる */
export function formatBillingAuditMessage(audit: BillingAudit, opts: { windowLabel: string }): string {
  const lines: string[] = []
  const hasProblem =
    !audit.webhookOk ||
    audit.mismatched.length > 0 ||
    audit.duplicates.length > 0 ||
    audit.serviceDrift.length > 0 ||
    audit.overGranted.length > 0

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
    `*契約の現在数: ${audit.subscriptions.length}件*（課金中 ${active} / トライアル ${trialing} / 支払い遅延 ${pastDue}）｜ 月次売上見込 ${yen(audit.mrr)}`
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
    lines.push('・対処: 本人が /banner/dashboard/plan の「プランを再同期」を押すか、運営で反映してください。')
  }

  if (audit.duplicates.length > 0) {
    lines.push('')
    lines.push(`:rotating_light: *同一メールで契約が重複: ${audit.duplicates.length}件（過剰請求の恐れ）*`)
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
    lines.push('・対処: 本人に「プランを再同期」を押してもらうか、運営で全サービス行を反映してください。')
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

  if (!hasProblem) {
    lines.push('')
    lines.push('整合性チェック: 異常なし（Webhook正常・反映漏れ0・サービス別ズレ0・重複0・過剰付与0）')
  }

  return lines.filter((l) => l !== undefined).join('\n')
}
