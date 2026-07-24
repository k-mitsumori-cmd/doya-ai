import { GoogleAuth } from 'google-auth-library'
import { prisma } from '@/lib/prisma'
import { buildContentScheduleSection } from '@/lib/sns-schedule-report'

// ============================================
// 毎朝のアクセスレポート（GA4 + Search Console + YouTube → Slack）
//
// 構成:
// 1) サマリー — 前日比の評価と今月累計の進捗（前月同期間比）
// 2) 検索トピック — 伸びているクエリ / 新規上位クエリを文章で報告
// 3) 詳細 — 羅列は最小限（人気ページTOP3・チャネル上位3など）
// 4) YouTube — チャンネル増分と動きのあった動画のみ
//
// 毎月1日の朝は、先月分をまとめた「月次総括」を別メッセージで追加送信する。
//
// データの注意:
// - Search Console は確定まで2〜3日遅れるため「確定日=3日前」を最新として扱う
// - YouTube は Analytics API不使用（所有者OAuthが必要なため）。Data API v3 +
//   SystemSetting への日次スナップショット差分で増分を算出。月初ベースラインも保持
//
// 対象は環境変数 ANALYTICS_REPORT_TARGETS（JSON配列）、
// YouTube は YOUTUBE_CHANNELS（JSON配列: "@handle" or "UC..."）で定義
// ============================================

export type ReportTarget = {
  name: string
  ga4PropertyId?: string
  gscSiteUrl?: string
  /**
   * GSCの集計をURL部分一致で絞り込む（ドメインプロパティを複数サイトで共有する場合に使う。
   * 例: "game.surisuta.jp/noroi"）。未指定ならプロパティ全体。
   */
  gscPageFilter?: string
  /**
   * GA4の集計を pagePath 部分一致で絞り込む（1つのGA4プロパティを複数サイトで共有し、
   * パスでサイトを分ける場合に使う。例: "/yurusen"）。未指定ならプロパティ全体。
   */
  ga4PageFilter?: string
}

/** GA4 runReport に付ける pagePath 部分一致フィルタ（未指定なら空＝フィルタ無し）。 */
function ga4PathFilter(pageFilter?: string): Record<string, unknown> {
  if (!pageFilter) return {}
  return {
    dimensionFilter: {
      filter: {
        fieldName: 'pagePath',
        stringFilter: { matchType: 'CONTAINS', value: pageFilter },
      },
    },
  }
}

const GA4_API = 'https://analyticsdata.googleapis.com/v1beta'
const GSC_API = 'https://searchconsole.googleapis.com/webmasters/v3'
const YT_API = 'https://www.googleapis.com/youtube/v3'
const YT_SNAPSHOT_KEY = 'analytics_report_youtube_snapshot'

// ---------- 共通ユーティリティ ----------

function getTargets(): ReportTarget[] {
  const raw = process.env.ANALYTICS_REPORT_TARGETS
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    console.error('[analytics-report] ANALYTICS_REPORT_TARGETS is not valid JSON')
    return []
  }
}

async function getAccessToken(): Promise<string> {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credentialsJson) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not set')
  }
  // ローカルの .env 読み込みでは private_key 内の \n が実改行になるため、
  // JSON.parse 前に制御文字をエスケープし直す（Vercel 本番はそのまま通る）
  const credentials = JSON.parse(
    credentialsJson.replace(/[\n\r\t]/g, (m) => (m === '\n' ? '\\n' : m === '\r' ? '\\r' : '\\t')),
  )
  const auth = new GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/webmasters.readonly',
    ],
  })
  const client = await auth.getClient()
  const token = await client.getAccessToken()
  if (!token.token) {
    throw new Error('Failed to get access token')
  }
  return token.token
}

/** JSTの現在時刻（UTCゲッターをJSTとして読む） */
function jstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
}

/** JSTで今日から offsetDays 日前の日付を YYYY-MM-DD で返す */
function jstDate(offsetDays: number): string {
  const d = jstNow()
  d.setUTCDate(d.getUTCDate() - offsetDays)
  return d.toISOString().slice(0, 10)
}

/** JSTで (今月 + monthOffset) の1日を YYYY-MM-DD で返す */
function jstMonthStart(monthOffset: number): string {
  const d = jstNow()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + monthOffset)
  return d.toISOString().slice(0, 10)
}

/** JSTで (今月 + monthOffset) の末日を YYYY-MM-DD で返す */
function jstMonthEnd(monthOffset: number): string {
  const d = jstNow()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + monthOffset + 1)
  d.setUTCDate(0)
  return d.toISOString().slice(0, 10)
}

/** date(YYYY-MM-DD) の「日」を prevMonth 内の同日にクランプして返す */
function sameDayInMonth(dateStr: string, monthStart: string): string {
  const day = Number(dateStr.slice(8, 10))
  const monthEnd = Number(
    new Date(Date.UTC(Number(monthStart.slice(0, 4)), Number(monthStart.slice(5, 7)), 0))
      .toISOString()
      .slice(8, 10),
  )
  const clamped = String(Math.min(day, monthEnd)).padStart(2, '0')
  return `${monthStart.slice(0, 7)}-${clamped}`
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ja-JP')
}

/** 前期比を「+12.3%」形式で返す（前期0のときは "-"） */
function diffPct(current: number, previous: number): string {
  if (!previous) return '-'
  const pct = ((current - previous) / previous) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}

/** 前日比の傾向を短い言葉にする */
function trendWord(current: number, previous: number): string {
  if (!previous) return ''
  const pct = ((current - previous) / previous) * 100
  if (pct >= 30) return '大きく伸びました'
  if (pct >= 10) return '好調です'
  if (pct > -10) return '横ばいです'
  if (pct > -30) return 'やや減少しました'
  return '大きく減少しました'
}

