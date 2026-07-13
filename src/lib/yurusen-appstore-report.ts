import {
  makeJwt,
  getLatestDailyRows,
  aggregateSales,
  convertToJpy,
  jstDate,
} from '@/lib/appstore-sales-core'

// ============================================
// ゆるせん App Store 日次レポート
//
// 同一 App Store Connect アカウント（Team XD2AQ7L4S3）の売上レポートは
// vendorNumber 単位でアカウント全アプリ分が返るため、呪い日記と同じ ASC 認証
// （APPSTORE_KEY_ID / ISSUER_ID / PRIVATE_KEY / VENDOR_NUMBER）を流用し、
// ゆるせんの Apple Identifier で絞り込む。
//
// 通知先: SLACK_YURUSEN_APPSTORE_WEBHOOK_URL
// ============================================

/** ゆるせんの ascAppId（App Store Connect のアプリID） */
const YURUSEN_APP_ID = '6789815785'

function fmtYen(n: number): string {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('ja-JP')
}

async function postSlack(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_YURUSEN_APPSTORE_WEBHOOK_URL
  if (!webhookUrl) {
    throw new Error('SLACK_YURUSEN_APPSTORE_WEBHOOK_URL is not set')
  }
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    throw new Error(`Slack webhook error: ${res.status} ${await res.text().catch(() => '')}`)
  }
}

function unconvertedNote(...maps: Map<string, number>[]): string {
  const currencies = new Set<string>()
  for (const m of maps) for (const c of m.keys()) currencies.add(c)
  if (currencies.size === 0) return ''
  return `\n※ ${[...currencies].join('/')} はレート未取得のため円換算に含めていません。`
}

export type YurusenAppStoreReportResult = {
  reportDate: string | null
  downloads: number
  grossJpy: number
  proceedsJpy: number
  purchaseUnits: number
}

/**
 * 直近の取得可能日（1〜3日前）の App Store 日次データからゆるせん分を集計して Slack 通知する。
 * @param opts.date 明示日付（YYYY-MM-DD）。手動テスト用。未指定なら自動で最新日を探す
 */
export async function sendYurusenAppStoreReport(
  opts: { date?: string } = {},
): Promise<YurusenAppStoreReportResult> {
  const token = makeJwt()
  const latest = await getLatestDailyRows(token, opts.date)

  if (!latest) {
    // 直近日ともデータ無し（アカウント全体で売上0の日は ASC が 404 を返す）。
    const first = opts.date ?? jstDate(1)
    await postSlack(
      `ゆるせん App Store 日次レポート（${first} 分）\n────────────────\nダウンロード: 0件\n売上: ¥0\n\n※ 直近に記録された売上・ダウンロードはありませんでした（Apple側の集計待ち、または未公開のため）。`,
    )
    return { reportDate: null, downloads: 0, grossJpy: 0, proceedsJpy: 0, purchaseUnits: 0 }
  }

  const agg = aggregateSales(latest.rows, YURUSEN_APP_ID)
  const gross = await convertToJpy(agg.grossByCurrency)
  const proceeds = await convertToJpy(agg.proceedsByCurrency)

  const lines: string[] = []
  lines.push(`ゆるせん App Store 日次レポート（${latest.reportDate} 分）`)
  lines.push('────────────────')
  lines.push(`ダウンロード: ${fmtInt(agg.downloads)}件（新規インストール）`)
  lines.push('')
  lines.push(`売上（税込・ユーザー支払額）: ${fmtYen(gross.jpyTotal)}`)
  lines.push(`手取り（Apple手数料差引後）: ${fmtYen(proceeds.jpyTotal)}`)
  lines.push(`購入件数: ${fmtInt(agg.purchaseUnits)}件`)

  lines.push('')
  lines.push('※ 金額は円換算（当日レート）。JPY以外の売上は取得レートで換算しています。')
  const note = unconvertedNote(gross.unconverted, proceeds.unconverted)
  if (note) lines.push(note.trim())

  await postSlack(lines.join('\n'))

  return {
    reportDate: latest.reportDate,
    downloads: agg.downloads,
    grossJpy: Math.round(gross.jpyTotal),
    proceedsJpy: Math.round(proceeds.jpyTotal),
    purchaseUnits: agg.purchaseUnits,
  }
}
