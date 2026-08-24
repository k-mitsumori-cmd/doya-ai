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
/**
 * 指定カテゴリのレポートから名前が一致するものを選び、最新（または指定日）の DAILY
 * インスタンスの全セグメントを取得してパース済みの行を返す。
 * まだ生成されていなければ null。
 */
async function loadDailyRows(
  token: string,
  requestId: string,
  category: string,
  namePattern: RegExp,
  wantDate?: string,
): Promise<{ reportName: string; processingDate: string; rows: Record<string, string>[]; header: string } | null> {
  const reports = await ascGetAll(
    token,
    `/v1/analyticsReportRequests/${requestId}/reports?filter[category]=${category}&limit=200`,
  )
  const target = reports.find((r) => namePattern.test(String(r.attributes?.name || '')))
  if (!target) {
    console.warn(
      `[appstore-source-report] ${category} に ${namePattern} 該当レポートなし:`,
      reports.map((r) => r.attributes?.name),
    )
    return null
  }
  const reportName = String(target.attributes?.name || target.id)

  const instances = await ascGetAll(
    token,
    `/v1/analyticsReports/${target.id}/instances?filter[granularity]=DAILY&limit=200`,
  )
  const daily = instances
    .filter((i) => (i.attributes?.granularity || '').toUpperCase() === 'DAILY')
    .sort((a, b) =>
      String(b.attributes?.processingDate || '').localeCompare(
        String(a.attributes?.processingDate || ''),
      ),
    )
  const inst = wantDate
    ? daily.find((i) => String(i.attributes?.processingDate || '') === wantDate)
    : daily[0]
  if (!inst) return null
  const processingDate = String(inst.attributes?.processingDate || '')

  const segments = await ascGetAll(token, `/v1/analyticsReportInstances/${inst.id}/segments?limit=200`)
  const rows: Record<string, string>[] = []
  let header = ''
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
    if (!header) header = tsv.split('\n')[0] || ''
    rows.push(...parseTsv(tsv))
  }
  if (segments.length === 0) return null
  return { reportName, processingDate, rows, header }
}

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
//
// 実データ（2026-08 実測）の構造:
//   Discovery and Engagement Standard … Date/Event/Page Type/Source Type/Engagement Type/
//                                       Device/Platform Version/Territory/Counts/Unique Counts
//                                       Event は Impression / Page view / Tap
//   App Downloads Standard（COMMERCE） … Date/Download Type/App Version/Device/Platform Version/
//                                       Source Type/Page Type/Pre-Order/Territory/Counts
//                                       Download Type は First-time download / Redownload
//
// つまり「表示・閲覧」と「ダウンロード」は別レポートで、どちらも Counts 列に値が入る
// イベント型の縦持ち。以前は 1 レポートに Downloads 列がある前提で読んでいたため
// DL が常に 0 になっていた。

type SourceAgg = {
  impressions: number
  ppViews: number
  taps: number
  /** 初回ダウンロード（新規インストール） */
  downloads: number
  /** 再ダウンロード（同一Apple IDの入れ直し） */
  redownloads: number
}

export type SourceReportResult = {
  status: 'ok' | 'pending' | 'no-request'
  processingDate: string | null
  bySourceType: Record<string, SourceAgg>
  topReferrerDomains: Array<{ domain: string; downloads: number }>
  reportName?: string
}

function emptyAgg(): SourceAgg {
  return { impressions: 0, ppViews: 0, taps: 0, downloads: 0, redownloads: 0 }
}

const SOURCE_TYPE_COLS = ['Source Type', 'SourceType']
const COUNTS_COLS = ['Counts', 'Count']
const EVENT_COLS = ['Event']
const DOWNLOAD_TYPE_COLS = ['Download Type', 'DownloadType']
// Web referrer のドメイン内訳に使える可能性のある列（Standard には無い。Detailed 用の保険）
const REFERRER_DOMAIN_COLS = ['Referrer Domain', 'Domain Referrer', 'Web Referrer', 'Domain']

function getAgg(map: Map<string, SourceAgg>, sourceType: string): SourceAgg {
  const key = sourceType.trim() || 'Unavailable'
  const cur = map.get(key) || emptyAgg()
  map.set(key, cur)
  return cur
}

/** Discovery and Engagement（Event × Counts）を Source Type 別に積む */
function aggregateEngagementRows(
  rows: Record<string, string>[],
  bySourceType: Map<string, SourceAgg>,
  byDomain: Map<string, number>,
): void {
  for (const row of rows) {
    const sourceType = (pick(row, SOURCE_TYPE_COLS) || 'Unavailable').trim() || 'Unavailable'
    const event = (pick(row, EVENT_COLS) || '').trim().toLowerCase()
    const counts = num(pick(row, COUNTS_COLS))
    if (counts === 0) continue

    const agg = getAgg(bySourceType, sourceType)
    if (event.startsWith('impression')) agg.impressions += counts
    else if (event.startsWith('page view')) agg.ppViews += counts
    else if (event.startsWith('tap')) agg.taps += counts

    // Detailed レポートを使う場合のみドメイン列が存在する
    if (/web\s*referrer/i.test(sourceType)) {
      const domain = (pick(row, REFERRER_DOMAIN_COLS) || '').trim()
      if (domain && domain.toLowerCase() !== sourceType.toLowerCase()) {
        byDomain.set(domain, (byDomain.get(domain) || 0) + counts)
      }
    }
  }
}