async function googleApiPost(url: string, token: string, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Google API error ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

async function postSlack(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_ANALYTICS_WEBHOOK_URL
  if (!webhookUrl) {
    throw new Error('SLACK_ANALYTICS_WEBHOOK_URL is not set')
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

// ---------- GA4 ----------

type Ga4Totals = { sessions: number; users: number; pageViews: number; keyEvents: number }

export type Ga4KeyEvent = {
  name: string
  count: number
  channels: { name: string; count: number }[]
  sources: { name: string; count: number }[]
  pages: { path: string; count: number }[]
}

type Ga4Summary = {
  yesterday: Ga4Totals
  prevDay: Ga4Totals
  lastWeek: Ga4Totals
  // 今月累計（1日〜昨日）と前月同期間。毎月1日は今月分がないため null
  mtd: Ga4Totals | null
  prevMtd: Ga4Totals | null
  channels: { name: string; sessions: number }[]
  topPages: { path: string; views: number }[]
  keyEvents: Ga4KeyEvent[]
}

const GA4_METRICS = [
  { name: 'sessions' },
  { name: 'totalUsers' },
  { name: 'screenPageViews' },
  { name: 'keyEvents' },
]

function parseGa4Ranges(res: any): Record<string, Ga4Totals> {
  const byRange: Record<string, Ga4Totals> = {}
  for (const row of res.rows || []) {
    const range = row.dimensionValues?.[0]?.value || ''
    const v = (row.metricValues || []).map((m: any) => Number(m.value) || 0)
    byRange[range] = { sessions: v[0] || 0, users: v[1] || 0, pageViews: v[2] || 0, keyEvents: v[3] || 0 }
  }
  return byRange
}

const GA4_ZERO: Ga4Totals = { sessions: 0, users: 0, pageViews: 0, keyEvents: 0 }

/** 昨日発生したキーイベントと、その流入経路・発生ページの内訳を取得 */
async function fetchGa4KeyEvents(propertyId: string, token: string, pageFilter?: string): Promise<Ga4KeyEvent[]> {
  const base = `${GA4_API}/properties/${propertyId}:runReport`
  const yesterday = [{ startDate: jstDate(1), endDate: jstDate(1) }]
  const pf = ga4PathFilter(pageFilter)

  const namesRes = await googleApiPost(base, token, {
    dateRanges: yesterday,
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'keyEvents' }],
    ...pf,
  })
  const events = new Map<string, Ga4KeyEvent>()
  for (const row of namesRes.rows || []) {
    const name = row.dimensionValues?.[0]?.value || ''
    const count = Number(row.metricValues?.[0]?.value) || 0
    if (name && count > 0) {
      events.set(name, { name, count, channels: [], sources: [], pages: [] })
    }
  }
  if (events.size === 0) return []

  // 内訳（チャネル / 参照元・メディア / 発生ページ）をまとめて取得
  const breakdown = async (dimension: string) => {
    const res = await googleApiPost(base, token, {
      dateRanges: yesterday,
      dimensions: [{ name: 'eventName' }, { name: dimension }],
      metrics: [{ name: 'keyEvents' }],
      orderBys: [{ metric: { metricName: 'keyEvents' }, desc: true }],
      limit: 50,
      ...pf,
    })
    return (res.rows || [])
      .map((row: any) => ({
        event: row.dimensionValues?.[0]?.value || '',
        key: row.dimensionValues?.[1]?.value || '(不明)',
        count: Number(row.metricValues?.[0]?.value) || 0,
      }))
      .filter((r: any) => r.count > 0)
  }

  const [channels, sources, pages] = await Promise.all([
    breakdown('sessionDefaultChannelGroup'),
    breakdown('sessionSourceMedium'),
    breakdown('pagePath'),
  ])
  for (const r of channels) events.get(r.event)?.channels.push({ name: r.key, count: r.count })
  for (const r of sources) events.get(r.event)?.sources.push({ name: r.key, count: r.count })
  for (const r of pages) events.get(r.event)?.pages.push({ path: r.key, count: r.count })

  return Array.from(events.values()).sort((a, b) => b.count - a.count)
}

async function fetchGa4Summary(propertyId: string, token: string, pageFilter?: string): Promise<Ga4Summary> {
  const base = `${GA4_API}/properties/${propertyId}:runReport`
  const isFirstOfMonth = jstDate(0).slice(8, 10) === '01'
  const pf = ga4PathFilter(pageFilter)

  // GA4 runReport は1リクエスト4 dateRangesまでのため、日次(3期間)と月次進捗(2期間)を分ける
  const totalsRes = await googleApiPost(base, token, {
    dateRanges: [
      { startDate: jstDate(1), endDate: jstDate(1), name: 'yesterday' },
      { startDate: jstDate(2), endDate: jstDate(2), name: 'prev_day' },
      { startDate: jstDate(8), endDate: jstDate(8), name: 'last_week' },
    ],
    metrics: GA4_METRICS,
    ...pf,
  })
  const byRange = parseGa4Ranges(totalsRes)

  if (!isFirstOfMonth) {
    const mtdEnd = jstDate(1)
    const mtdRes = await googleApiPost(base, token, {
      dateRanges: [
        { startDate: jstMonthStart(0), endDate: mtdEnd, name: 'mtd' },
        {
          startDate: jstMonthStart(-1),
          endDate: sameDayInMonth(mtdEnd, jstMonthStart(-1)),
          name: 'prev_mtd',
        },
      ],
      metrics: GA4_METRICS,
      ...pf,
    })
    Object.assign(byRange, parseGa4Ranges(mtdRes))
  }

  const channelsRes = await googleApiPost(base, token, {
    dateRanges: [{ startDate: jstDate(1), endDate: jstDate(1) }],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 3,
    ...pf,
  })
  const channels = (channelsRes.rows || []).map((row: any) => ({
    name: row.dimensionValues?.[0]?.value || '(不明)',
    sessions: Number(row.metricValues?.[0]?.value) || 0,
  }))

  const pagesRes = await googleApiPost(base, token, {
    dateRanges: [{ startDate: jstDate(1), endDate: jstDate(1) }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 3,
    ...pf,
  })
  const topPages = (pagesRes.rows || []).map((row: any) => ({
    path: row.dimensionValues?.[0]?.value || '(不明)',
    views: Number(row.metricValues?.[0]?.value) || 0,
  }))

  const keyEvents = await fetchGa4KeyEvents(propertyId, token, pageFilter)

  return {
    yesterday: byRange['yesterday'] || GA4_ZERO,
    prevDay: byRange['prev_day'] || GA4_ZERO,
    lastWeek: byRange['last_week'] || GA4_ZERO,
    mtd: byRange['mtd'] || (isFirstOfMonth ? null : GA4_ZERO),
    prevMtd: byRange['prev_mtd'] || (isFirstOfMonth ? null : GA4_ZERO),
    channels,
    topPages,
    keyEvents,
  }
}

// ---------- Search Console ----------

type GscQueryRow = { query: string; clicks: number; impressions: number; position: number }

type GscPageRow = { page: string; clicks: number; impressions: number; position: number }

type GscSummary = {
  date: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  prevWeek: { clicks: number; impressions: number }
  mtdClicks: number | null
  prevMtdClicks: number | null
  queries7d: GscQueryRow[]
  queriesPrev7d: GscQueryRow[]
  pages7d: GscPageRow[]
  pagesPrev7d: GscPageRow[]
}

/** gscPageFilter 指定時に query body へ付けるURL部分一致フィルタ */
function gscPageFilterGroups(pageFilter?: string) {
  if (!pageFilter) return {}
  return {
    dimensionFilterGroups: [
      { filters: [{ dimension: 'page', operator: 'contains', expression: pageFilter }] },
    ],
  }
}

async function gscQuery(siteUrl: string, token: string, body: unknown): Promise<any> {
  const url = `${GSC_API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
  return googleApiPost(url, token, body)
}

function parseGscQueryRows(res: any): GscQueryRow[] {
  return (res.rows || []).map((row: any) => ({
    query: row.keys?.[0] || '(不明)',
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    position: row.position || 0,
  }))
}

async function fetchGscSummary(
  siteUrl: string,
  token: string,
  pageFilter?: string,
): Promise<GscSummary> {
  // GSCは確定まで2〜3日かかるため3日前を「最新確定日」として扱う
  const targetDate = jstDate(3)
  const prevWeekDate = jstDate(10)
  const mtdStart = jstMonthStart(0)
  const hasMtd = targetDate >= mtdStart
  const filter = gscPageFilterGroups(pageFilter)

  const requests: Promise<any>[] = [
    gscQuery(siteUrl, token, { startDate: targetDate, endDate: targetDate, ...filter }),
    gscQuery(siteUrl, token, { startDate: prevWeekDate, endDate: prevWeekDate, ...filter }),
    // 検索トピック抽出用: 直近7日(確定分)と、その前の7日
    gscQuery(siteUrl, token, {
      startDate: jstDate(9),
      endDate: targetDate,
      dimensions: ['query'],
      rowLimit: 25,
      ...filter,
    }),
    gscQuery(siteUrl, token, {
      startDate: jstDate(16),
      endDate: jstDate(10),
      dimensions: ['query'],
      rowLimit: 25,
      ...filter,
    }),
    // ページ別の掲載順位（順位が上がってきたページの検出用）: 直近7日 vs その前7日
    gscQuery(siteUrl, token, {
      startDate: jstDate(9),
      endDate: targetDate,
      dimensions: ['page'],
      rowLimit: 200,
      ...filter,
    }),
    gscQuery(siteUrl, token, {
      startDate: jstDate(16),
      endDate: jstDate(10),
      dimensions: ['page'],
      rowLimit: 200,
      ...filter,
    }),
  ]
  if (hasMtd) {
    requests.push(gscQuery(siteUrl, token, { startDate: mtdStart, endDate: targetDate, ...filter }))
    requests.push(
      gscQuery(siteUrl, token, {
        startDate: jstMonthStart(-1),
        endDate: sameDayInMonth(targetDate, jstMonthStart(-1)),
        ...filter,
      }),
    )
  }

  const [totalRes, prevRes, q7Res, qPrev7Res, p7Res, pPrev7Res, mtdRes, prevMtdRes] =
    await Promise.all(requests)

  const total = totalRes.rows?.[0] || {}
  const prev = prevRes.rows?.[0] || {}

  const parsePages = (res: any): GscPageRow[] =>
    (res.rows || []).map((row: any) => ({
      page: row.keys?.[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      position: row.position || 0,
    }))

  return {
    date: targetDate,
    clicks: total.clicks || 0,
    impressions: total.impressions || 0,
    ctr: total.ctr || 0,
    position: total.position || 0,
    prevWeek: { clicks: prev.clicks || 0, impressions: prev.impressions || 0 },
    mtdClicks: hasMtd ? mtdRes?.rows?.[0]?.clicks || 0 : null,
    prevMtdClicks: hasMtd ? prevMtdRes?.rows?.[0]?.clicks || 0 : null,
    queries7d: parseGscQueryRows(q7Res),
    queriesPrev7d: parseGscQueryRows(qPrev7Res),
    pages7d: parsePages(p7Res),
    pagesPrev7d: parsePages(pPrev7Res),
  }
}

/**
 * 順位が上がってきたページ（直近7日 vs その前7日）。
 * 新たに検索表示され始めたページも1行で報告する。
 */
function buildRisingPages(gsc: GscSummary): string[] {
  const prevMap = new Map(gsc.pagesPrev7d.map((p) => [p.page, p]))
  const shorten = (url: string): string => {
    try {
      const u = new URL(url)
      const path = decodeURIComponent(u.pathname)
      return path.length > 60 ? `${path.slice(0, 57)}…` : path || '/'
    } catch {
      return url
    }
  }

  type Row = { text: string; score: number }
  const rising: Row[] = []
  const fresh: Row[] = []
  for (const p of gsc.pages7d) {
    const before = prevMap.get(p.page)
    if (!before) {
      // 前週は検索結果に出ていなかったページ
      if (p.impressions >= 10) {
        fresh.push({
          text: `${shorten(p.page)}: 新たに検索表示され始めました（週${fmt(p.impressions)}表示・平均${p.position.toFixed(1)}位）`,
          score: p.impressions,
        })
      }
      continue
    }
    const gain = before.position - p.position
    // ノイズ除去: 表示が少ないページ・微小変動は載せない
    if (p.impressions >= 10 && gain >= 2 && p.position <= 40) {
      rising.push({
        text: `${shorten(p.page)}: ${before.position.toFixed(1)}位 → ${p.position.toFixed(1)}位（週${fmt(p.impressions)}表示${p.clicks > 0 ? `・${fmt(p.clicks)}クリック` : ''}）`,
        score: gain * Math.log10(p.impressions + 10) + p.clicks * 2,
      })
    }
  }
  rising.sort((a, b) => b.score - a.score)
  fresh.sort((a, b) => b.score - a.score)

  const lines = rising.slice(0, 5).map((r) => r.text)
  // 上昇が少ない日は新規表示ページで補完（合計最大6行）
  for (const f of fresh.slice(0, Math.max(1, 6 - lines.length))) {
    if (lines.length >= 6) break
    lines.push(f.text)
  }
  return lines
}

/** 検索トピック（伸びたクエリ/新規上位クエリ）を文章で返す */
function buildSearchTopics(gsc: GscSummary): string[] {
  const topics: string[] = []
  const prevMap = new Map(gsc.queriesPrev7d.map((q) => [q.query, q]))

  type Topic = { text: string; score: number }
  const candidates: Topic[] = []

  for (const q of gsc.queries7d) {
    const before = prevMap.get(q.query)
    if (!before) {
      // 前週に存在しなかった新規クエリ
      if (q.clicks >= 2 || q.impressions >= 30) {
        candidates.push({
          text: `「${q.query}」が新たに検索流入に登場（週${fmt(q.clicks)}クリック・平均${q.position.toFixed(1)}位）`,
          score: q.clicks * 3 + q.impressions / 20,
        })
      }
      continue
    }
    // クリックが伸びたクエリ
    if (q.clicks >= 3 && before.clicks > 0 && q.clicks >= before.clicks * 1.3) {
      candidates.push({
        text: `「${q.query}」が伸びています（週${fmt(q.clicks)}クリック・前週比${diffPct(q.clicks, before.clicks)}・平均${q.position.toFixed(1)}位）`,
        score: q.clicks * 2 + (q.clicks - before.clicks) * 3,
      })
      continue
    }
    // 掲載順位が大きく改善したクエリ
    if (q.impressions >= 30 && before.position - q.position >= 3 && q.position <= 15) {
      candidates.push({
        text: `「${q.query}」の掲載順位が改善（${before.position.toFixed(1)}位 → ${q.position.toFixed(1)}位）`,
        score: q.impressions / 10 + (before.position - q.position) * 2,
      })
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  topics.push(...candidates.slice(0, 3).map((c) => c.text))

  // トピックがない場合も、検索流入の中心クエリは常に1つ報告する
  if (topics.length === 0 && gsc.queries7d.length > 0) {
    const top = [...gsc.queries7d].sort((a, b) => b.clicks - a.clicks)[0]
    topics.push(
      `検索流入の中心は「${top.query}」です（週${fmt(top.clicks)}クリック・平均${top.position.toFixed(1)}位）`,
    )
  }
  return topics
}

// ---------- YouTube ----------

type YtChannelSummary = {
  id: string
  title: string
  totalViews: number
  subscribers: number
  viewsDelta: number | null
  subscribersDelta: number | null
  mtdViews: number | null
  prevMonth: { month: string; views: number; subs: number } | null
  hotVideo: { title: string; views: number; delta: number } | null
  videoViewMap: Record<string, number>
}

type YtSnapEntry = {
  totalViews: number
  subscribers: number
  videos: Record<string, number>
  date: string
  monthBaseline?: { month: string; totalViews: number; subscribers: number }
  prevMonth?: { month: string; views: number; subs: number }
}

type YtSnapshot = Record<string, YtSnapEntry>

function getYoutubeChannels(): string[] {
  const raw = process.env.YOUTUBE_CHANNELS
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === 'string') : []
  } catch {
    console.error('[analytics-report] YOUTUBE_CHANNELS is not valid JSON')
    return []
  }
}

async function ytGet(path: string, params: Record<string, string>): Promise<any> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set')
  const qs = new URLSearchParams({ ...params, key: apiKey })
  const res = await fetch(`${YT_API}/${path}?${qs}`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`YouTube API error ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

async function fetchYtChannel(channel: string, snapshot: YtSnapshot): Promise<YtChannelSummary> {
  const idParam: Record<string, string> = channel.startsWith('@')
    ? { forHandle: channel }
    : { id: channel }
  const chRes = await ytGet('channels', { part: 'snippet,statistics,contentDetails', ...idParam })
  const ch = chRes.items?.[0]
  if (!ch) throw new Error(`チャンネルが見つかりません: ${channel}`)

  const totalViews = Number(ch.statistics?.viewCount) || 0
  const subscribers = Number(ch.statistics?.subscriberCount) || 0
  const uploadsPlaylist = ch.contentDetails?.relatedPlaylists?.uploads
  const prev = snapshot[ch.id]
  const currentMonth = jstDate(0).slice(0, 7)

  // 月初ベースライン: 月が変わったら先月分を確定し、ベースラインを張り替える
  let prevMonth = prev?.prevMonth || null
  let mtdViews: number | null = null
  if (prev?.monthBaseline) {
    if (prev.monthBaseline.month === currentMonth) {
      mtdViews = totalViews - prev.monthBaseline.totalViews
    } else {
      prevMonth = {
        month: prev.monthBaseline.month,
        views: totalViews - prev.monthBaseline.totalViews,
        subs: subscribers - prev.monthBaseline.subscribers,
      }
      mtdViews = 0
    }
  }

  // 直近動画の再生数（動きのあった動画の検出用）
  const videoViewMap: Record<string, number> = {}
  let hotVideo: YtChannelSummary['hotVideo'] = null
  if (uploadsPlaylist) {
    const plRes = await ytGet('playlistItems', {
      part: 'contentDetails',
      playlistId: uploadsPlaylist,
      maxResults: '10',
    })
    const videoIds = (plRes.items || [])
      .map((i: any) => i.contentDetails?.videoId)
      .filter(Boolean)
    if (videoIds.length > 0) {
      const vRes = await ytGet('videos', { part: 'snippet,statistics', id: videoIds.join(',') })
      let best: { title: string; views: number; delta: number } | null = null
      for (const v of vRes.items || []) {
        const views = Number(v.statistics?.viewCount) || 0
        videoViewMap[v.id] = views
        const prevViews = prev?.videos?.[v.id]
        const delta = typeof prevViews === 'number' ? views - prevViews : 0
        if (delta > 0 && (!best || delta > best.delta)) {
          best = { title: v.snippet?.title || '(無題)', views, delta }
        }
      }
      hotVideo = best
    }
  }

  return {
    id: ch.id,
    title: ch.snippet?.title || channel,
    totalViews,
    subscribers,
    viewsDelta: prev ? totalViews - prev.totalViews : null,
    subscribersDelta: prev ? subscribers - prev.subscribers : null,
    mtdViews,
    prevMonth,
    hotVideo,
    videoViewMap,
  }
}

async function loadYtSnapshot(): Promise<YtSnapshot> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: YT_SNAPSHOT_KEY } })
    return row ? JSON.parse(row.value) : {}
  } catch (e) {
    console.error('[analytics-report] failed to load YouTube snapshot:', e)
    return {}
  }
}

