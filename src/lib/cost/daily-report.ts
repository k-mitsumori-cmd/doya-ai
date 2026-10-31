// ============================================
// 毎朝のコスト・売上レポート（前日 ＋ 今月の累計）
// ============================================
// 送る内容: AI の API / Supabase / Vercel / AssemblyAI の費用、Stripe の売上、そこから出す粗利の目安、広告・集客。
//
// ## 費用の出し方（正直に出す）
//   実費 … 各社の公式の使用量・請求の API で取れたもの（Anthropic・OpenAI・Vercel）。
//   見積り … アプリ内のログ（保存量・音声の秒数）に単価（unit-prices.ts）を掛けたもの。「見積り」と書く。
//   日割り … 月額の固定費を日数で割ったもの。
//   取得できない … 鍵が無い・API が無いもの。0 円とは区別して、理由を書く。
// 「取得できない」費用は合計に入らない。粗利の目安は、その分だけ実際より大きく見えるので、必ず注意書きを付ける。
//
// ## 送り先
// notifications.ts の postPlainToSlack（SystemSetting の slack_webhook）。見出しは slack/notify.ts が付ける。
// Cron は vercel.json の /api/cron/spend-report（毎日 22:10 UTC = JST 7:10）。
import { prisma } from '@/lib/prisma'
import { buildSpendReport, type CostLine } from '@/lib/spend-report'
import { postPlainToSlack } from '@/lib/notifications'
import { fetchChannelSessionsForCostReport } from '@/lib/analytics-report'
import { UNIT_PRICES, toJpy } from './unit-prices'
import { formatDailyCostReport, type Basis, type Line, type RevenueBlock, type AcquisitionBlock, type DailyCostReport } from './format'

export { formatDailyCostReport, grossProfit } from './format'
export type { Basis, Line, RevenueBlock, AcquisitionBlock, DailyCostReport } from './format'

// ---------- 期間（JST） ----------

const JST = 9 * 60 * 60 * 1000
const DAY = 24 * 60 * 60 * 1000

export function jstPeriods(now = new Date()) {
  const shifted = new Date(now.getTime() + JST)
  shifted.setUTCHours(0, 0, 0, 0)
  const todayStart = new Date(shifted.getTime() - JST)
  const yesterdayStart = new Date(todayStart.getTime() - DAY)
  const m = new Date(shifted.getTime())
  m.setUTCDate(1)
  const monthStart = new Date(m.getTime() - JST)
  const dayOfMonth = shifted.getUTCDate()
  const daysInMonth = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)).getUTCDate()
  const ymd = (d: Date) => new Date(d.getTime() + JST).toISOString().slice(0, 10)
  return {
    todayStart,
    yesterdayStart,
    monthStart,
    dayOfMonth,
    daysInMonth,
    dayLabel: ymd(yesterdayStart),
    monthLabel: ymd(todayStart).slice(0, 7),
  }
}

// ---------- 提供元ごとの取得 ----------

const fromSpend = (l: CostLine, m: CostLine | undefined): Line => ({
  label: l.label,
  dayJpy: l.money ? l.money.jpy : null,
  monthJpy: m?.money ? m.money.jpy : null,
  basis: l.money ? '実費' : '取得できない',
  note: l.money ? undefined : l.note,
})

/** Supabase: 基本料の日割り ＋ 保管量の超過分の見積り。配信量（egress）は API で取れない */
async function supabaseLines(p: ReturnType<typeof jstPeriods>): Promise<Line[]> {
  const baseJpy = toJpy(UNIT_PRICES.supabaseProBase.usd)
  const baseDay = baseJpy / p.daysInMonth
  const lines: Line[] = []
  try {
    const rows = await prisma.$queryRawUnsafe<{ bytes: number; day_bytes: number; db_bytes: number }[]>(
      `SELECT
         COALESCE(SUM((metadata->>'size')::bigint), 0)::float8 AS bytes,
         COALESCE(SUM((metadata->>'size')::bigint) FILTER (WHERE created_at >= $1 AND created_at < $2), 0)::float8 AS day_bytes,
         pg_database_size(current_database())::float8 AS db_bytes
       FROM storage.objects`,
      p.yesterdayStart,
      p.todayStart,
    )
    const r = rows[0]
    const gb = (b: number) => b / 1024 ** 3
    const storageGb = gb(r?.bytes ?? 0)
    const dbGb = gb(r?.db_bytes ?? 0)
    const overStorageUsd = Math.max(0, storageGb - 100) * UNIT_PRICES.supabaseStorageGbMonth.usd
    const overDbUsd = Math.max(0, dbGb - 8) * UNIT_PRICES.supabaseDbGbMonth.usd
    const monthlyJpy = baseJpy + toJpy(overStorageUsd + overDbUsd)
    lines.push({
      label: 'Supabase（基本料＋保管・DB の超過分）',
      dayJpy: Math.round(monthlyJpy / p.daysInMonth),
      monthJpy: Math.round((monthlyJpy / p.daysInMonth) * (p.dayOfMonth - 1)),
      basis: '見積り',
      note: `保管 ${storageGb.toFixed(1)}GB（昨日の増え ${gb(r?.day_bytes ?? 0).toFixed(2)}GB）／DB ${dbGb.toFixed(2)}GB。月額の見込み ${Math.round(monthlyJpy).toLocaleString()}円`,
    })
  } catch (e: any) {
    lines.push({
      label: 'Supabase（基本料）',
      dayJpy: Math.round(baseDay),
      monthJpy: Math.round(baseDay * (p.dayOfMonth - 1)),
      basis: '日割り',
      note: `保管量を読めず、基本料だけ（${String(e?.message ?? e).slice(0, 60)}）`,
    })
  }
  lines.push({
    label: 'Supabase の配信量（egress）',
    dayJpy: null,
    monthJpy: null,
    basis: '取得できない',
    note: '使用量の API が無い。Dashboard の Usage で見る。1GB あたり ' + `${Math.round(toJpy(UNIT_PRICES.supabaseEgressGb.usd))}円（250GB を超えた分）`,
  })
  return lines
}

