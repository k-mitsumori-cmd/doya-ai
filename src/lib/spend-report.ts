// ============================================
// 毎朝の消費レポート
//
// **昨日、どのアプリがどれだけ使われて、いくらかかったか**を1通で出す。
// サブスクが増えて予算が苦しいときに、まず見る数字。
//
// ## 実費は提供元の請求が正本。推定で埋めない
//
// Claude / OpenAI の実費は**組織の Admin キー**でしか読めない。
// 通常の API キーで叩くと 401（実測）。鍵が無いときは「取得できない」と
// 書いて、埋め方を並べる。**手元の推定を実費の顔で出さない** —
// 予算の判断材料なので、外れた数字はいちばん害が大きい。
//
//   ANTHROPIC_ADMIN_KEY … Console → Settings → Admin keys（Owner のみ）
//   OPENAI_ADMIN_KEY    … Platform → Settings → Organization → Admin keys
//
// ## 使われ方は各アプリのDBから
//
// ドヤAI は Generation（サービス別）、ゲーム3本は Supabase の PostgREST。
// **ヒトリジメの character 行数＝Claude を呼んだ回数**なので、
// 実費が取れるようになったときの突き合わせにも使える。
// ============================================

import { getServiceUsageStats, postPlainToSlack } from '@/lib/notifications'
import { fetchGCPUsageReport } from '@/lib/gcp-usage'

/** 円換算のレート。gcp-usage.ts と同じ値に揃える */
const USD_TO_JPY = 150

export type Money = { usd: number; jpy: number }
const money = (usd: number): Money => ({ usd, jpy: Math.round(usd * USD_TO_JPY) })

export type CostLine = {
  label: string
  /** 取得できなかったときは null。**0円と区別する** */
  money: Money | null
  /** 取れなかった理由、または推定である旨 */
  note?: string
}

export type UsageLine = { label: string; detail: string }

export type SpendReport = {
  dateLabel: string
  costs: CostLine[]
  monthCosts: CostLine[]
  usage: UsageLine[]
  fixed: { name: string; monthlyJpy: number }[]
  errors: string[]
}

// ---------- 期間（JST） ----------

/** JST の「今日 0:00」を UTC の Date で返す */
function jstStartOfToday(now = new Date()): Date {
  const shifted = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  shifted.setUTCHours(0, 0, 0, 0)
  return new Date(shifted.getTime() - 9 * 60 * 60 * 1000)
}

/** JST の月初 0:00 を UTC の Date で返す */
function jstStartOfMonth(now = new Date()): Date {
  const shifted = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  shifted.setUTCDate(1)
  shifted.setUTCHours(0, 0, 0, 0)
  return new Date(shifted.getTime() - 9 * 60 * 60 * 1000)
}

// ---------- 実費（提供元） ----------

/**
 * Claude の実費。**Admin キーが要る。**
 * 通常の ANTHROPIC_API_KEY では 401 になる（実測）ので、混同しないこと。
 */
async function fetchAnthropicCost(from: Date, to: Date): Promise<CostLine> {
  const key = process.env.ANTHROPIC_ADMIN_KEY?.trim()
  if (!key) {
    return {
      label: 'Claude API',
      money: null,
      note: 'ANTHROPIC_ADMIN_KEY 未設定（Console → Settings → Admin keys）',
    }
  }
  const url =
    `https://api.anthropic.com/v1/organizations/cost_report` +
    `?starting_at=${from.toISOString()}&ending_at=${to.toISOString()}&bucket_width=1d&limit=31`
  const res = await fetch(url, {
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { label: 'Claude API', money: null, note: `取得失敗 ${res.status} ${body.slice(0, 80)}` }
  }
  const json: any = await res.json().catch(() => null)
  let usd = 0
  for (const bucket of json?.data ?? []) {
    for (const r of bucket?.results ?? []) usd += Number(r?.amount ?? 0)
  }
  return { label: 'Claude API', money: money(usd) }
}

/** OpenAI の実費。こちらも Admin キー（sk-admin-…）が要る */
async function fetchOpenAICost(from: Date, to: Date): Promise<CostLine> {
  const key = process.env.OPENAI_ADMIN_KEY?.trim()
  if (!key) {
    return {
      label: 'OpenAI API',
      money: null,
      note: 'OPENAI_ADMIN_KEY 未設定（Platform → Settings → Organization → Admin keys）',
    }
  }
  const url =
    `https://api.openai.com/v1/organization/costs` +
    `?start_time=${Math.floor(from.getTime() / 1000)}&end_time=${Math.floor(to.getTime() / 1000)}` +
    `&bucket_width=1d&limit=31`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { label: 'OpenAI API', money: null, note: `取得失敗 ${res.status} ${body.slice(0, 80)}` }
  }
  const json: any = await res.json().catch(() => null)
  let usd = 0
  for (const bucket of json?.data ?? []) {
    for (const r of bucket?.results ?? []) usd += Number(r?.amount?.value ?? 0)
  }
  return { label: 'OpenAI API', money: money(usd) }
}

