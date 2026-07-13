// ============================================
// 呪い日記 Supabase 共通クライアント（読み取り・集計用）
//
// RLSを跨ぐため service_role キーで PostgREST を叩く。
// エンゲージメント/週次/月次の各レポートで共有する。
// 環境変数: NOROI_SUPABASE_URL / NOROI_SUPABASE_SERVICE_ROLE_KEY
// ============================================

const DEFAULT_SUPABASE_URL = 'https://egkbnhqparjfvoyrpwpg.supabase.co'

export function supabaseUrl(): string {
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

/** count=exact で総件数を取得（Content-Range の "/N" を読む） */
export async function pgCount(pathAndQuery: string): Promise<number> {
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

/** 行を取得 */
export async function pgRows<T = any>(pathAndQuery: string): Promise<T[]> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/${pathAndQuery}`, { headers: headers() })
  if (!res.ok) {
    throw new Error(`Supabase select error ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  return (await res.json()) as T[]
}

// ---------- 日付（JST） ----------

/** JSTで today から offsetDays 日前の 'YYYY-MM-DD' */
export function jstDateStr(offsetDays: number): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
  d.setUTCDate(d.getUTCDate() - offsetDays)
  return d.toISOString().slice(0, 10)
}

/** JST日付 'YYYY-MM-DD' の 00:00〜翌00:00 を UTC ISO 区間で返す */
export function jstDayRangeUtc(jstDay: string): { startUtc: string; endUtc: string } {
  const start = new Date(`${jstDay}T00:00:00+09:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { startUtc: start.toISOString(), endUtc: end.toISOString() }
}

/** JST日付区間 [startDay 00:00, endDayExclusive 00:00) を UTC ISO で返す */
export function jstRangeUtc(startDay: string, endDayExclusive: string): { startUtc: string; endUtc: string } {
  return {
    startUtc: new Date(`${startDay}T00:00:00+09:00`).toISOString(),
    endUtc: new Date(`${endDayExclusive}T00:00:00+09:00`).toISOString(),
  }
}

// ---------- 期間集計ヘルパー ----------

/** created_at(timestamptz) が JST期間内の行数 */
export async function countByCreatedAt(
  table: string,
  startDay: string,
  endDayExclusive: string,
): Promise<number> {
  const { startUtc, endUtc } = jstRangeUtc(startDay, endDayExclusive)
  return pgCount(
    `${table}?created_at=gte.${encodeURIComponent(startUtc)}&created_at=lt.${encodeURIComponent(endUtc)}&select=id`,
  )
}

/** daily_grants の grant_date(JST date) が期間内の distinct user 数（≒アクティブ人数）。
 *  [startDay, endDayExclusive) の日付範囲。 */
export async function activeUsers(startDay: string, endDayExclusive: string): Promise<number> {
  const rows = await pgRows<{ user_id: string }>(
    `daily_grants?grant_date=gte.${startDay}&grant_date=lt.${endDayExclusive}&select=user_id`,
  )
  return new Set(rows.map((r) => r.user_id)).size
}

/** gacha_draws の drawn_on(JST date) が期間内の行数 */
export async function countByDrawnOn(startDay: string, endDayExclusive: string): Promise<number> {
  return pgCount(`gacha_draws?drawn_on=gte.${startDay}&drawn_on=lt.${endDayExclusive}&select=id`)
}

/** purchases の created_at が期間内の売上合計(JPY)・件数（status完了のみ） */
export async function purchaseSum(
  startDay: string,
  endDayExclusive: string,
): Promise<{ revenueJpy: number; count: number }> {
  const { startUtc, endUtc } = jstRangeUtc(startDay, endDayExclusive)
  const rows = await pgRows<{ amount_jpy: number; status: string }>(
    `purchases?created_at=gte.${encodeURIComponent(startUtc)}&created_at=lt.${encodeURIComponent(endUtc)}&select=amount_jpy,status`,
  )
  const paid = rows.filter(
    (p) => !p.status || ['completed', 'succeeded', 'paid'].includes(String(p.status).toLowerCase()),
  )
  return {
    revenueJpy: paid.reduce((s, p) => s + (Number(p.amount_jpy) || 0), 0),
    count: paid.length,
  }
}

/** profiles 総数（累計ユーザー） */
export async function totalUsers(): Promise<number> {
  return pgCount(`profiles?select=id`)
}
