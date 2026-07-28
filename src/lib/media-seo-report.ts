import { GoogleAuth } from 'google-auth-library'

// ============================================================
// 週次メディアSEOレポート（呪い日記 / ゆるせん オウンドメディア）
//
// GSC ドメインプロパティ sc-domain:surisuta.jp から、
// game.surisuta.jp/{noroi,yurusen} 配下（＝各オウンドメディア）を
// 直近7日 vs 前7日で集計し、Slack（SLACK_ANALYTICS_WEBHOOK_URL）へ通知する。
//
// 出す指標:
//  - クリック / 表示（前週比）
//  - ランクインKW数・ページ数
//  - 表示上位KW
//  - あと一歩(平均5〜20位・強化候補) = striking distance
//
// GSC は確定まで2〜3日遅れるため、最新確定日を「3日前」として7日窓を取る。
// 認証・叩き方は analytics-report.ts と同一パターン。
// ============================================================

const GSC_API = 'https://searchconsole.googleapis.com/webmasters/v3'
const GSC_SITE = 'sc-domain:surisuta.jp'

type MediaTarget = { name: string; pageFilter: string }
const TARGETS: MediaTarget[] = [
  { name: '呪い日記 /noroi/media', pageFilter: 'game.surisuta.jp/noroi' },
  { name: 'ゆるせん /yurusen/media', pageFilter: 'game.surisuta.jp/yurusen' },
]

type GscRow = { keys?: string[]; clicks?: number; impressions?: number; position?: number }

async function getAccessToken(): Promise<string> {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credentialsJson) throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not set')
  // ローカル .env では private_key 内の \n が実改行になるため JSON.parse 前に再エスケープ
  const credentials = JSON.parse(
    credentialsJson.replace(/[\n\r\t]/g, (m) => (m === '\n' ? '\\n' : m === '\r' ? '\\r' : '\\t')),
  )
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  })
  const client = await auth.getClient()
  const token = await client.getAccessToken()
  if (!token.token) throw new Error('Failed to get access token')
  return token.token
}

async function gscQuery(token: string, body: unknown): Promise<GscRow[]> {
  const url = `${GSC_API}/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GSC API error ${res.status}: ${text.slice(0, 300)}`)
  }
  const json = (await res.json()) as { rows?: GscRow[] }
  return json.rows || []
}

function pageFilterGroups(pageFilter: string) {
  return {
    dimensionFilterGroups: [
      { filters: [{ dimension: 'page', operator: 'contains', expression: pageFilter }] },
    ],
  }
}

// n 日前の YYYY-MM-DD（JST基準は不要。GSCはUTC日付）
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
}

function sumRows(rows: GscRow[]): { clicks: number; impressions: number } {
  let clicks = 0
  let impressions = 0
  for (const r of rows) {
    clicks += r.clicks || 0
    impressions += r.impressions || 0
  }
  return { clicks, impressions }
}

type SiteSummary = {
  name: string
  cur: { clicks: number; impressions: number }
  prev: { clicks: number; impressions: number }
  keywordCount: number
  pageCount: number
  topQueries: { kw: string; impressions: number; position: number }[]
  striking: { kw: string; position: number; impressions: number; page: string }[]
}

async function buildSiteSummary(token: string, t: MediaTarget): Promise<SiteSummary> {
  const f = pageFilterGroups(t.pageFilter)
  // 最新確定日 = 3日前。7日窓 ×2（今週 / 前週）
  const [curStart, curEnd] = [daysAgo(9), daysAgo(3)]
  const [prevStart, prevEnd] = [daysAgo(16), daysAgo(10)]
  const cur = sumRows(await gscQuery(token, { startDate: curStart, endDate: curEnd, ...f }))
  const prev = sumRows(await gscQuery(token, { startDate: prevStart, endDate: prevEnd, ...f }))
  const queries = await gscQuery(token, {
    startDate: curStart, endDate: curEnd, dimensions: ['query'], rowLimit: 500, ...f,
  })
  const pages = await gscQuery(token, {
    startDate: curStart, endDate: curEnd, dimensions: ['page'], rowLimit: 500, ...f,
  })
  const qp = await gscQuery(token, {
    startDate: curStart, endDate: curEnd, dimensions: ['query', 'page'], rowLimit: 1000, ...f,
  })
  const topQueries = [...queries]
    .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
    .slice(0, 5)
    .map((r) => ({ kw: r.keys?.[0] || '', impressions: r.impressions || 0, position: r.position || 0 }))
  const striking = qp
    .filter((r) => (r.position || 0) >= 4.5 && (r.position || 0) <= 20 && (r.impressions || 0) >= 3)
    .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
    .slice(0, 8)
    .map((r) => ({
      kw: r.keys?.[0] || '',
      position: r.position || 0,
      impressions: r.impressions || 0,
      page: (r.keys?.[1] || '').replace('https://game.surisuta.jp', ''),
    }))
  return {
    name: t.name, cur, prev,
    keywordCount: queries.length, pageCount: pages.length,
    topQueries, striking,
  }
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

function formatSite(s: SiteSummary): string {
  const dc = s.cur.clicks - s.prev.clicks
  const di = s.cur.impressions - s.prev.impressions
  let out = `\n▼ ${s.name}\n  クリック ${s.cur.clicks}（前週比${signed(dc)}） / 表示 ${s.cur.impressions}（${signed(di)}）`
  out += `\n  ランクインKW ${s.keywordCount} / ページ ${s.pageCount}`
  if (s.keywordCount === 0) {
    out += `\n  （まだ検索表示なし＝インデックス/評価待ち）`
    return out
  }
  if (s.topQueries.length) {
    out += `\n  表示上位KW: ` + s.topQueries.map((q) => `${q.kw}(表示${q.impressions}/${q.position.toFixed(0)}位)`).join(', ')
  }
  if (s.striking.length) {
    out += `\n  あと一歩(5〜20位・本文強化候補):`
    for (const r of s.striking) {
      out += `\n    ・${r.kw}  ${r.position.toFixed(1)}位 表示${r.impressions} → ${r.page}`
    }
  }
  return out
}

async function postSlack(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_ANALYTICS_WEBHOOK_URL
  if (!webhookUrl) throw new Error('SLACK_ANALYTICS_WEBHOOK_URL is not set')
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(`Slack webhook error: ${res.status} ${await res.text().catch(() => '')}`)
}

export async function sendMediaSeoReport(opts: { dryRun?: boolean } = {}): Promise<{
  posted: boolean
  message: string
}> {
  const token = await getAccessToken()
  const summaries: SiteSummary[] = []
  for (const t of TARGETS) summaries.push(await buildSiteSummary(token, t))

  const header = `【週次メディアSEOレポート】${daysAgo(9)}〜${daysAgo(3)}（GSC: sc-domain:surisuta.jp）`
  const body =
    header +
    summaries.map(formatSite).join('\n') +
    `\n\n※新規ドメイン(現DR9)につき立ち上がりは数週間。あと一歩KWの本文強化＋被リンクで上位・1位を狙う。`

  if (opts.dryRun) return { posted: false, message: body }
  await postSlack(body)
  return { posted: true, message: body }
}
