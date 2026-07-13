// ============================================
// 呪い日記 エンゲージメント日次レポート（自前Supabase → Slack）
//
// App Store の集計より正確・即時な「実ユーザーのアクティブ状況」を、
// 呪い日記の Supabase (PostgreSQL) から直接集計して通知する。
//
// 指標（対象日 = 前日 JST の完全な1日）:
// - DAU（daily_grants.grant_date の distinct user ≒ その日アプリを開いた人）
// - 新規登録（profiles.created_at）
// - 日記投稿数（curse_entries.created_at）
// - ガチャ回数（gacha_draws.drawn_on）
// - 課金（purchases。amount_jpy 合計・件数、provider別）
// - 累計ユーザー（profiles 総数）
// - D1継続率（2日前登録コホートが前日アクティブだった割合）
//
// RLSを跨ぐため service_role キーで PostgREST を叩く（読み取りのみ）。
// 環境変数: NOROI_SUPABASE_URL / NOROI_SUPABASE_SERVICE_ROLE_KEY
// 通知先: SLACK_APPSTORE_MARKETING_WEBHOOK_URL（未設定は SLACK_APPSTORE_WEBHOOK_URL）
// ============================================

const DEFAULT_SUPABASE_URL = 'https://egkbnhqparjfvoyrpwpg.supabase.co'

function supabaseUrl(): string {
  return (process.env.NOROI_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim().replace(/\/$/, '')
}
function serviceKey(): string {
  const k = process.env.NOROI_SUPABASE_SERVICE_ROLE_KEY
  if (!k || !k.trim()) throw new Error('NOROI_SUPABASE_SERVICE_ROLE_KEY が未設定です')
  return k.trim()
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = serviceKey()
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra }
}

// ---------- 日付（JST） ----------

/** JSTで today から offsetDays 日前の 'YYYY-MM-DD' */
function jstDate(offsetDays: number): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
  d.setUTCDate(d.getUTCDate() - offsetDays)
  return d.toISOString().slice(0, 10)
}