/** App Downloads（Download Type × Counts）を Source Type 別に積む */
function aggregateDownloadRows(
  rows: Record<string, string>[],
  bySourceType: Map<string, SourceAgg>,
): void {
  for (const row of rows) {
    const sourceType = (pick(row, SOURCE_TYPE_COLS) || 'Unavailable').trim() || 'Unavailable'
    const dlType = (pick(row, DOWNLOAD_TYPE_COLS) || '').trim().toLowerCase()
    const counts = num(pick(row, COUNTS_COLS))
    if (counts === 0) continue

    const agg = getAgg(bySourceType, sourceType)
    if (dlType.startsWith('redownload')) agg.redownloads += counts
    else agg.downloads += counts
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
  if (SOURCE_LABELS[s]) return SOURCE_LABELS[s]
  // 実データは 'App Store search' のように小文字混じりで来るため大小を無視して引き直す
  const hit = Object.keys(SOURCE_LABELS).find((k) => k.toLowerCase() === s.toLowerCase())
  return hit ? SOURCE_LABELS[hit] : s
}

// ---------- メイン ----------

/**
 * Analytics Reports API から「App Store Discovery and Engagement」の最新 DAILY を
 * 取得し、Source Type（流入経路）別に集計して Slack 通知する。
 * レポート未生成時は「生成待ち」ノートを投稿して pending を返す（crash しない）。
 */
export async function sendAppStoreSourceReport(
  opts: { deliver?: boolean; appId?: string; appLabel?: string } = {},
): Promise<SourceReportResult> {
  const deliver = opts.deliver !== false
  const appId = opts.appId || appStoreAppId()
  const appLabel = opts.appLabel || '呪い日記'
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
    if (deliver) await postSlack(
      `${appLabel} 流入経路レポート: ONGOING の Analytics Report Request が見つかりません（要確認）。`,
    )
    return { status: 'no-request', processingDate: null, bySourceType: {}, topReferrerDomains: [] }
  }

  // 2) 表示・閲覧（Discovery and Engagement）を読む
  const eng = await loadDailyRows(
    token,
    ongoing.id,
    'APP_STORE_ENGAGEMENT',
    /discovery and engagement standard/i,
  )
  if (!eng) {
    if (deliver)
      await postSlack(
        `${appLabel} 流入経路レポート: 「App Store Discovery and Engagement Standard」の日次データがまだ生成されていません（Apple 側で生成待ち・1〜2 日）。`,
      )
    return { status: 'pending', processingDate: null, bySourceType: {}, topReferrerDomains: [] }
  }
  const reportName = eng.reportName
  const processingDate = eng.processingDate

  // 3) ダウンロード（COMMERCE / App Downloads）を同じ日付で読む。
  //    Source Type 別の DL 数はこちらにしか無い（Engagement 側には Downloads 列が存在しない）。
  const dl = await loadDailyRows(
    token,
    ongoing.id,
    'COMMERCE',
    /app downloads standard/i,
    processingDate,
  )

  const bySourceType = new Map<string, SourceAgg>()
  const byDomain = new Map<string, number>()
  aggregateEngagementRows(eng.rows, bySourceType, byDomain)
  if (dl) aggregateDownloadRows(dl.rows, bySourceType)

  console.log(
    `[appstore-source-report] date=${processingDate} engagement="${eng.header}" downloads="${dl?.header ?? '(なし)'}"`,
  )

  const topReferrerDomains = [...byDomain.entries()]
    .map(([domain, downloads]) => ({ domain, downloads }))
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, 8)

  // ---- メッセージ整形 ----
  const lines: string[] = []
  lines.push(`${appLabel} 流入経路（Source Type）日次レポート（${processingDate} 分）`)
  lines.push('────────────────')

  const sorted = [...bySourceType.entries()].sort((a, b) => b[1].downloads - a[1].downloads)
  if (sorted.length === 0) {
    lines.push('この日の流入データはありませんでした。')
  } else {
    const totalDl = sorted.reduce((s, [, v]) => s + v.downloads, 0)
    const totalRedl = sorted.reduce((s, [, v]) => s + v.redownloads, 0)
    for (const [src, agg] of sorted) {
      const share = totalDl > 0 ? Math.round((agg.downloads / totalDl) * 1000) / 10 : 0
      const parts = [`表示 ${fmt(agg.impressions)}`, `ページ閲覧 ${fmt(agg.ppViews)}`]
      if (agg.taps > 0) parts.push(`タップ ${fmt(agg.taps)}`)
      parts.push(`初回DL ${fmt(agg.downloads)}` + (totalDl > 0 ? `（DL比 ${share}%）` : ''))
      if (agg.redownloads > 0) parts.push(`再DL ${fmt(agg.redownloads)}`)
      lines.push(`${sourceLabel(src)}: ${parts.join(' / ')}`)
    }
    lines.push('')
    lines.push(
      `初回DL合計: ${fmt(totalDl)}` + (totalRedl > 0 ? `（ほかに再DL ${fmt(totalRedl)}）` : ''),
    )
  }

  if (topReferrerDomains.length > 0) {
    lines.push('')
    lines.push('Web 経由の参照元ドメイン（上位）:')
    for (const { domain, downloads } of topReferrerDomains) {
      lines.push(`　・${domain}: ${fmt(downloads)}`)
    }
  }

  lines.push('')
  lines.push(
    '※ 表示・閲覧は「Discovery and Engagement」、DLは「App Downloads」（いずれも Standard）の集計。',
  )

  if (deliver) await postSlack(lines.join('\n'))

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
