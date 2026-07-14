import {
  makeJwt,
  getLatestDailyRows,
  getDailyAggregateForDate,
  aggregateSales,
  appStoreAppId,
  previousDate,
  jstDate,
} from '@/lib/appstore-sales-core'
import {
  buildDailyMessage,
  aggregateToDailyStats,
  zeroDailyStats,
} from '@/lib/appstore-daily-format'

// ============================================
// 呪い日記 App Store 日次レポート（App Store Connect → Slack）
//
// 数値の取得・集計・円換算は共通コア（appstore-sales-core.ts）に集約。
// メッセージ整形（前日比つき・わかりやすい文面）は appstore-daily-format.ts に集約。
// このファイルは「呪い日記」固有の設定だけを持つ:
//   - 対象アプリ（APPSTORE_APP_ID、既定=呪い日記 ascAppId 6786964992）
//   - IAP（課金アイテム）の日本語表示名
//   - 通知先 SLACK_APPSTORE_WEBHOOK_URL
//
// データの注意: App Store Connect の Sales Report は「前日ぶんが翌日以降」に確定する。
// 直近日は 404（未生成 or 売上0）になるため、共通コアが 1→2→3 日前の順に最新日を探す。
// ============================================

/** IAP 製品IDの末尾 → 日本語表示名（呪い日記 STORE.md 準拠）。未知のものは生SKU表示 */
const IAP_NAMES: Record<string, string> = {
  credits_small: '呪詛の小瓶',
  credits_medium: '呪詛の壺',
  credits_large: '呪詛の大甕',
  shinigami_pact: '呪詛の大釜',
}

function skuLabel(sku: string): string {
  const suffix = sku.split('.').pop() || sku
  return IAP_NAMES[suffix] ?? sku
}

// ---------- Slack ----------

async function postSlack(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_APPSTORE_WEBHOOK_URL
  if (!webhookUrl) {
    throw new Error('SLACK_APPSTORE_WEBHOOK_URL is not set')
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

// ---------- メイン ----------

export type AppStoreReportResult = {
  reportDate: string | null
  downloads: number
  grossJpy: number
  proceedsJpy: number
  purchaseUnits: number
}

/**
 * 直近の取得可能日（1〜3日前）の App Store 日次データを集計し、
 * 前日比つきのわかりやすいメッセージで Slack に通知する。
 * @param opts.date 明示日付（YYYY-MM-DD）。手動テスト用。未指定なら自動で最新日を探す
 */
export async function sendAppStoreReport(
  opts: { date?: string } = {},
): Promise<AppStoreReportResult> {
  const appId = appStoreAppId()
  const token = makeJwt()

  const latest = await getLatestDailyRows(token, opts.date)

  // 直近日ともデータ無し（アカウント全体で売上0の日は ASC が 404）→ 0件レポート
  if (!latest) {
    const first = opts.date ?? jstDate(1)
    await postSlack(
      buildDailyMessage({
        appLabel: '呪い日記',
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

  const today = await aggregateToDailyStats(aggregateSales(latest.rows, appId))

  // 前日（reportDate の1日前）を取得して前日比に使う。取得できなければ比較を省略。
  const prevDate = previousDate(latest.reportDate)
  const prevAgg = await getDailyAggregateForDate(token, prevDate, appId)
  const prev = prevAgg ? await aggregateToDailyStats(prevAgg) : null

  await postSlack(
    buildDailyMessage({
      appLabel: '呪い日記',
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