async function saveYtSnapshot(channels: YtChannelSummary[]): Promise<void> {
  const currentMonth = jstDate(0).slice(0, 7)
  const snapshot: YtSnapshot = {}
  for (const ch of channels) {
    snapshot[ch.id] = {
      totalViews: ch.totalViews,
      subscribers: ch.subscribers,
      videos: ch.videoViewMap,
      date: jstDate(0),
      // ベースラインは月初時点の累計。今月分が未設定なら現在値で開始する
      monthBaseline: {
        month: currentMonth,
        totalViews: ch.mtdViews !== null ? ch.totalViews - ch.mtdViews : ch.totalViews,
        subscribers: ch.subscribers,
      },
      ...(ch.prevMonth ? { prevMonth: ch.prevMonth } : {}),
    }
  }
  const value = JSON.stringify(snapshot)
  await prisma.systemSetting.upsert({
    where: { key: YT_SNAPSHOT_KEY },
    update: { value },
    create: { key: YT_SNAPSHOT_KEY, value },
  })
}

// ---------- 日次レポート組み立て ----------

/** キーイベント発生時のお祝いセクション。発生がなければ null */
function buildKeyEventCelebration(
  perTarget: { target: ReportTarget; ga4: Ga4Summary | null }[],
): string | null {
  const all: { target: ReportTarget; ev: Ga4KeyEvent }[] = []
  for (const { target, ga4 } of perTarget) {
    for (const ev of ga4?.keyEvents || []) {
      all.push({ target, ev })
    }
  }
  if (all.length === 0) return null

  const total = all.reduce((s, x) => s + x.ev.count, 0)
  const lines: string[] = []
  lines.push(`🎉 おめでとうございます！昨日キーイベントが合計${fmt(total)}件発生しました 🎉`)
  lines.push('')
  lines.push('《キーイベント詳細》')
  for (const { ev } of all) {
    lines.push(`・「${ev.name}」 ${fmt(ev.count)}件`)
    if (ev.channels.length > 0) {
      lines.push(
        `    流入経路: ${ev.channels.map((c) => `${c.name} ${fmt(c.count)}件`).join(' / ')}`,
      )
    }
    if (ev.sources.length > 0) {
      lines.push(
        `    参照元: ${ev.sources
          .slice(0, 3)
          .map((s) => `${s.name} ${fmt(s.count)}件`)
          .join(' / ')}`,
      )
    }
    if (ev.pages.length > 0) {
      lines.push(
        `    発生ページ: ${ev.pages
          .slice(0, 3)
          .map((p) => `${p.path}(${fmt(p.count)})`)
          .join(' / ')}`,
      )
    }
  }
  return lines.join('\n')
}

