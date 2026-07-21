import { gunzipSync } from 'zlib'
import { makeJwt, appStoreAppId, parseTsv, num, jstDate } from '@/lib/appstore-sales-core'

// ============================================
// 呪い日記 App Store 流入経路（Source Type）日次レポート
//   App Store Connect Analytics Reports API → Slack
//
// これは Sales Reports API（appstore-report.ts）とは別系統の「新しい」
// Analytics Reports API を使う。事前に ONGOING の analyticsReportRequest を
// 1件作成済み（Apple 側で初回レポート生成に 1〜2 日かかる）。
//
// フロー（すべて base = https://api.appstoreconnect.apple.com）:
//  1. GET /v1/apps/{appId}/analyticsReportRequests
//       → accessType==='ONGOING' かつ非 stoppedDueToInactivity を選ぶ
//  2. GET /v1/analyticsReportRequests/{reqId}/reports?filter[category]=APP_STORE_ENGAGEMENT
//       → category=APP_STORE_ENGAGEMENT かつ name に "Discovery and Engagement" を含むものを選ぶ
//  3. GET /v1/analyticsReports/{reportId}/instances?filter[granularity]=DAILY
//       → processingDate が最新の DAILY インスタンスを選ぶ
//  4. GET /v1/analyticsReportInstances/{instanceId}/segments
//       → 各 segment の url（gzip TSV）をダウンロード・解凍・パース
//  5. Source Type ごとに impressions / product page views / downloads を集計。
//     Web Referrer のドメイン列があれば上位ドメインも内訳表示（X=t.co / IG=instagram.com など）
//
// レポート未生成時（instance/segment が空）は crash せず「生成待ち」ノートを投稿。
//
// 認証: APPSTORE_KEY_ID / APPSTORE_ISSUER_ID / APPSTORE_PRIVATE_KEY（ES256, aud=appstoreconnect-v1）
// 通知先: SLACK_APPSTORE_SOURCE_WEBHOOK_URL（未設定なら SLACK_APPSTORE_WEBHOOK_URL）
// ============================================

const ASC_BASE = 'https://api.appstoreconnect.apple.com'

// ---------- JSON API 取得（ページング） ----------

type JsonResource = {
  type: string
  id: string
  attributes?: Record<string, any>
}
type JsonListResponse = {
  data?: JsonResource[]
  links?: { next?: string | null }
}

/** ASC JSON API を GET（links.next を辿って全ページ結合） */
async function ascGetAll(token: string, urlOrPath: string): Promise<JsonResource[]> {
  const out: JsonResource[] = []
  let url = urlOrPath.startsWith('http') ? urlOrPath : `${ASC_BASE}${urlOrPath}`
  let guard = 0
  while (url && guard < 50) {
    guard++
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`ASC Analytics API error ${res.status} for ${url}: ${text.slice(0, 300)}`)
    }
    const json = (await res.json()) as JsonListResponse
    if (Array.isArray(json.data)) out.push(...json.data)
    url = json.links?.next || ''
  }
  return out
}

// ---------- TSV の列アクセス（大文字小文字・ゆらぎ吸収） ----------

/** row から候補名（case-insensitive・部分一致含む）で最初に一致した値を返す */
function pick(row: Record<string, string>, candidates: string[]): string | undefined {
  const keys = Object.keys(row)
  for (const cand of candidates) {
    const lc = cand.toLowerCase()
    // 完全一致優先
    const exact = keys.find((k) => k.toLowerCase() === lc)
    if (exact) return row[exact]
  }
  for (const cand of candidates) {
    const lc = cand.toLowerCase()
    const partial = keys.find((k) => k.toLowerCase().includes(lc))
    if (partial) return row[partial]
  }
  return undefined
}

// ---------- 集計 ----------

type SourceAgg = {
  impressions: number
  ppViews: number
  downloads: number
}

export type SourceReportResult = {
  status: 'ok' | 'pending' | 'no-request'
  processingDate: string | null
  bySourceType: Record<string, SourceAgg>
  topReferrerDomains: Array<{ domain: string; downloads: number }>
  reportName?: string
}

const IMPRESSION_COLS = ['Impressions', 'Impressions Unique Device', 'Total Impressions']
const PP_VIEW_COLS = ['Product Page Views', 'Product Page Views Unique Device', 'Page Views']
const DOWNLOAD_COLS = ['Total Downloads', 'Downloads', 'First-Time Downloads', 'Redownloads']
const SOURCE_TYPE_COLS = ['Source Type', 'SourceType']
// Web Referrer のドメイン内訳に使える可能性のある列（存在すれば利用）
const REFERRER_DOMAIN_COLS = ['Referrer Domain', 'Domain Referrer', 'Web Referrer', 'Domain']

