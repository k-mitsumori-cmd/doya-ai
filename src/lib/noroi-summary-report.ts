import {
  makeJwt,
  fetchSalesReport,
  parseTsv,
  aggregateSales,
  convertToJpy,
  appStoreAppId,
  jstNow,
} from '@/lib/appstore-sales-core'
import {
  activeUsers,
  countByCreatedAt,
  countByDrawnOn,
  purchaseSum,
  totalUsers,
} from '@/lib/noroi-supabase'

// ============================================
// 呪い日記 週次／月次まとめレポート（Slack）
//
// - 週次: 毎週月曜の朝に「先週(月〜日)」分
// - 月次: 毎月1日の朝に「先月」分
//
// 内容: App Storeの売上（週次/月次レポート）＋ Supabase期間集計
//   （アクティブ人数/新規/日記/ガチャ/課金）＋ 現在のストア評価
//
// 通知先: SLACK_APPSTORE_MARKETING_WEBHOOK_URL（未設定は SLACK_APPSTORE_WEBHOOK_URL）
// ============================================

const DEFAULT_APP_ID = '6786964992'

function fmtYen(n: number): string {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}
function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('ja-JP')
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** 期間の算出（JST）。weekly=先週(月〜日)、monthly=先月 */
function computePeriod(period: 'weekly' | 'monthly'): {
  startDay: string
  endDayExclusive: string
  label: string
  salesFrequency: 'WEEKLY' | 'MONTHLY'
  salesReportDates: string[]
} {
  const now = jstNow() // JSTのゲッターとして扱う
  if (period === 'weekly') {
    const dow = now.getUTCDay() // 0=日..6=土（JST基準）
    const toThisMonday = (dow + 6) % 7 // 今週月曜までの日数
    const thisMonday = new Date(now)
    thisMonday.setUTCDate(now.getUTCDate() - toThisMonday)
    const lastMonday = new Date(thisMonday)
    lastMonday.setUTCDate(thisMonday.getUTCDate() - 7)
    const lastSunday = new Date(thisMonday)
    lastSunday.setUTCDate(thisMonday.getUTCDate() - 1)
    const prevSunday = new Date(lastSunday)
    prevSunday.setUTCDate(lastSunday.getUTCDate() - 7)
    return {
      startDay: ymd(lastMonday),
      endDayExclusive: ymd(thisMonday),
      label: `${ymd(lastMonday)}〜${ymd(lastSunday)}`,
      salesFrequency: 'WEEKLY',
      // Apple週次は週末日(日曜)キー。取得できない時は前の日曜も試す
      salesReportDates: [ymd(lastSunday), ymd(prevSunday)],
    }
  }
  // monthly
  const firstThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const firstLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const ym = ymd(firstLastMonth).slice(0, 7)
  return {
    startDay: ymd(firstLastMonth),
    endDayExclusive: ymd(firstThisMonth),
    label: ym,
    salesFrequency: 'MONTHLY',
    salesReportDates: [ym],
  }
}

// ---------- 売上（期間） ----------

async function fetchPeriodSales(
  token: string,
  frequency: 'WEEKLY' | 'MONTHLY',
  reportDates: string[],
  appId: string,
): Promise<{ downloads: number; grossJpy: number; proceedsJpy: number; purchaseUnits: number }> {
  for (const d of reportDates) {
    const tsv = await fetchSalesReport(token, d, frequency)
    if (!tsv) continue
    const agg = aggregateSales(parseTsv(tsv), appId)
    const gross = await convertToJpy(agg.grossByCurrency)
    const proceeds = await convertToJpy(agg.proceedsByCurrency)
    return {
      downloads: agg.downloads,
      grossJpy: Math.round(gross.jpyTotal),
      proceedsJpy: Math.round(proceeds.jpyTotal),
      purchaseUnits: agg.purchaseUnits,
    }
  }
  return { downloads: 0, grossJpy: 0, proceedsJpy: 0, purchaseUnits: 0 }
}

