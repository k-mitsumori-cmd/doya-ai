import {
  makeJwt,
  getLatestDailyRows,
  convertToJpy,
  appStoreAppId,
  num,
  jstDate,
  type SalesRow,
} from '@/lib/appstore-sales-core'

// ============================================
// 呪い日記 App Store 国別 日次レポート（毎朝・別便）
//
// 日次売上レポートを「国(Country Code)」ごとに集計し、DL数・課金額（円換算）を通知。
// データ源は既存の売上レポートと同じ（同じ1回のレポートを別の切り口で集計）。
//
// 通知先: SLACK_APPSTORE_COUNTRY_WEBHOOK_URL（未設定は SLACK_APPSTORE_WEBHOOK_URL）
// ============================================

const COUNTRY_NAMES: Record<string, string> = {
  JP: '日本',
  CN: '中国',
  US: '米国',
  TW: '台湾',
  KR: '韓国',
  HK: '香港',
  GB: '英国',
  DE: 'ドイツ',
  FR: 'フランス',
  CA: 'カナダ',
  AU: 'オーストラリア',
  TH: 'タイ',
  SG: 'シンガポール',
  MY: 'マレーシア',
  ID: 'インドネシア',
  PH: 'フィリピン',
  VN: 'ベトナム',
  IN: 'インド',
  BR: 'ブラジル',
  MX: 'メキシコ',
  ES: 'スペイン',
  IT: 'イタリア',
}

function countryLabel(code: string): string {
  return COUNTRY_NAMES[code] ? `${COUNTRY_NAMES[code]}(${code})` : code || '不明'
}

function fmtYen(n: number): string {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}
function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('ja-JP')
}

async function postSlack(text: string): Promise<void> {
  const webhookUrl =
    process.env.SLACK_APPSTORE_COUNTRY_WEBHOOK_URL || process.env.SLACK_APPSTORE_WEBHOOK_URL
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

type CountryAgg = {
  downloads: number
  grossByCurrency: Map<string, number>
}

function aggregateByCountry(rows: SalesRow[], appId: string): Map<string, CountryAgg> {
  const map = new Map<string, CountryAgg>()
  for (const row of rows) {
    const rowAppId = row['Apple Identifier'] || ''
    if (appId && rowAppId && rowAppId !== appId) continue
    const units = num(row['Units'])
    if (units <= 0) continue
    const country = row['Country Code'] || '不明'
    const productType = (row['Product Type Identifier'] || '').toUpperCase()
    const isInApp = productType.startsWith('IA')
    const isUpdate = productType.startsWith('7')
    const customerPrice = num(row['Customer Price'])
    const customerCurrency = row['Customer Currency'] || 'JPY'

    const cur = map.get(country) || { downloads: 0, grossByCurrency: new Map() }
    if (!isInApp && !isUpdate) cur.downloads += units
    if (customerPrice > 0) {
      cur.grossByCurrency.set(
        customerCurrency,
        (cur.grossByCurrency.get(customerCurrency) || 0) + customerPrice * units,
      )
    }
    map.set(country, cur)
  }
  return map
}

export type CountryReportResult = {
  reportDate: string | null
  countries: { code: string; downloads: number; revenueJpy: number }[]
}

export async function sendAppStoreCountryReport(
  opts: { date?: string } = {},
): Promise<CountryReportResult> {
  const appId = appStoreAppId()
  const token = makeJwt()
  const latest = await getLatestDailyRows(token, opts.date)

  if (!latest) {
    const d = opts.date || jstDate(1)
    await postSlack(
      `呪い日記 App Store 国別レポート（${d} 分）\n────────────────\n記録された売上・ダウンロードはありませんでした（0件、またはApple側の集計待ち）。`,
    )
    return { reportDate: null, countries: [] }
  }

  const byCountry = aggregateByCountry(latest.rows, appId)

  // 各国を JPY 換算
  const results: { code: string; downloads: number; revenueJpy: number }[] = []
  for (const [code, agg] of byCountry) {
    const conv = await convertToJpy(agg.grossByCurrency)
    results.push({ code, downloads: agg.downloads, revenueJpy: Math.round(conv.jpyTotal) })
  }
  // DL数→売上の順でソート
  results.sort((a, b) => b.downloads - a.downloads || b.revenueJpy - a.revenueJpy)

  const totalDl = results.reduce((s, r) => s + r.downloads, 0)
  const totalRev = results.reduce((s, r) => s + r.revenueJpy, 0)

  // ---- メッセージ ----
  const lines: string[] = []
  lines.push(`呪い日記 App Store 国別レポート（${latest.reportDate} 分）`)
  lines.push('────────────────')
  lines.push(`合計: DL ${fmtInt(totalDl)}件／課金 ${fmtYen(totalRev)}`)
  lines.push('')

  if (results.length === 0) {
    lines.push('国別データはありませんでした（0件）。')
  } else {
    const TOP = 10
    const top = results.slice(0, TOP)
    for (const r of top) {
      lines.push(`${countryLabel(r.code)}: DL ${fmtInt(r.downloads)}件／課金 ${fmtYen(r.revenueJpy)}`)
    }
    if (results.length > TOP) {
      const rest = results.slice(TOP)
      const rdl = rest.reduce((s, r) => s + r.downloads, 0)
      const rrev = rest.reduce((s, r) => s + r.revenueJpy, 0)
      lines.push(`その他${rest.length}カ国: DL ${fmtInt(rdl)}件／課金 ${fmtYen(rrev)}`)
    }
  }
  lines.push('')
  lines.push('※ 課金額は各国通貨を当日レートで円換算。DLは新規インストール。')

  await postSlack(lines.join('\n'))
  return { reportDate: latest.reportDate, countries: results }
}