function aggregateSegmentRows(
  rows: Record<string, string>[],
  bySourceType: Map<string, SourceAgg>,
  byDomain: Map<string, number>,
): void {
  for (const row of rows) {
    const sourceType = (pick(row, SOURCE_TYPE_COLS) || 'Unavailable').trim() || 'Unavailable'
    const impressions = num(pick(row, IMPRESSION_COLS))
    const ppViews = num(pick(row, PP_VIEW_COLS))
    const downloads = num(pick(row, DOWNLOAD_COLS))

    const cur = bySourceType.get(sourceType) || { impressions: 0, ppViews: 0, downloads: 0 }
    cur.impressions += impressions
    cur.ppViews += ppViews
    cur.downloads += downloads
    bySourceType.set(sourceType, cur)

    // Web Referrer のドメイン内訳（列が存在する場合のみ）
    if (/web\s*referrer/i.test(sourceType)) {
      const domain = (pick(row, REFERRER_DOMAIN_COLS) || '').trim()
      if (domain && domain.toLowerCase() !== sourceType.toLowerCase()) {
        byDomain.set(domain, (byDomain.get(domain) || 0) + (downloads || ppViews || impressions))
      }
    }
  }
}

// ---------- Slack ----------

async function postSlack(text: string): Promise<void> {
  const webhookUrl =
    process.env.SLACK_APPSTORE_SOURCE_WEBHOOK_URL || process.env.SLACK_APPSTORE_WEBHOOK_URL
  if (!webhookUrl) throw new Error('Slack webhook URL is not set（SLACK_APPSTORE_WEBHOOK_URL）')
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

/** Source Type の英語表記 → 日本語ラベル */
const SOURCE_LABELS: Record<string, string> = {
  'App Store Search': 'App Store 検索',
  'App Store Browse': 'App Store ブラウズ',
  'App Referrer': 'アプリ経由',
  'Web Referrer': 'Web 経由',
  'Institutional Purchase': '法人一括購入',
  Unavailable: '不明',
}
function sourceLabel(s: string): string {
  return SOURCE_LABELS[s] ?? s
}

// ---------- メイン ----------

/**
 * Analytics Reports API から「App Store Discovery and Engagement」の最新 DAILY を
 * 取得し、Source Type（流入経路）別に集計して Slack 通知する。
 * レポート未生成時は「生成待ち」ノートを投稿して pending を返す（crash しない）。
 */
export async function sendAppStoreSourceReport(): Promise<SourceReportResult> {
  const appId = appStoreAppId()
  const token = makeJwt()

  // 1) ONGOING の analyticsReportRequest を選ぶ
  const requests = await ascGetAll(
    token,
    `/v1/apps/${appId}/analyticsReportRequests?limit=50`,
  )
  const ongoing = requests.find(
    (r) =>
      (r.attributes?.accessType || '').toUpperCase() === 'ONGOING' &&
      r.attributes?.stoppedDueToInactivity !== true,
  )
  if (!ongoing) {
    console.warn(
      '[appstore-source-report] ONGOING analyticsReportRequest が見つかりません。',
      requests.map((r) => ({ id: r.id, accessType: r.attributes?.accessType })),
    )
    await postSlack(
      '呪い日記 流入経路レポート: ONGOING の Analytics Report Request が見つかりません（要確認）。',
    )
    return { status: 'no-request', processingDate: null, bySourceType: {}, topReferrerDomains: [] }
  }

  // 2) Discovery and Engagement レポートを選ぶ
  const reports = await ascGetAll(
    token,
    `/v1/analyticsReportRequests/${ongoing.id}/reports?filter[category]=APP_STORE_ENGAGEMENT&limit=200`,
  )
  const engagementReports = reports.filter(
    (r) => (r.attributes?.category || '').toUpperCase() === 'APP_STORE_ENGAGEMENT',
  )
  const target =
    engagementReports.find((r) =>
      /discovery and engagement/i.test(String(r.attributes?.name || '')),
    ) ||
    engagementReports[0] ||
    reports[0]

  if (!target) {
    console.warn(
      '[appstore-source-report] 対象レポートが見つかりません。利用可能なレポート一覧:',
      reports.map((r) => ({ name: r.attributes?.name, category: r.attributes?.category })),
    )
    await postSlack(
      '呪い日記 流入経路レポート: 「Discovery and Engagement」レポートがまだ生成されていません（Apple 側で生成待ち・1〜2 日）。',
    )
    return { status: 'pending', processingDate: null, bySourceType: {}, topReferrerDomains: [] }
  }
  const reportName = String(target.attributes?.name || target.id)

  // 3) 最新の DAILY インスタンスを選ぶ
  const instances = await ascGetAll(
    token,
    `/v1/analyticsReports/${target.id}/instances?filter[granularity]=DAILY&limit=200`,
  )
  const dailyInstances = instances
    .filter((i) => (i.attributes?.granularity || '').toUpperCase() === 'DAILY')
    .sort((a, b) =>
      String(b.attributes?.processingDate || '').localeCompare(
        String(a.attributes?.processingDate || ''),
      ),
    )
  const latest = dailyInstances[0]
  if (!latest) {
    console.warn(
      `[appstore-source-report] "${reportName}" に DAILY インスタンスがまだありません（生成待ち）。`,
    )
    await postSlack(
      `呪い日記 流入経路レポート: 「${reportName}」の日次データがまだ生成されていません（Apple 側で生成待ち・1〜2 日）。`,
    )
    return {
      status: 'pending',
      processingDate: null,
      bySourceType: {},
      topReferrerDomains: [],
      reportName,
    }
  }
  const processingDate = String(latest.attributes?.processingDate || '')

  // 4) segments を取得して gzip TSV をダウンロード・パース
  const segments = await ascGetAll(
    token,
    `/v1/analyticsReportInstances/${latest.id}/segments?limit=200`,
  )
  if (segments.length === 0) {
    await postSlack(
      `呪い日記 流入経路レポート（${processingDate}）: セグメント（データ本体）がまだ準備できていません（生成待ち）。`,
    )
    return {
      status: 'pending',
      processingDate,
      bySourceType: {},
      topReferrerDomains: [],
      reportName,
    }
  }

  const bySourceType = new Map<string, SourceAgg>()
  const byDomain = new Map<string, number>()
  let headerSample = ''
  for (const seg of segments) {
    const url = seg.attributes?.url
    if (!url) continue
    // segment.url は署名付きURL → 認証ヘッダは付けない
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[appstore-source-report] segment ダウンロード失敗 ${res.status}: ${url}`)
      continue
    }
    const buf = Buffer.from(await res.arrayBuffer())
    let tsv: string
    try {
      tsv = gunzipSync(buf).toString('utf8')
    } catch {
      // 稀に非圧縮で返る場合の保険
      tsv = buf.toString('utf8')
    }
    if (!headerSample) headerSample = tsv.split('\n')[0] || ''
    const rows = parseTsv(tsv)
    aggregateSegmentRows(rows, bySourceType, byDomain)
  }

  // 列名は best-effort のため、実データの見出し行をログに残す（初回データ後の調整用）
  console.log(`[appstore-source-report] report="${reportName}" date=${processingDate} header=${headerSample}`)

  const topReferrerDomains = [...byDomain.entries()]
    .map(([domain, downloads]) => ({ domain, downloads }))
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, 8)

  // ---- メッセージ整形 ----
  const lines: string[] = []
  lines.push(`呪い日記 流入経路（Source Type）日次レポート（${processingDate} 分）`)
  lines.push('────────────────')

  const sorted = [...bySourceType.entries()].sort((a, b) => b[1].downloads - a[1].downloads)
  if (sorted.length === 0) {
    lines.push('この日の流入データはありませんでした。')
  } else {
    const totalDl = sorted.reduce((s, [, v]) => s + v.downloads, 0)
    for (const [src, agg] of sorted) {
      const share = totalDl > 0 ? Math.round((agg.downloads / totalDl) * 1000) / 10 : 0
      lines.push(
        `${sourceLabel(src)}: 表示 ${fmt(agg.impressions)} / ページ閲覧 ${fmt(agg.ppViews)} / DL ${fmt(agg.downloads)}` +
          (totalDl > 0 ? `（DL比 ${share}%）` : ''),
      )
    }
    lines.push('')
    lines.push(`DL合計: ${fmt(totalDl)}`)
  }

  if (topReferrerDomains.length > 0) {
    lines.push('')
    lines.push('Web 経由の参照元ドメイン（上位）:')
    for (const { domain, downloads } of topReferrerDomains) {
      lines.push(`　・${domain}: ${fmt(downloads)}`)
    }
  }

  lines.push('')
  lines.push('※ Analytics Reports API（Discovery and Engagement）の集計。列名は実データに合わせ調整余地あり。')

  await postSlack(lines.join('\n'))

  const bySourceTypeObj: Record<string, SourceAgg> = {}
  for (const [k, v] of bySourceType) bySourceTypeObj[k] = v

  return {
    status: 'ok',
    processingDate,
    bySourceType: bySourceTypeObj,
    topReferrerDomains,
    reportName,
  }
}