function buildDailySummarySection(
  ga4: Ga4Summary | null,
  gsc: GscSummary | null,
  ytChannels: YtChannelSummary[],
): string {
  const lines: string[] = ['《サマリー》']

  if (ga4) {
    let line = `・アクセス: 昨日${fmt(ga4.yesterday.sessions)}セッション（前日比${diffPct(ga4.yesterday.sessions, ga4.prevDay.sessions)}）— ${trendWord(ga4.yesterday.sessions, ga4.prevDay.sessions)}`
    if (ga4.mtd && ga4.prevMtd) {
      line += `。今月累計${fmt(ga4.mtd.sessions)}（前月同期間比${diffPct(ga4.mtd.sessions, ga4.prevMtd.sessions)}）`
    }
    lines.push(line)
  }
  if (gsc) {
    let line = `・検索流入: 確定日${fmt(gsc.clicks)}クリック（前週同曜日比${diffPct(gsc.clicks, gsc.prevWeek.clicks)}）`
    if (gsc.mtdClicks !== null && gsc.prevMtdClicks !== null) {
      line += `。今月累計${fmt(gsc.mtdClicks)}クリック（前月同期間比${diffPct(gsc.mtdClicks, gsc.prevMtdClicks)}）`
    }
    lines.push(line)
  }
  if (ytChannels.length > 0) {
    const delta = ytChannels.reduce((s, c) => s + (c.viewsDelta || 0), 0)
    const subs = ytChannels.reduce((s, c) => s + (c.subscribersDelta || 0), 0)
    const mtd = ytChannels.reduce((s, c) => s + (c.mtdViews || 0), 0)
    const hasDelta = ytChannels.some((c) => c.viewsDelta !== null)
    if (hasDelta) {
      let line = `・YouTube: 再生+${fmt(delta)}、登録者${subs >= 0 ? '+' : ''}${fmt(subs)}`
      if (ytChannels.some((c) => c.mtdViews !== null)) {
        line += `。今月累計+${fmt(mtd)}再生`
      }
      lines.push(line)
    } else {
      lines.push('・YouTube: 計測開始（増分は明日から表示）')
    }
  }
  return lines.join('\n')
}