// ---------- ストア評価（現在値） ----------

async function currentStoreRating(): Promise<{ rating: number; reviewCount: number } | null> {
  const appId = appStoreAppId()
  const country = (process.env.APPSTORE_MARKETING_COUNTRY || 'jp').trim()
  try {
    const res = await fetch(`https://itunes.apple.com/lookup?id=${appId}&country=${country}`)
    if (!res.ok) return null
    const json = (await res.json()) as any
    const r = json?.results?.[0]
    if (!r) return null
    return { rating: Number(r.averageUserRating) || 0, reviewCount: Number(r.userRatingCount) || 0 }
  } catch {
    return null
  }
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

// ---------- メイン ----------

export type SummaryResult = {
  period: 'weekly' | 'monthly'
  label: string
  downloads: number
  grossJpy: number
  proceedsJpy: number
  activeUsers: number
  newUsers: number
  diaryPosts: number
  gachaDraws: number
  dbRevenueJpy: number
  totalUsers: number
}

export async function sendNoroiSummaryReport(period: 'weekly' | 'monthly'): Promise<SummaryResult> {
  const appId = (process.env.APPSTORE_APP_ID || DEFAULT_APP_ID).trim()
  const p = computePeriod(period)
  const token = makeJwt()

  // App Store 売上（期間）
  const sales = await fetchPeriodSales(token, p.salesFrequency, p.salesReportDates, appId)

  // Supabase 期間集計
  const [au, newUsers, diaryPosts, gacha, purchase, total, rating] = await Promise.all([
    activeUsers(p.startDay, p.endDayExclusive),
    countByCreatedAt('profiles', p.startDay, p.endDayExclusive),
    countByCreatedAt('curse_entries', p.startDay, p.endDayExclusive),
    countByDrawnOn(p.startDay, p.endDayExclusive),
    purchaseSum(p.startDay, p.endDayExclusive),
    totalUsers(),
    currentStoreRating(),
  ])

  const periodJa = period === 'weekly' ? '週次' : '月次'
  const activeJa = period === 'weekly' ? 'WAU（週間アクティブ）' : 'MAU（月間アクティブ）'

  const lines: string[] = []
  lines.push(`呪い日記 ${periodJa}まとめレポート（${p.label}）`)
  lines.push('════════════════')
  lines.push('■ App Store 売上')
  lines.push(`ダウンロード: ${fmtInt(sales.downloads)}件`)
  lines.push(`売上（税込）: ${fmtYen(sales.grossJpy)}／手取り: ${fmtYen(sales.proceedsJpy)}`)
  lines.push('')
  lines.push('■ ユーザー（自前DB実測）')
  lines.push(`${activeJa}: ${fmtInt(au)}人`)
  lines.push(`新規登録: ${fmtInt(newUsers)}人／累計: ${fmtInt(total)}人`)
  lines.push(`日記投稿: ${fmtInt(diaryPosts)}件／ガチャ: ${fmtInt(gacha)}回`)
  lines.push(`アプリ内課金(DB実測): ${fmtYen(purchase.revenueJpy)}（${fmtInt(purchase.count)}件）`)
  lines.push('')
  lines.push('■ ストア評価（現在）')
  if (rating) {
    lines.push(`平均 ★${rating.rating.toFixed(1)}／レビュー ${fmtInt(rating.reviewCount)}件`)
  } else {
    lines.push('取得できませんでした')
  }
  lines.push('')
  lines.push('※ 売上=App Store確定値／課金(DB実測)=自前DB。両者は集計基準が異なり一致しないことがあります。')

  await postSlack(lines.join('\n'))

  return {
    period,
    label: p.label,
    downloads: sales.downloads,
    grossJpy: sales.grossJpy,
    proceedsJpy: sales.proceedsJpy,
    activeUsers: au,
    newUsers,
    diaryPosts,
    gachaDraws: gacha,
    dbRevenueJpy: purchase.revenueJpy,
    totalUsers: total,
  }
}