/** Vercel: Billing API（FOCUS 形式の請求）。取れなければ Pro の席の日割り */
async function vercelLine(p: ReturnType<typeof jstPeriods>): Promise<{ line: Line; missing?: string }> {
  const token = process.env.VERCEL_API_TOKEN?.trim()
  const team = process.env.VERCEL_TEAM_ID?.trim()
  const seatDay = toJpy(UNIT_PRICES.vercelProSeat.usd) / p.daysInMonth
  const fallback = (note: string, missing?: string) => ({
    line: {
      label: 'Vercel',
      dayJpy: Math.round(seatDay),
      monthJpy: Math.round(seatDay * (p.dayOfMonth - 1)),
      basis: '日割り' as Basis,
      note: `${note}。Pro 1席の日割りだけ（従量の分は含まない）`,
    },
    missing,
  })
  if (!token) return fallback('VERCEL_API_TOKEN 未設定', 'VERCEL_API_TOKEN')
  const sum = async (from: Date, to: Date): Promise<number> => {
    const q = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
    if (team) q.set('teamId', team)
    const res = await fetch(`https://api.vercel.com/v1/billing/charges?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Vercel ${res.status}`)
    const text = await res.text()
    let usd = 0
    for (const raw of text.split('\n')) {
      if (!raw.trim()) continue
      try {
        const row = JSON.parse(raw)
        usd += Number(row.BilledCost ?? row.EffectiveCost ?? 0)
      } catch {
        /* 壊れた行は数えない */
      }
    }
    return usd
  }
  try {
    const [d, m] = await Promise.all([sum(p.yesterdayStart, p.todayStart), sum(p.monthStart, p.todayStart)])
    return { line: { label: 'Vercel', dayJpy: Math.round(toJpy(d)), monthJpy: Math.round(toJpy(m)), basis: '実費' } }
  } catch (e: any) {
    return fallback(`請求 API の取得に失敗（${String(e?.message ?? e).slice(0, 40)}）`)
  }
}

/** AssemblyAI: 使用量の API が無いので、アプリ内の音声の秒数 × 単価。インタビューの素材とドヤカンニングだけ */
async function assemblyLine(p: ReturnType<typeof jstPeriods>): Promise<Line> {
  try {
    const sec = async (from: Date, to: Date) => {
      const [mat, cun] = await Promise.all([
        prisma.interviewMaterial.aggregate({
          _sum: { duration: true },
          where: { type: { in: ['audio', 'video'] }, status: 'COMPLETED', createdAt: { gte: from, lt: to } },
        }),
        prisma.cunningSession.aggregate({ _sum: { durationSec: true }, where: { createdAt: { gte: from, lt: to } } }),
      ])
      return (mat._sum.duration ?? 0) + (cun._sum.durationSec ?? 0)
    }
    const [d, m] = await Promise.all([sec(p.yesterdayStart, p.todayStart), sec(p.monthStart, p.todayStart)])
    const perSec = toJpy(UNIT_PRICES.assemblyAiHour.usd) / 3600
    return {
      label: 'AssemblyAI（文字起こし）',
      dayJpy: Math.round(d * perSec),
      monthJpy: Math.round(m * perSec),
      basis: '見積り',
      note: `昨日 ${(d / 3600).toFixed(2)}時間。インタビュー素材とドヤカンニングの秒数のみ（社内面談など他の文字起こしは含まない）`,
    }
  } catch (e: any) {
    return { label: 'AssemblyAI（文字起こし）', dayJpy: null, monthJpy: null, basis: '取得できない', note: String(e?.message ?? e).slice(0, 80) }
  }
}