function buildTargetSection(
  target: ReportTarget,
  ga4: Ga4Summary | null,
  gsc: GscSummary | null,
  errors: string[],
): string {
  const lines: string[] = [`■ ${target.name}`]

  if (ga4) {
    lines.push(
      `・昨日(${jstDate(1)}): ${fmt(ga4.yesterday.sessions)}セッション / ${fmt(ga4.yesterday.pageViews)}PV（前週同曜日比${diffPct(ga4.yesterday.sessions, ga4.lastWeek.sessions)}）`,
    )
    if (ga4.channels.length > 0) {
      lines.push(`・流入: ${ga4.channels.map((c) => `${c.name} ${fmt(c.sessions)}`).join(' / ')}`)
    }
    if (ga4.topPages.length > 0) {
      lines.push(`・人気ページ: ${ga4.topPages.map((p) => `${p.path}(${fmt(p.views)})`).join(' / ')}`)
    }
  }
  if (gsc) {
    lines.push(
      `・検索(確定日${gsc.date}): ${fmt(gsc.clicks)}クリック / ${fmt(gsc.impressions)}表示 / CTR ${(gsc.ctr * 100).toFixed(1)}% / 平均${gsc.position.toFixed(1)}位`,
    )
    const rising = buildRisingPages(gsc)
    if (rising.length > 0) {
      lines.push('・順位が上がってきたページ:')
      lines.push(...rising.map((r) => `    ${r}`))
    } else {
      lines.push('・順位が上がってきたページ: 今週は大きな順位変動はありません')
    }
  }
  for (const err of errors) {
    lines.push(`（取得エラー: ${err}）`)
  }
  return lines.join('\n')
}