/** JST日付 'YYYY-MM-DD' の 00:00〜翌00:00 を UTC ISO 区間で返す */
function jstDayRangeUtc(jstDay: string): { startUtc: string; endUtc: string } {
  const start = new Date(`${jstDay}T00:00:00+09:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { startUtc: start.toISOString(), endUtc: end.toISOString() }
}

// ---------- PostgREST ----------

/** count=exact で総件数を取得（Content-Range の "/N" を読む） */
async function pgCount(pathAndQuery: string): Promise<number> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/${pathAndQuery}`, {
    method: 'GET',
    headers: headers({ Prefer: 'count=exact', Range: '0-0' }),
  })
  if (!res.ok && res.status !== 206) {
    throw new Error(`Supabase count error ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  const cr = res.headers.get('content-range') || ''
  const total = cr.split('/')[1]
  return Number(total) || 0
}

/** 行を取得 */
async function pgRows<T = any>(pathAndQuery: string): Promise<T[]> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/${pathAndQuery}`, { headers: headers() })
  if (!res.ok) {
    throw new Error(`Supabase select error ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  return (await res.json()) as T[]
}

// ---------- Slack ----------

async function postSlack(text: string): Promise<void> {
  const webhookUrl =
    process.env.SLACK_APPSTORE_MARKETING_WEBHOOK_URL || process.env.SLACK_APPSTORE_WEBHOOK_URL
  if (!webhookUrl) throw new Error('Slack webhook URL is not set')
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    throw new Error(`Slack webhook error: ${res.status} ${await res.text().catch(() => '')}`)
  }
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ja-JP')
}

// ---------- メイン ----------

export type EngagementResult = {
  day: string
  dau: number
  newUsers: number
  diaryPosts: number
  gachaDraws: number
  revenueJpy: number
  purchaseCount: number
  totalUsers: number
  d1Retention: number | null
}

export async function sendNoroiEngagementReport(): Promise<EngagementResult> {
  const day = jstDate(1) // 前日（完全な1日）
  const { startUtc, endUtc } = jstDayRangeUtc(day)

  // DAU（daily_grants は (user_id, grant_date) 一意 → 行数=distinct user）
  const dau = await pgCount(`daily_grants?grant_date=eq.${day}&select=user_id`)

  // 新規登録（profiles.created_at が対象日 JST 内）
  const newUsers = await pgCount(
    `profiles?created_at=gte.${encodeURIComponent(startUtc)}&created_at=lt.${encodeURIComponent(endUtc)}&select=id`,
  )

  // 日記投稿数
  const diaryPosts = await pgCount(
    `curse_entries?created_at=gte.${encodeURIComponent(startUtc)}&created_at=lt.${encodeURIComponent(endUtc)}&select=id`,
  )

  // ガチャ回数（drawn_on は JST 日付）
  const gachaDraws = await pgCount(`gacha_draws?drawn_on=eq.${day}&select=id`)

  // 累計ユーザー
  const totalUsers = await pgCount(`profiles?select=id`)

  // 課金（対象日内の purchases。amount_jpy 合計・provider別）
  const purchases = await pgRows<{ amount_jpy: number; provider: string; status: string }>(
    `purchases?created_at=gte.${encodeURIComponent(startUtc)}&created_at=lt.${encodeURIComponent(endUtc)}&select=amount_jpy,provider,status`,
  )
  const paid = purchases.filter(
    (p) => !p.status || ['completed', 'succeeded', 'paid'].includes(String(p.status).toLowerCase()),
  )
  const revenueJpy = paid.reduce((s, p) => s + (Number(p.amount_jpy) || 0), 0)
  const purchaseCount = paid.length
  const byProvider = new Map<string, number>()
  for (const p of paid) {
    byProvider.set(p.provider || '不明', (byProvider.get(p.provider || '不明') || 0) + (Number(p.amount_jpy) || 0))
  }

  // D1継続率: 2日前に登録したユーザーが前日(=登録翌日)アクティブだったか
  let d1Retention: number | null = null
  const cohortDay = jstDate(2)
  const cohortRange = jstDayRangeUtc(cohortDay)
  const cohort = await pgRows<{ id: string }>(
    `profiles?created_at=gte.${encodeURIComponent(cohortRange.startUtc)}&created_at=lt.${encodeURIComponent(cohortRange.endUtc)}&select=id`,
  )
  if (cohort.length > 0) {
    const ids = cohort.map((c) => c.id)
    // 登録翌日(=前日 day)にアクティブ（daily_grant）だったコホートユーザー
    const active = await pgRows<{ user_id: string }>(
      `daily_grants?grant_date=eq.${day}&user_id=in.(${ids.join(',')})&select=user_id`,
    )
    const activeSet = new Set(active.map((a) => a.user_id))
    const retained = ids.filter((id) => activeSet.has(id)).length
    d1Retention = Math.round((retained / cohort.length) * 1000) / 10 // %
  }

  // ---- メッセージ整形 ----
  const lines: string[] = []
  lines.push(`呪い日記 エンゲージメント日次レポート（${day} 分）`)
  lines.push('────────────────')
  lines.push(`DAU（アクティブ）: ${fmt(dau)}人`)
  lines.push(`新規登録: ${fmt(newUsers)}人`)
  lines.push(`累計ユーザー: ${fmt(totalUsers)}人`)
  lines.push('')
  lines.push(`日記投稿: ${fmt(diaryPosts)}件`)
  lines.push(`ガチャ回数: ${fmt(gachaDraws)}回`)
  lines.push('')
  lines.push(`課金: ¥${fmt(revenueJpy)}（${fmt(purchaseCount)}件）`)
  if (byProvider.size > 0) {
    for (const [prov, amt] of byProvider) {
      const label = prov === 'apple_iap' ? 'App内課金' : prov === 'stripe' ? 'Web(Stripe)' : prov
      lines.push(`　・${label}: ¥${fmt(amt)}`)
    }
  }
  lines.push('')
  lines.push(
    d1Retention === null
      ? 'D1継続率: 対象コホートなし'
      : `D1継続率（${cohortDay}登録の翌日継続）: ${d1Retention}%`,
  )
  lines.push('')
  lines.push('※ DAUは daily_grants（その日アプリを開いた記録）ベースの近似。課金は自前DB実測。')

  await postSlack(lines.join('\n'))

  return {
    day,
    dau,
    newUsers,
    diaryPosts,
    gachaDraws,
    revenueJpy,
    purchaseCount,
    totalUsers,
    d1Retention,
  }
}
