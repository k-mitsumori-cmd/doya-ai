import { GoogleAuth } from 'google-auth-library'
import { prisma } from '@/lib/prisma'

// ============================================
// 毎朝のアクセスレポート（GA4 + Search Console + YouTube → Slack）
// - GA4: 昨日のセッション/ユーザー/PV、チャネル別、人気ページ
// - GSC: 確定日（3日前）のクリック/表示回数/CTR/掲載順位、上位クエリ
//   ※ Search Console のデータは確定まで2〜3日遅れるため対象日が異なる
// - YouTube: チャンネル総再生数・登録者数の前回スナップショットとの差分
//   （Analytics APIはチャンネル所有者OAuthが必要なため、Data API v3 +
//     SystemSettingへの日次スナップショットで増分を算出する方式）
// 対象サイトは環境変数 ANALYTICS_REPORT_TARGETS（JSON配列）、
// YouTubeチャンネルは YOUTUBE_CHANNELS（JSON配列: "@handle" or "UC..."）で定義
// ============================================

export type ReportTarget = {
  name: string
  ga4PropertyId?: string
  gscSiteUrl?: string
}

const GA4_API = 'https://analyticsdata.googleapis.com/v1beta'
const GSC_API = 'https://searchconsole.googleapis.com/webmasters/v3'

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

/** JSTで今日から offsetDays 日前の日付を YYYY-MM-DD で返す */
function jstDate(offsetDays: number): string {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000)
  now.setUTCDate(now.getUTCDate() - offsetDays)
  return now.toISOString().slice(0, 10)
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

// ---------- GA4 ----------

type Ga4Summary = {
  sessions: number
  users: number
  pageViews: number
  prevDay: { sessions: number; users: number; pageViews: number }
  lastWeek: { sessions: number; users: number; pageViews: number }
  channels: { name: string; sessions: number }[]
  topPages: { path: string; views: number }[]
}

async function fetchGa4Summary(propertyId: string, token: string): Promise<Ga4Summary> {
  const base = `${GA4_API}/properties/${propertyId}:runReport`

  // 昨日 / 一昨日 / 前週同曜日 の3期間まとめて取得
  const totals = await googleApiPost(base, token, {
    dateRanges: [
      { startDate: jstDate(1), endDate: jstDate(1), name: 'yesterday' },
      { startDate: jstDate(2), endDate: jstDate(2), name: 'prev_day' },
      { startDate: jstDate(8), endDate: jstDate(8), name: 'last_week' },
    ],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }],
  })

  const byRange: Record<string, number[]> = {}
  for (const row of totals.rows || []) {
    const range = row.dimensionValues?.[0]?.value || ''
    byRange[range] = (row.metricValues || []).map((m: any) => Number(m.value) || 0)
  }
  const pick = (range: string) => {
    const v = byRange[range] || [0, 0, 0]
    return { sessions: v[0], users: v[1], pageViews: v[2] }
  }

  const channelsRes = await googleApiPost(base, token, {
    dateRanges: [{ startDate: jstDate(1), endDate: jstDate(1) }],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 5,
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
    limit: 5,
  })
  const topPages = (pagesRes.rows || []).map((row: any) => ({
    path: row.dimensionValues?.[0]?.value || '(不明)',
    views: Number(row.metricValues?.[0]?.value) || 0,
  }))

  return { ...pick('yesterday'), prevDay: pick('prev_day'), lastWeek: pick('last_week'), channels, topPages }
}

// ---------- Search Console ----------

type GscSummary = {
  date: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  prevWeek: { clicks: number; impressions: number }
  topQueries: { query: string; clicks: number; impressions: number; position: number }[]
}