function buildYtSection(channels: YtChannelSummary[], errors: string[]): string {
  const lines: string[] = ['■ YouTube']
  for (const ch of channels) {
    const delta = ch.viewsDelta === null ? '計測開始' : `+${fmt(ch.viewsDelta)}再生`
    const subs =
      ch.subscribersDelta === null
        ? `登録者${fmt(ch.subscribers)}`
        : `登録者${fmt(ch.subscribers)}（${ch.subscribersDelta >= 0 ? '+' : ''}${fmt(ch.subscribersDelta)}）`
    lines.push(`・${ch.title}: ${delta} / ${subs}`)
    if (ch.hotVideo) {
      lines.push(`    一番見られた動画: ${ch.hotVideo.title}（+${fmt(ch.hotVideo.delta)}回）`)
    }
  }
  for (const err of errors) {
    lines.push(`（取得エラー: ${err}）`)
  }
  return lines.join('\n')
}

// ---------- 月次総括 ----------

type MonthlyData = {
  month: string // YYYY-MM（先月）
  ga4: {
    sessions: number
    users: number
    pageViews: number
    keyEvents: number
    prev: Ga4Totals
    topPages: { path: string; views: number }[]
    channels: { name: string; sessions: number }[]
  } | null
  gsc: {
    clicks: number
    impressions: number
    position: number
    prev: { clicks: number; impressions: number; position: number }
    topQueries: GscQueryRow[]
    coverageEnd: string
  } | null
}