// ---------- 使われ方（各アプリのDB） ----------

/** Supabase の PostgREST で件数だけ数える（RLS を跨ぐので service_role） */
async function countRows(
  urlEnv: string,
  keyEnv: string,
  table: string,
  query: string,
): Promise<number | null> {
  const base = process.env[urlEnv]?.trim().replace(/\/$/, '')
  const key = process.env[keyEnv]?.trim()
  if (!base || !key) return null
  const res = await fetch(`${base}/rest/v1/${table}?${query}&select=id`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      // 本文は要らない。件数はヘッダで受け取る
      Prefer: 'count=exact',
      Range: '0-0',
    },
  })
  if (!res.ok) return null
  const range = res.headers.get('content-range') ?? ''
  const total = range.split('/')[1]
  return total && total !== '*' ? Number(total) : null
}

const iso = (d: Date) => d.toISOString()

async function fetchAppUsage(from: Date, to: Date): Promise<{ usage: UsageLine[]; errors: string[] }> {
  const usage: UsageLine[] = []
  const errors: string[] = []

  // ドヤAI（Generation をサービス別に）
  try {
    const stats = await getServiceUsageStats(from, to)
    const total = stats.reduce((s, x) => s + x.count, 0)
    if (total === 0) {
      usage.push({ label: 'ドヤAI', detail: '生成 0件' })
    } else {
      const top = stats.slice(0, 5).map((s) => `${s.label} ${s.count}`).join(' / ')
      usage.push({ label: 'ドヤAI', detail: `生成 ${total.toLocaleString()}件（${top}）` })
    }
  } catch (e: any) {
    errors.push(`ドヤAIの利用集計に失敗: ${e?.message ?? e}`)
  }

  // ヒトリジメ（character 行＝Claude を呼んだ回数）
  const calls = await countRows(
    'HITORIJIME_SUPABASE_URL',
    'HITORIJIME_SUPABASE_SERVICE_ROLE_KEY',
    'messages',
    `role=eq.character&created_at=gte.${iso(from)}&created_at=lt.${iso(to)}`,
  )
  /*
   * **1往復の原価には幅がある**（hitorijime の `check-turn-cost.mts` 実測）。
   * 連続で打っている間はキャッシュが効いて ¥0.48、通知から開いた1通目は
   * 冷えていて ¥2.30。どちらになるかは打ち方次第なので、**幅で出す。**
   * これは合計には足さない — 開発で使った分が入らないので、
   * 総額の顔をさせると実際より小さく見える。
   */
  const TURN_JPY_WARM = 0.48
  const TURN_JPY_COLD = 2.3
  usage.push({
    label: 'ヒトリジメ',
    detail:
      calls === null
        ? '未接続（HITORIJIME_SUPABASE_* 未設定）'
        : `返信 ${calls.toLocaleString()}通` +
          (calls > 0
            ? `（Claude 推定 ¥${Math.round(calls * TURN_JPY_WARM).toLocaleString()}〜${Math.round(calls * TURN_JPY_COLD).toLocaleString()}・アプリ分のみ）`
            : ''),
  })

  // 呪い日記 / ゆるせん（書き込み件数）
  for (const [label, urlEnv, keyEnv, table] of [
    // **テーブル名は接続先に問い合わせて確かめること。** 最初 entries と
    // 決め打ちして両方 404 になり、「取得できず」とだけ出ていた
    ['呪い日記', 'NOROI_SUPABASE_URL', 'NOROI_SUPABASE_SERVICE_ROLE_KEY', 'curse_entries'],
    ['ゆるせん', 'YURUSEN_SUPABASE_URL', 'YURUSEN_SUPABASE_SERVICE_ROLE_KEY', 'grudge_targets'],
  ] as const) {
    const n = await countRows(urlEnv, keyEnv, table, `created_at=gte.${iso(from)}&created_at=lt.${iso(to)}`)
    usage.push({ label, detail: n === null ? '取得できず' : `書き込み ${n.toLocaleString()}件` })
  }

  return { usage, errors }
}

// ---------- 固定費 ----------

/**
 * 毎月のサブスク。**額は人が入れる。**
 * `FIXED_COSTS_JSON` に `[{"name":"Vercel Pro","monthlyJpy":3000}]` の形で置く。
 * 勝手に推測して並べると、合計が嘘になる。
 */
function fetchFixedCosts(): { name: string; monthlyJpy: number }[] {
  const raw = process.env.FIXED_COSTS_JSON?.trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((x: any) => ({ name: String(x?.name ?? ''), monthlyJpy: Number(x?.monthlyJpy ?? 0) }))
      .filter((x) => x.name && x.monthlyJpy > 0)
  } catch {
    return []
  }
}

// ---------- 組み立て ----------