async function gscQuery(siteUrl: string, token: string, body: unknown): Promise<any> {
  const url = `${GSC_API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
  return googleApiPost(url, token, body)
}

async function fetchGscSummary(siteUrl: string, token: string): Promise<GscSummary> {
  // GSCは確定まで2〜3日かかるため3日前を「最新確定日」として扱う
  const targetDate = jstDate(3)
  const prevWeekDate = jstDate(10)

  const [totalRes, prevRes, queriesRes] = await Promise.all([
    gscQuery(siteUrl, token, { startDate: targetDate, endDate: targetDate }),
    gscQuery(siteUrl, token, { startDate: prevWeekDate, endDate: prevWeekDate }),
    gscQuery(siteUrl, token, {
      // クエリは日次だとブレるので直近7日間（確定分）で集計
      startDate: jstDate(9),
      endDate: targetDate,
      dimensions: ['query'],
      rowLimit: 5,
    }),
  ])

  const total = totalRes.rows?.[0] || {}
  const prev = prevRes.rows?.[0] || {}
  const topQueries = (queriesRes.rows || []).map((row: any) => ({
    query: row.keys?.[0] || '(不明)',
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
    topQueries,
  }
}

// ---------- YouTube ----------

const YT_API = 'https://www.googleapis.com/youtube/v3'
const YT_SNAPSHOT_KEY = 'analytics_report_youtube_snapshot'

type YtVideoStat = { id: string; title: string; views: number; publishedAt: string }

type YtChannelSummary = {
  id: string
  title: string
  totalViews: number
  subscribers: number
  videoCount: number
  // 前回スナップショットとの差分（初回実行時は null）
  viewsDelta: number | null
  subscribersDelta: number | null
  recentVideos: (YtVideoStat & { viewsDelta: number | null })[]
}

type YtSnapshot = Record<string, { totalViews: number; subscribers: number; videos: Record<string, number>; date: string }>

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
  const chRes = await ytGet('channels', {
    part: 'snippet,statistics,contentDetails',
    ...idParam,
  })
  const ch = chRes.items?.[0]
  if (!ch) throw new Error(`チャンネルが見つかりません: ${channel}`)

  const totalViews = Number(ch.statistics?.viewCount) || 0
  const subscribers = Number(ch.statistics?.subscriberCount) || 0
  const uploadsPlaylist = ch.contentDetails?.relatedPlaylists?.uploads

  let recentVideos: (YtVideoStat & { viewsDelta: number | null })[] = []
  const prev = snapshot[ch.id]
  if (uploadsPlaylist) {
    const plRes = await ytGet('playlistItems', {
      part: 'contentDetails',
      playlistId: uploadsPlaylist,
      maxResults: '5',
    })
    const videoIds = (plRes.items || [])
      .map((i: any) => i.contentDetails?.videoId)
      .filter(Boolean)
    if (videoIds.length > 0) {
      const vRes = await ytGet('videos', { part: 'snippet,statistics', id: videoIds.join(',') })
      recentVideos = (vRes.items || []).map((v: any) => {
        const views = Number(v.statistics?.viewCount) || 0
        const prevViews = prev?.videos?.[v.id]
        return {
          id: v.id,
          title: v.snippet?.title || '(無題)',
          views,
          publishedAt: (v.snippet?.publishedAt || '').slice(0, 10),
          viewsDelta: typeof prevViews === 'number' ? views - prevViews : null,
        }
      })
    }
  }

  return {
    id: ch.id,
    title: ch.snippet?.title || channel,
    totalViews,
    subscribers,
    videoCount: Number(ch.statistics?.videoCount) || 0,
    viewsDelta: prev ? totalViews - prev.totalViews : null,
    subscribersDelta: prev ? subscribers - prev.subscribers : null,
    recentVideos,
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
  const snapshot: YtSnapshot = {}
  for (const ch of channels) {
    snapshot[ch.id] = {
      totalViews: ch.totalViews,
      subscribers: ch.subscribers,
      videos: Object.fromEntries(ch.recentVideos.map((v) => [v.id, v.views])),
      date: jstDate(0),
    }
  }
  const value = JSON.stringify(snapshot)
  await prisma.systemSetting.upsert({
    where: { key: YT_SNAPSHOT_KEY },
    update: { value },
    create: { key: YT_SNAPSHOT_KEY, value },
  })
}

function buildYtSection(channels: YtChannelSummary[], errors: string[]): string {
  const lines: string[] = []
  lines.push('■ YouTube')
  for (const ch of channels) {
    lines.push(`《${ch.title}》`)
    lines.push(
      `・再生数（前回計測から）: ${ch.viewsDelta === null ? '計測開始（明日から表示）' : `+${fmt(ch.viewsDelta)}`} / 累計 ${fmt(ch.totalViews)}`,
    )
    lines.push(
      `・チャンネル登録者: ${fmt(ch.subscribers)}${ch.subscribersDelta === null ? '' : `（増減 ${ch.subscribersDelta >= 0 ? '+' : ''}${fmt(ch.subscribersDelta)}）`}`,
    )
    if (ch.recentVideos.length > 0) {
      lines.push('・直近の動画:')
      for (const v of ch.recentVideos) {
        const delta = v.viewsDelta === null ? '' : `（+${fmt(v.viewsDelta)}）`
        lines.push(`    [${v.publishedAt}] ${v.title}  ${fmt(v.views)}回${delta}`)
      }
    }
  }
  for (const err of errors) {
    lines.push(`（取得エラー: ${err}）`)
  }
  return lines.join('\n')
}

// ---------- レポート組み立て ----------

function buildTargetSection(
  target: ReportTarget,
  ga4: Ga4Summary | null,
  gsc: GscSummary | null,
  errors: string[],
): string {
  const lines: string[] = []
  lines.push(`■ ${target.name}`)

  if (ga4) {
    lines.push(`《アクセス状況（昨日 ${jstDate(1)}）》`)
    lines.push(
      `・セッション: ${fmt(ga4.sessions)}（前日比 ${diffPct(ga4.sessions, ga4.prevDay.sessions)} / 前週同曜日比 ${diffPct(ga4.sessions, ga4.lastWeek.sessions)}）`,
    )
    lines.push(`・ユーザー: ${fmt(ga4.users)}（前日比 ${diffPct(ga4.users, ga4.prevDay.users)}）`)
    lines.push(`・ページビュー: ${fmt(ga4.pageViews)}（前日比 ${diffPct(ga4.pageViews, ga4.prevDay.pageViews)}）`)
    if (ga4.channels.length > 0) {
      lines.push(`・流入チャネル: ${ga4.channels.map((c) => `${c.name} ${fmt(c.sessions)}`).join(' / ')}`)
    }
    if (ga4.topPages.length > 0) {
      lines.push('・人気ページ:')
      for (const p of ga4.topPages) {
        lines.push(`    ${p.path}  ${fmt(p.views)}PV`)
      }
    }
  }

  if (gsc) {
    lines.push(`《Google検索（確定日 ${gsc.date}）》`)
    lines.push(
      `・クリック: ${fmt(gsc.clicks)}（前週同曜日比 ${diffPct(gsc.clicks, gsc.prevWeek.clicks)}） / 表示回数: ${fmt(gsc.impressions)}（${diffPct(gsc.impressions, gsc.prevWeek.impressions)}）`,
    )
    lines.push(`・CTR: ${(gsc.ctr * 100).toFixed(1)}% / 平均掲載順位: ${gsc.position.toFixed(1)}位`)
    if (gsc.topQueries.length > 0) {
      lines.push('・上位クエリ（直近7日）:')
      for (const q of gsc.topQueries) {
        lines.push(`    ${q.query}  クリック${fmt(q.clicks)} / 表示${fmt(q.impressions)} / ${q.position.toFixed(1)}位`)
      }
    }
  }

  for (const err of errors) {
    lines.push(`（取得エラー: ${err}）`)
  }

  return lines.join('\n')
}

export async function sendAnalyticsReport(): Promise<{ targets: number; errors: string[] }> {
  const webhookUrl = process.env.SLACK_ANALYTICS_WEBHOOK_URL
  if (!webhookUrl) {
    throw new Error('SLACK_ANALYTICS_WEBHOOK_URL is not set')
  }
  const targets = getTargets()
  if (targets.length === 0 && getYoutubeChannels().length === 0) {
    throw new Error('ANALYTICS_REPORT_TARGETS / YOUTUBE_CHANNELS のいずれも未設定です')
  }

  const token = targets.length > 0 ? await getAccessToken() : ''
  const allErrors: string[] = []
  const sections: string[] = []

  for (const target of targets) {
    const errors: string[] = []
    let ga4: Ga4Summary | null = null
    let gsc: GscSummary | null = null

    if (target.ga4PropertyId) {
      try {
        ga4 = await fetchGa4Summary(target.ga4PropertyId, token)
      } catch (e: any) {
        errors.push(`GA4: ${e?.message || e}`)
      }
    }
    if (target.gscSiteUrl) {
      try {
        gsc = await fetchGscSummary(target.gscSiteUrl, token)
      } catch (e: any) {
        errors.push(`Search Console: ${e?.message || e}`)
      }
    }

    sections.push(buildTargetSection(target, ga4, gsc, errors))
    allErrors.push(...errors.map((e) => `${target.name}: ${e}`))
  }

  // YouTube（設定されている場合のみ）
  const ytChannels = getYoutubeChannels()
  if (ytChannels.length > 0) {
    const ytErrors: string[] = []
    const summaries: YtChannelSummary[] = []
    const snapshot = await loadYtSnapshot()
    for (const channel of ytChannels) {
      try {
        summaries.push(await fetchYtChannel(channel, snapshot))
      } catch (e: any) {
        ytErrors.push(`${channel}: ${e?.message || e}`)
      }
    }
    if (summaries.length > 0 || ytErrors.length > 0) {
      sections.push(buildYtSection(summaries, ytErrors))
    }
    if (summaries.length > 0) {
      await saveYtSnapshot(summaries).catch((e) => {
        console.error('[analytics-report] failed to save YouTube snapshot:', e)
        ytErrors.push('スナップショット保存に失敗')
      })
    }
    allErrors.push(...ytErrors.map((e) => `YouTube: ${e}`))
  }

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const header = `【アクセスレポート】${today.toISOString().slice(0, 10)} 朝`
  const text = [header, '', sections.join('\n\n')].join('\n')

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    throw new Error(`Slack webhook error: ${res.status} ${await res.text().catch(() => '')}`)
  }

  return { targets: targets.length, errors: allErrors }
}