async function fetchMonthlyData(target: ReportTarget, token: string): Promise<MonthlyData> {
  const month = jstMonthStart(-1).slice(0, 7)
  const start = jstMonthStart(-1)
  const end = jstMonthEnd(-1)
  const prevStart = jstMonthStart(-2)
  const prevEnd = jstMonthEnd(-2)

  let ga4: MonthlyData['ga4'] = null
  if (target.ga4PropertyId) {
    const base = `${GA4_API}/properties/${target.ga4PropertyId}:runReport`
    const pf = ga4PathFilter(target.ga4PageFilter)
    const totalsRes = await googleApiPost(base, token, {
      dateRanges: [
        { startDate: start, endDate: end, name: 'last_month' },
        { startDate: prevStart, endDate: prevEnd, name: 'before' },
      ],
      metrics: GA4_METRICS,
      ...pf,
    })
    const byRange = parseGa4Ranges(totalsRes)
    const pagesRes = await googleApiPost(base, token, {
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 3,
      ...pf,
    })
    const channelsRes = await googleApiPost(base, token, {
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 3,
      ...pf,
    })
    const lm = byRange['last_month'] || GA4_ZERO
    const bf = byRange['before'] || GA4_ZERO
    ga4 = {
      sessions: lm.sessions,
      users: lm.users,
      pageViews: lm.pageViews,
      keyEvents: lm.keyEvents,
      prev: bf,
      topPages: (pagesRes.rows || []).map((row: any) => ({
        path: row.dimensionValues?.[0]?.value || '(不明)',
        views: Number(row.metricValues?.[0]?.value) || 0,
      })),
      channels: (channelsRes.rows || []).map((row: any) => ({
        name: row.dimensionValues?.[0]?.value || '(不明)',
        sessions: Number(row.metricValues?.[0]?.value) || 0,
      })),
    }
  }

  let gsc: MonthlyData['gsc'] = null
  if (target.gscSiteUrl) {
    // GSCの確定遅延分、月末数日はデータが無い場合がある
    const coverageEnd = jstDate(3) < end ? jstDate(3) : end
    const prevCoverageEnd = sameDayInMonth(coverageEnd, prevStart)
    const [curRes, prevRes, queriesRes] = await Promise.all([
      gscQuery(target.gscSiteUrl, token, { startDate: start, endDate: coverageEnd }),
      gscQuery(target.gscSiteUrl, token, { startDate: prevStart, endDate: prevCoverageEnd }),
      gscQuery(target.gscSiteUrl, token, {
        startDate: start,
        endDate: coverageEnd,
        dimensions: ['query'],
        rowLimit: 5,
      }),
    ])
    const cur = curRes.rows?.[0] || {}
    const prev = prevRes.rows?.[0] || {}
    gsc = {
      clicks: cur.clicks || 0,
      impressions: cur.impressions || 0,
      position: cur.position || 0,
      prev: {
        clicks: prev.clicks || 0,
        impressions: prev.impressions || 0,
        position: prev.position || 0,
      },
      topQueries: parseGscQueryRows(queriesRes),
      coverageEnd,
    }
  }

  return { month, ga4, gsc }
}

function buildMonthlyReport(
  results: { target: ReportTarget; data: MonthlyData }[],
  ytChannels: YtChannelSummary[],
): string {
  const month = results[0]?.data.month || jstMonthStart(-1).slice(0, 7)
  const lines: string[] = [`【月次総括レポート】${month.replace('-', '年')}月`, '']

  for (const { target, data } of results) {
    lines.push(`■ ${target.name}`)
    if (data.ga4) {
      const g = data.ga4
      lines.push(
        `・アクセス: ${fmt(g.sessions)}セッション（前月比${diffPct(g.sessions, g.prev.sessions)}） / ${fmt(g.pageViews)}PV（${diffPct(g.pageViews, g.prev.pageViews)}） / ユーザー${fmt(g.users)}人`,
      )
      if (g.keyEvents > 0 || g.prev.keyEvents > 0) {
        lines.push(
          `・キーイベント: ${fmt(g.keyEvents)}件（前月比${diffPct(g.keyEvents, g.prev.keyEvents)}）`,
        )
      }
      if (g.channels.length > 0) {
        lines.push(`・流入内訳: ${g.channels.map((c) => `${c.name} ${fmt(c.sessions)}`).join(' / ')}`)
      }
      if (g.topPages.length > 0) {
        lines.push(`・人気ページ: ${g.topPages.map((p) => `${p.path}(${fmt(p.views)})`).join(' / ')}`)
      }
    }
    if (data.gsc) {
      const s = data.gsc
      lines.push(
        `・検索: ${fmt(s.clicks)}クリック（前月比${diffPct(s.clicks, s.prev.clicks)}） / ${fmt(s.impressions)}表示 / 平均${s.position.toFixed(1)}位（前月${s.prev.position.toFixed(1)}位）`,
      )
      if (s.topQueries.length > 0) {
        lines.push('・上位検索ワード:')
        for (const q of s.topQueries) {
          lines.push(`    「${q.query}」 ${fmt(q.clicks)}クリック / ${q.position.toFixed(1)}位`)
        }
      }
    }
    lines.push('')
  }

  const withPrevMonth = ytChannels.filter((c) => c.prevMonth && c.prevMonth.month === month)
  if (ytChannels.length > 0) {
    lines.push('■ YouTube')
    if (withPrevMonth.length > 0) {
      for (const ch of withPrevMonth) {
        lines.push(
          `・${ch.title}: 月間+${fmt(ch.prevMonth!.views)}再生 / 登録者${ch.prevMonth!.subs >= 0 ? '+' : ''}${fmt(ch.prevMonth!.subs)}（現在${fmt(ch.subscribers)}人）`,
        )
      }
    } else {
      lines.push('・月間集計は計測開始の翌月から表示されます')
    }
    lines.push('')
  }

  // 総評（ルールベース）
  const remarks: string[] = []
  for (const { data } of results) {
    if (data.ga4 && data.ga4.prev.sessions > 0) {
      const pct = ((data.ga4.sessions - data.ga4.prev.sessions) / data.ga4.prev.sessions) * 100
      remarks.push(
        pct >= 10
          ? `アクセスは前月から${pct.toFixed(0)}%増と好調でした。`
          : pct <= -10
            ? `アクセスは前月から${Math.abs(pct).toFixed(0)}%減となりました。`
            : 'アクセスは前月から横ばいでした。',
      )
    }
    if (data.gsc && data.gsc.prev.clicks > 0) {
      const pct = ((data.gsc.clicks - data.gsc.prev.clicks) / data.gsc.prev.clicks) * 100
      if (Math.abs(pct) >= 10) {
        remarks.push(`検索流入は${pct >= 0 ? `+${pct.toFixed(0)}%と伸びています` : `${pct.toFixed(0)}%でした`}。`)
      }
      if (data.gsc.topQueries[0]) {
        remarks.push(`検索の柱は「${data.gsc.topQueries[0].query}」です。`)
      }
    }
  }
  if (remarks.length > 0) {
    lines.push(`《総評》${remarks.join('')}`)
  }

  return lines.join('\n')
}

