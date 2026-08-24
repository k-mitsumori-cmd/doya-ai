import type { EngagementLike } from '@/lib/app-morning-digest'

// ============================================
// ゆるせん エンゲージメント日次集計（自前Supabase → 朝刊）
//
// App Store の集計より正確・即時な「実ユーザーのアクティブ状況」を、
// ゆるせんの Supabase (PostgreSQL) から直接集計する。
// 呪い日記の noroi-engagement-report.ts と同じ考え方だが、
// テーブルがアプリ固有なので別ファイルにしている。
//
// 指標（対象日 = 前日 JST の完全な1日）:
// - DAU（daily_grants.grant_date の distinct user ≒ その日アプリを開いた人）
// - 新規登録（profiles.created_at）
// - 綴じた人（grudge_targets.created_at ＝ このアプリの主行動）
// - 裁き（judgment_casts.created_at）
// - ガチャ（gacha_draws.drawn_on）
// - 川柳（senryus.created_at）
// - 課金（purchases。amount_jpy 合計・件数）
// - 累計ユーザー（profiles 総数）
// - D1継続率（2日前登録コホートが前日アクティブだった割合）
//
// RLSを跨ぐため service_role キーで PostgREST を叩く（読み取りのみ）。
// 環境変数: YURUSEN_SUPABASE_URL / YURUSEN_SUPABASE_SERVICE_ROLE_KEY
// ============================================

const DEFAULT_SUPABASE_URL = 'https://fieaqwaydryvemhseqog.supabase.co'

function supabaseUrl(): string {
  return (process.env.YURUSEN_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim().replace(/\/$/, '')
}
function serviceKey(): string {
  const k = process.env.YURUSEN_SUPABASE_SERVICE_ROLE_KEY
  if (!k || !k.trim()) throw new Error('YURUSEN_SUPABASE_SERVICE_ROLE_KEY が未設定です')
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
  return Number(cr.split('/')[1]) || 0
}

async function pgRows<T = any>(pathAndQuery: string): Promise<T[]> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/${pathAndQuery}`, { headers: headers() })
  if (!res.ok) {
    throw new Error(`Supabase select error ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  return (await res.json()) as T[]
}

/** 対象日 JST の created_at 範囲で件数を数える */
async function countInDay(table: string, day: string): Promise<number> {
  const { startUtc, endUtc } = jstDayRangeUtc(day)
  return pgCount(
    `${table}?created_at=gte.${encodeURIComponent(startUtc)}&created_at=lt.${encodeURIComponent(endUtc)}&select=id`,
  )
}

// ---------- メイン ----------

/** 前日ぶんのゆるせんアプリ内指標を集計する（朝刊から呼ぶ） */
export async function fetchYurusenEngagement(): Promise<EngagementLike> {
  const day = jstDate(1) // 前日（完全な1日）
  const { startUtc, endUtc } = jstDayRangeUtc(day)

  // DAU（daily_grants は (user_id, grant_date) 一意 → 行数=distinct user）
  const dau = await pgCount(`daily_grants?grant_date=eq.${day}&select=user_id`)

  const newUsers = await pgCount(
    `profiles?created_at=gte.${encodeURIComponent(startUtc)}&created_at=lt.${encodeURIComponent(endUtc)}&select=id`,
  )
  const totalUsers = await pgCount(`profiles?select=id`)

  const grudges = await countInDay('grudge_targets', day)
  const judgments = await countInDay('judgment_casts', day)
  const senryus = await countInDay('senryus', day)
  // ガチャは drawn_on（JST日付）で持っている
  const gacha = await pgCount(`gacha_draws?drawn_on=eq.${day}&select=id`)

  // 課金（対象日内の purchases。completed 系のみ）
  const purchases = await pgRows<{ amount_jpy: number; status: string }>(
    `purchases?created_at=gte.${encodeURIComponent(startUtc)}&created_at=lt.${encodeURIComponent(endUtc)}&select=amount_jpy,status`,
  )
  const paid = purchases.filter(
    (p) => !p.status || ['completed', 'succeeded', 'paid'].includes(String(p.status).toLowerCase()),
  )
  const revenueJpy = paid.reduce((s, p) => s + (Number(p.amount_jpy) || 0), 0)

  // D1継続率: 2日前に登録したユーザーが前日(=登録翌日)アクティブだったか
  let d1Retention: number | null = null
  const cohortDay = jstDate(2)
  const cohortRange = jstDayRangeUtc(cohortDay)
  const cohort = await pgRows<{ id: string }>(
    `profiles?created_at=gte.${encodeURIComponent(cohortRange.startUtc)}&created_at=lt.${encodeURIComponent(cohortRange.endUtc)}&select=id`,
  )
  if (cohort.length > 0) {
    const ids = cohort.map((c) => c.id)
    const active = await pgRows<{ user_id: string }>(
      `daily_grants?grant_date=eq.${day}&user_id=in.(${ids.join(',')})&select=user_id`,
    )
    const activeSet = new Set(active.map((a) => a.user_id))
    const retained = ids.filter((id) => activeSet.has(id)).length
    d1Retention = Math.round((retained / cohort.length) * 1000) / 10 // %
  }

  return {
    day,
    dau,
    newUsers,
    totalUsers,
    // 0件の行動は並べても意味が薄いので、動きのあったものだけ載せる
    actions: [
      { label: '綴じた人', value: grudges, unit: '件' },
      { label: '裁き', value: judgments, unit: '回' },
      { label: 'ガチャ', value: gacha, unit: '回' },
      { label: '川柳', value: senryus, unit: '件' },
    ].filter((a) => a.value > 0),
    revenueJpy,
    purchaseCount: paid.length,
    d1Retention,
  }
}