export async function buildSpendReport(now = new Date()): Promise<SpendReport> {
  const todayStart = jstStartOfToday(now)
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
  const monthStart = jstStartOfMonth(now)
  const errors: string[] = []

  const dateLabel = new Date(yesterdayStart.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
    .replace(/^\d{4}-/, '')
    .replace('-', '/')

  const [anthropic, openai, anthropicMonth, openaiMonth] = await Promise.all([
    fetchAnthropicCost(yesterdayStart, todayStart).catch((e) => ({
      label: 'Claude API', money: null, note: `取得失敗: ${e?.message ?? e}`,
    } as CostLine)),
    fetchOpenAICost(yesterdayStart, todayStart).catch((e) => ({
      label: 'OpenAI API', money: null, note: `取得失敗: ${e?.message ?? e}`,
    } as CostLine)),
    fetchAnthropicCost(monthStart, todayStart).catch(() => ({ label: 'Claude API', money: null } as CostLine)),
    fetchOpenAICost(monthStart, todayStart).catch(() => ({ label: 'OpenAI API', money: null } as CostLine)),
  ])

  // Gemini は既存の推定をそのまま使う（GCP の課金APIではなく呼び出し数からの推定）
  let gemini: CostLine = { label: 'Gemini API', money: null, note: '取得できず' }
  let geminiMonth: CostLine = { label: 'Gemini API', money: null }
  try {
    const gcp = await fetchGCPUsageReport()
    if (gcp.error) errors.push(`GCP: ${gcp.error}`)
    gemini = {
      label: 'Gemini API',
      money: { usd: gcp.estimatedCost.geminiApiUsd, jpy: gcp.estimatedCost.geminiApiJpy },
      note: '呼び出し数からの推定',
    }
    geminiMonth = {
      label: 'Gemini API',
      money: { usd: gcp.monthly.estimatedCost.totalUsd, jpy: gcp.monthly.estimatedCost.totalJpy },
      note: '推定',
    }
  } catch (e: any) {
    errors.push(`Gemini の集計に失敗: ${e?.message ?? e}`)
  }

  const { usage, errors: usageErrors } = await fetchAppUsage(yesterdayStart, todayStart)
  errors.push(...usageErrors)

  return {
    dateLabel,
    costs: [anthropic, openai, gemini],
    monthCosts: [anthropicMonth, openaiMonth, geminiMonth],
    usage,
    fixed: fetchFixedCosts(),
    errors,
  }
}

const yen = (n: number) => `¥${n.toLocaleString()}`

export function formatSpendReport(r: SpendReport): string {
  const lines: string[] = [`💸 *[日次コストレポート]* ${r.dateLabel} 分`, ``]

  // --- 昨日の実費 ---
  lines.push(`*使った額（${r.dateLabel}）*`)
  let dayTotal = 0
  let missing = 0
  for (const c of r.costs) {
    if (c.money) {
      dayTotal += c.money.jpy
      lines.push(`- ${c.label}: *${yen(c.money.jpy)}*（$${c.money.usd.toFixed(2)}）${c.note ? ` _${c.note}_` : ''}`)
    } else {
      missing++
      lines.push(`- ${c.label}: 取得できず — ${c.note ?? '理由不明'}`)
    }
  }
  lines.push(missing > 0 ? `- 合計（取れた分のみ）: *${yen(dayTotal)}*` : `- 合計: *${yen(dayTotal)}*`)

  // --- 月間 ---
  const monthLabel = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7).replace('-', '/')
  lines.push(``, `*今月（${monthLabel}）*`)
  let monthTotal = 0
  for (const c of r.monthCosts) {
    if (!c.money) continue
    monthTotal += c.money.jpy
    lines.push(`- ${c.label}: ${yen(c.money.jpy)}`)
  }
  const dayOfMonth = Number(new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(8, 10))
  if (monthTotal > 0 && dayOfMonth > 1) {
    const perDay = monthTotal / (dayOfMonth - 1)
    lines.push(`- 累計 *${yen(monthTotal)}* → このペースなら月末 *${yen(Math.round(perDay * 30))}*`)
  } else {
    lines.push(`- 累計 ${yen(monthTotal)}`)
  }

  // --- 固定費 ---
  lines.push(``, `*毎月のサブスク*`)
  if (r.fixed.length === 0) {
    lines.push(`- 未登録。FIXED_COSTS_JSON に入れると合算します`)
  } else {
    const fixedTotal = r.fixed.reduce((s, x) => s + x.monthlyJpy, 0)
    for (const f of r.fixed) lines.push(`- ${f.name}: ${yen(f.monthlyJpy)}/月`)
    lines.push(`- 小計 *${yen(fixedTotal)}/月*（1日あたり ${yen(Math.round(fixedTotal / 30))}）`)
  }

  // --- 使われ方 ---
  lines.push(``, `*どれだけ使われたか（${r.dateLabel}）*`)
  for (const u of r.usage) lines.push(`- ${u.label}: ${u.detail}`)

  if (r.errors.length > 0) {
    lines.push(``, `⚠️ ${r.errors.join(' / ')}`)
  }

  return lines.join('\n')
}

/** 組み立てて運用チャンネルへ送る */
export async function sendSpendReport(): Promise<void> {
  const report = await buildSpendReport()
  await postPlainToSlack(formatSpendReport(report))
}