// ---------- エントリポイント ----------

export async function sendAnalyticsReport(
  options: { forceMonthly?: boolean } = {},
): Promise<{ targets: number; errors: string[]; monthlySent: boolean }> {
  const targets = getTargets()
  const ytChannelIds = getYoutubeChannels()
  if (targets.length === 0 && ytChannelIds.length === 0) {
    throw new Error('ANALYTICS_REPORT_TARGETS / YOUTUBE_CHANNELS のいずれも未設定です')
  }

  const token = targets.length > 0 ? await getAccessToken() : ''
  const allErrors: string[] = []

  // --- データ取得 ---
  const perTarget: { target: ReportTarget; ga4: Ga4Summary | null; gsc: GscSummary | null; errors: string[] }[] = []
  for (const target of targets) {
    const errors: string[] = []
    let ga4: Ga4Summary | null = null
    let gsc: GscSummary | null = null
    if (target.ga4PropertyId) {
      try {
        ga4 = await fetchGa4Summary(target.ga4PropertyId, token, target.ga4PageFilter)
      } catch (e: any) {
        errors.push(`GA4: ${e?.message || e}`)
      }
    }
    if (target.gscSiteUrl) {
      try {
        gsc = await fetchGscSummary(target.gscSiteUrl, token, target.gscPageFilter)
      } catch (e: any) {
        errors.push(`Search Console: ${e?.message || e}`)
      }
    }
    perTarget.push({ target, ga4, gsc, errors })
    allErrors.push(...errors.map((e) => `${target.name}: ${e}`))
  }

  const ytErrors: string[] = []
  const ytSummaries: YtChannelSummary[] = []
  if (ytChannelIds.length > 0) {
    const snapshot = await loadYtSnapshot()
    for (const channel of ytChannelIds) {
      try {
        ytSummaries.push(await fetchYtChannel(channel, snapshot))
      } catch (e: any) {
        ytErrors.push(`${channel}: ${e?.message || e}`)
      }
    }
    allErrors.push(...ytErrors.map((e) => `YouTube: ${e}`))
  }

  // --- 日次メッセージ ---
  const primary = perTarget[0]
  const sections: string[] = []
  // キーイベントが発生した日はお祝いを最上部に
  const celebration = buildKeyEventCelebration(perTarget)
  if (celebration) {
    sections.push(celebration)
  }
  sections.push(buildDailySummarySection(primary?.ga4 || null, primary?.gsc || null, ytSummaries))

  const topicLines: string[] = []
  for (const { gsc } of perTarget) {
    if (gsc) topicLines.push(...buildSearchTopics(gsc))
  }
  if (topicLines.length > 0) {
    sections.push(['《検索トピック》', ...topicLines.map((t) => `・${t}`)].join('\n'))
  }

  for (const { target, ga4, gsc, errors } of perTarget) {
    sections.push(buildTargetSection(target, ga4, gsc, errors))
  }
  if (ytSummaries.length > 0 || ytErrors.length > 0) {
    sections.push(buildYtSection(ytSummaries, ytErrors))
  }

  // コンテンツ・SNS予約状況（X予約投稿・メディアのドリップ公開進捗など）
  try {
    const { section: scheduleSection, errors: scheduleErrors } =
      await buildContentScheduleSection()
    if (scheduleSection) sections.push(scheduleSection)
    allErrors.push(...scheduleErrors)
  } catch (e: any) {
    allErrors.push(`コンテンツ・SNS予約状況: ${e?.message || e}`)
  }

  const header = `【アクセスレポート】${jstDate(0)} 朝`
  await postSlack([header, '', sections.join('\n\n')].join('\n'))

  // --- 月次総括（毎月1日 or 手動強制時） ---
  const isFirstOfMonth = jstDate(0).slice(8, 10) === '01'
  let monthlySent = false
  if ((isFirstOfMonth || options.forceMonthly) && targets.length > 0) {
    try {
      const monthlyResults = []
      for (const target of targets) {
        monthlyResults.push({ target, data: await fetchMonthlyData(target, token) })
      }
      await postSlack(buildMonthlyReport(monthlyResults, ytSummaries))
      monthlySent = true
    } catch (e: any) {
      allErrors.push(`月次総括: ${e?.message || e}`)
    }
  }

  // スナップショットは最後に保存（月次のprevMonth計算に旧値を使うため）
  if (ytSummaries.length > 0) {
    await saveYtSnapshot(ytSummaries).catch((e) => {
      console.error('[analytics-report] failed to save YouTube snapshot:', e)
      allErrors.push('YouTube: スナップショット保存に失敗')
    })
  }

  return { targets: targets.length, errors: allErrors, monthlySent }
}
