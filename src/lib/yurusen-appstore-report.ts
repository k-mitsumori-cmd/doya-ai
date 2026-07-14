import {
  makeJwt,
  getLatestDailyRows,
  getDailyAggregateForDate,
  aggregateSales,
  previousDate,
  jstDate,
} from '@/lib/appstore-sales-core'
import {
  buildDailyMessage,
  aggregateToDailyStats,
  zeroDailyStats,
} from '@/lib/appstore-daily-format'

// ============================================
// ゆるせん App Store 日次レポート
//
// 同一 App Store Connect アカウント（Team XD2AQ7L4S3）の売上レポートは
// vendorNumber 単位でアカウント全アプリ分が返るため、呪い日記と同じ ASC 認証
// （APPSTORE_KEY_ID / ISSUER_ID / PRIVATE_KEY / VENDOR_NUMBER）を流用し、
// ゆるせんの Apple Identifier で絞り込む。
//
// 数値の取得・集計は共通コア、メッセージ整形（前日比つき）は appstore-daily-format.ts。
// 通知先: SLACK_YURUSEN_APPSTORE_WEBHOOK_URL
// ============================================

/** ゆるせんの ascAppId（App Store Connect のアプリID） */
const YURUSEN_APP_ID = '6789815785'

/** IAP 製品IDの末尾 → 日本語表示名。未知のものは SKU 末尾を表示 */
const IAP_NAMES: Record<string, string> = {}

function skuLabel(sku: string): string {
  const suffix = sku.split('.').pop() || sku
  return IAP_NAMES[suffix] ?? suffix
}

async function postSlack(text: string): Promise<void> {
  // 専用チャンネルが未設定なら共通の App Store 通知チャンネルにフォールバック
  const webhookUrl =
    process.env.SLACK_YURUSEN_APPSTORE_WEBHOOK_URL || process.env.SLACK_APPSTORE_WEBHOOK_URL
  if (!webhookUrl) {
    throw new Error(
      'SLACK_YURUSEN_APPSTORE_WEBHOOK_URL / SLACK_APPSTORE_WEBHOOK_URL がいずれも未設定です',
    )
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

export type YurusenAppStoreReportResult = {
  reportDate: string | null
  downloads: number
  grossJpy: number
  proceedsJpy: number
  purchaseUnits: number
}

/**
 * 直近の取得可能日（1〜3日前）の App Store 日次データからゆるせん分を集計し、
 * 前日比つきのわかりやすいメッセージで Slack 通知する。
 * @param opts.date 明示日付（YYYY-MM-DD）。手動テスト用。未指定なら自動で最新日を探す
 */
export async function sendYurusenAppStoreReport(
  opts: { date?: string } = {},
): Promise<YurusenAppStoreReportResult> {
  const token = makeJwt()
  const latest = await getLatestDailyRows(token, opts.date)

  // 直近日ともデータ無し（アカウント全体で売上0の日は ASC が 404）→ 0件レポート
  if (!latest) {
    const first = opts.date ?? jstDate(1)
    await postSlack(
      buildDailyMessage({
        appLabel: 'ゆるせん',
        reportDate: first,
        today: zeroDailyStats(),
        prev: null,
        prevDate: null,
        skuLabel,
        noData: true,
      }),
    )
    return { reportDate: null, downloads: 0, grossJpy: 0, proceedsJpy: 0, purchaseUnits: 0 }
  }

  const today = await aggregateToDailyStats(aggregateSales(latest.rows, YURUSEN_APP_ID))

  // 前日（reportDate の1日前）を取得して前日比に使う。取得できなければ比較を省略。
  const prevDate = previousDate(latest.reportDate)
  const prevAgg = await getDailyAggregateForDate(token, prevDate, YURUSEN_APP_ID)
  const prev = prevAgg ? await aggregateToDailyStats(prevAgg) : null

  await postSlack(
    buildDailyMessage({
      appLabel: 'ゆるせん',
      reportDate: latest.reportDate,
      today,
      prev,
      prevDate: prev ? prevDate : null,
      skuLabel,
    }),
  )

  return {
    reportDate: latest.reportDate,
    downloads: today.downloads,
    grossJpy: today.grossJpy,
    proceedsJpy: today.proceedsJpy,
    purchaseUnits: today.purchaseUnits,
  }
}