/** Stripe: 決済の売上と手数料（残高の取引から）。返金は引く */
async function stripeRevenue(p: ReturnType<typeof jstPeriods>): Promise<{ block: RevenueBlock; missing?: string }> {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  const none = (note: string, missing?: string) => ({
    block: { dayGross: null, monthGross: null, dayFee: null, monthFee: null, note } as RevenueBlock,
    missing,
  })
  if (!key) return none('STRIPE_SECRET_KEY 未設定', 'STRIPE_SECRET_KEY')
  const sum = async (from: Date, to: Date) => {
    let gross = 0
    let fee = 0
    let after: string | undefined
    for (let page = 0; page < 20; page++) {
      const q = new URLSearchParams({
        'created[gte]': String(Math.floor(from.getTime() / 1000)),
        'created[lt]': String(Math.floor(to.getTime() / 1000)),
        limit: '100',
      })
      if (after) q.set('starting_after', after)
      const res = await fetch(`https://api.stripe.com/v1/balance_transactions?${q}`, {
        headers: { Authorization: `Bearer ${key}` },
      })
      if (!res.ok) throw new Error(`Stripe ${res.status}`)
      const json: any = await res.json()
      for (const t of json.data ?? []) {
        if (t.currency !== 'jpy') continue
        // charge / payment = 入金、refund / payment_refund = 返金（amount は負）。手数料は fee
        if (['charge', 'payment', 'refund', 'payment_refund'].includes(t.type)) {
          gross += Number(t.amount) || 0
          fee += Number(t.fee) || 0
        }
      }
      if (!json.has_more) break
      after = json.data?.[json.data.length - 1]?.id
      if (!after) break
    }
    return { gross, fee }
  }
  try {
    const [d, m] = await Promise.all([sum(p.yesterdayStart, p.todayStart), sum(p.monthStart, p.todayStart)])
    return { block: { dayGross: d.gross, monthGross: m.gross, dayFee: d.fee, monthFee: m.fee } }
  } catch (e: any) {
    return none(`取得に失敗（${String(e?.message ?? e).slice(0, 60)}）`)
  }
}

const PAID_CHANNEL = /^(paid|display|cross-network|affiliate)/i

async function acquisitionBlock(): Promise<{ block: AcquisitionBlock; note?: string; missing?: string }> {
  try {
    const r = await fetchChannelSessionsForCostReport()
    if (!r) return { block: null, note: 'GA4 の対象が未設定（ANALYTICS_REPORT_TARGETS）', missing: 'ANALYTICS_REPORT_TARGETS' }
    const paid = (l: { name: string; sessions: number }[]) => l.filter((c) => PAID_CHANNEL.test(c.name)).reduce((s, c) => s + c.sessions, 0)
    return {
      block: {
        target: r.target,
        paidDay: paid(r.yesterday),
        paidMonth: paid(r.month),
        totalDay: r.yesterday.reduce((s, c) => s + c.sessions, 0),
        channelsDay: r.yesterday.slice(0, 4),
      },
    }
  } catch (e: any) {
    return { block: null, note: `GA4 の取得に失敗（${String(e?.message ?? e).slice(0, 60)}）` }
  }
}

// ---------- 組み立て ----------

export async function buildDailyCostReport(now = new Date()): Promise<DailyCostReport> {
  const p = jstPeriods(now)
  const missingKeys: string[] = []

  const [spend, supabase, vercel, assembly, stripe, acq] = await Promise.all([
    buildSpendReport(now),
    supabaseLines(p),
    vercelLine(p),
    assemblyLine(p),
    stripeRevenue(p),
    acquisitionBlock(),
  ])

  const lines: Line[] = []
  spend.costs.forEach((c, i) => {
    lines.push(fromSpend(c, spend.monthCosts[i]))
    if (!c.money && /ADMIN_KEY/.test(c.note ?? '')) missingKeys.push(c.label === 'Claude API' ? 'ANTHROPIC_ADMIN_KEY' : 'OPENAI_ADMIN_KEY')
  })
  lines.push({
    label: 'Gemini API',
    dayJpy: null,
    monthJpy: null,
    basis: '取得できない',
    note: 'Google Cloud の請求は BigQuery への書き出しが要り、未設定。生成の回数は別のレポートで見る',
  })
  lines.push(...supabase)
  lines.push(vercel.line)
  if (vercel.missing) missingKeys.push(vercel.missing)
  lines.push(assembly)

  if (stripe.missing) missingKeys.push(stripe.missing)
  if (acq.missing) missingKeys.push(acq.missing)

  return {
    dayLabel: p.dayLabel,
    monthLabel: p.monthLabel,
    dayOfMonth: p.dayOfMonth,
    daysInMonth: p.daysInMonth,
    lines,
    revenue: stripe.block,
    acquisition: acq.block,
    acquisitionNote: acq.note,
    missingKeys: Array.from(new Set(missingKeys)),
  }
}

export async function sendDailyCostReport(): Promise<DailyCostReport> {
  const report = await buildDailyCostReport()
  await postPlainToSlack(formatDailyCostReport(report))
  return report
}
