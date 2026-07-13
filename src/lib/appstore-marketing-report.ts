import { prisma } from '@/lib/prisma'

// ============================================
// 呪い日記 アプリマーケ日次レポート（App Store 公開API → Slack）
//
// 取得（すべて無料の公開API）:
// 1) ストア評価 — 平均★・レビュー件数（iTunes Lookup API）
// 2) チャート順位 — 総合／カテゴリ（iTunes RSS）
// 3) キーワード検索順位 — 指定キーワードでの掲載順位（iTunes Search API）
//
// 前日スナップショット（SystemSetting）との差分で増減を併記する。
//
// 注意:
// - iTunes Search API の並びは実App Store検索と細部が異なる場合がある（近似）
// - 圏外 = 取得上限（検索200位／チャート100位）以内に該当なし
//
// 対象アプリ: APPSTORE_APP_ID（既定=呪い日記 6786964992）
// キーワード: APPSTORE_MARKETING_KEYWORDS（カンマ区切り。未指定は既定セット）
// 通知先: SLACK_APPSTORE_MARKETING_WEBHOOK_URL（未設定は SLACK_APPSTORE_WEBHOOK_URL）
// ============================================

const DEFAULT_APP_ID = '6786964992'
const DEFAULT_COUNTRY = 'jp'
const DEFAULT_KEYWORDS = ['呪い日記', '呪い', '日記', 'おまじない', '厄除け', '復讐', '呪術']
const SNAPSHOT_KEY = 'appstore_marketing_snapshot'
const SEARCH_LIMIT = 200
const CHART_LIMIT = 100

function appId(): string {
  return (process.env.APPSTORE_APP_ID || DEFAULT_APP_ID).trim()
}
function country(): string {
  return (process.env.APPSTORE_MARKETING_COUNTRY || DEFAULT_COUNTRY).trim()
}
function keywords(): string[] {
  const raw = process.env.APPSTORE_MARKETING_KEYWORDS
  if (!raw || !raw.trim()) return DEFAULT_KEYWORDS
  return raw.split(',').map((k) => k.trim()).filter(Boolean)
}

function jstDateStr(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

// ---------- 公開API ----------

type AppInfo = {
  name: string
  genreName: string
  genreId: string
  rating: number
  reviewCount: number
  version: string
}

async function lookupApp(): Promise<AppInfo | null> {
  const url = `https://itunes.apple.com/lookup?id=${appId()}&country=${country()}`
  const res = await fetch(url)
  if (!res.ok) return null
  const json = (await res.json()) as any
  const r = json?.results?.[0]
  if (!r) return null
  return {
    name: r.trackName || '呪い日記',
    genreName: r.primaryGenreName || '',
    genreId: String(r.primaryGenreId || ''),
    rating: Number(r.averageUserRating) || 0,
    reviewCount: Number(r.userRatingCount) || 0,
    version: r.version || '',
  }
}

/** キーワード検索での掲載順位（該当なしは null） */
async function searchRank(keyword: string): Promise<number | null> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(keyword)}&country=${country()}&entity=software&limit=${SEARCH_LIMIT}`
  const res = await fetch(url)
  if (!res.ok) return null
  const json = (await res.json()) as any
  const ids: string[] = (json?.results || []).map((x: any) => String(x.trackId))
  const idx = ids.indexOf(appId())
  return idx === -1 ? null : idx + 1
}

/** 総合チャート順位（無料アプリTOP。該当なしは null） */
async function overallChartRank(): Promise<number | null> {
  const url = `https://itunes.apple.com/${country()}/rss/topfreeapplications/limit=${CHART_LIMIT}/json`
  const res = await fetch(url)
  if (!res.ok) return null
  const json = (await res.json()) as any
  const entries: any[] = json?.feed?.entry || []
  const ids = entries.map((e) => e?.id?.attributes?.['im:id'])
  const idx = ids.indexOf(appId())
  return idx === -1 ? null : idx + 1
}

/** カテゴリ別チャート順位（該当なしは null） */
async function categoryChartRank(genreId: string): Promise<number | null> {
  if (!genreId) return null
  const url = `https://itunes.apple.com/${country()}/rss/topfreeapplications/limit=${CHART_LIMIT}/genre=${genreId}/json`
  const res = await fetch(url)
  if (!res.ok) return null
  const json = (await res.json()) as any
  const entries: any[] = json?.feed?.entry || []
  const ids = entries.map((e) => e?.id?.attributes?.['im:id'])
  const idx = ids.indexOf(appId())
  return idx === -1 ? null : idx + 1
}

// ---------- スナップショット（前日比） ----------

type Snapshot = {
  date: string
  rating: number
  reviewCount: number
  overall: number | null
  category: number | null
  keywords: Record<string, number | null>
}

async function loadSnapshot(): Promise<Snapshot | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key: SNAPSHOT_KEY } })
  if (!row?.value) return null
  try {
    return JSON.parse(row.value) as Snapshot
  } catch {
    return null
  }
}

async function saveSnapshot(snap: Snapshot): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: SNAPSHOT_KEY },
    update: { value: JSON.stringify(snap) },
    create: { key: SNAPSHOT_KEY, value: JSON.stringify(snap) },
  })
}

// ---------- 表示ヘルパー ----------

function rankLabel(rank: number | null, limit: number): string {
  return rank === null ? `圏外（TOP${limit}外）` : `${rank}位`
}

/** 順位の増減（数値が小さいほど良い）。前回nullからの浮上/圏外落ちも表現 */
function rankDelta(cur: number | null, prev: number | null | undefined): string {
  if (prev === undefined) return ''
  if (cur === null && prev === null) return ''
  if (cur === null && prev !== null) return '（圏外に後退）'
  if (cur !== null && (prev === null || prev === undefined)) return '（新規ランクイン）'
  if (cur !== null && prev !== null) {
    const diff = prev - cur // 正=順位が上がった
    if (diff > 0) return `（↑${diff}）`
    if (diff < 0) return `（↓${-diff}）`
    return '（→）'
  }
  return ''
}

function countDelta(cur: number, prev: number | undefined): string {
  if (prev === undefined) return ''
  const d = cur - prev
  if (d > 0) return `（+${d}）`
  if (d < 0) return `（${d}）`
  return '（±0）'
}

// ---------- Slack ----------

async function postSlack(text: string): Promise<void> {
  const webhookUrl =
    process.env.SLACK_APPSTORE_MARKETING_WEBHOOK_URL || process.env.SLACK_APPSTORE_WEBHOOK_URL
  if (!webhookUrl) {
    throw new Error('SLACK_APPSTORE_MARKETING_WEBHOOK_URL / SLACK_APPSTORE_WEBHOOK_URL is not set')
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

export type MarketingReportResult = {
  date: string
  rating: number
  reviewCount: number
  overall: number | null
  category: number | null
  keywords: Record<string, number | null>
}

export async function sendAppStoreMarketingReport(): Promise<MarketingReportResult> {
  const date = jstDateStr()
  const info = await lookupApp()
  const genreId = info?.genreId || '6012' // 既定=ライフスタイル

  // 各種順位を並行取得
  const kws = keywords()
  const [overall, category, ...kwRanks] = await Promise.all([
    overallChartRank(),
    categoryChartRank(genreId),
    ...kws.map((k) => searchRank(k)),
  ])
  const keywordRanks: Record<string, number | null> = {}
  kws.forEach((k, i) => {
    keywordRanks[k] = kwRanks[i]
  })

  const prev = await loadSnapshot()

  // ---- メッセージ整形 ----
  const lines: string[] = []
  lines.push(`呪い日記 アプリマーケ日次レポート（${date}）`)
  lines.push('────────────────')

  lines.push('■ ストア評価')
  if (info) {
    const rc = info.reviewCount
    lines.push(
      `平均 ★${info.rating.toFixed(1)}／レビュー ${rc.toLocaleString('ja-JP')}件${countDelta(rc, prev?.reviewCount)}`,
    )
  } else {
    lines.push('取得できませんでした')
  }
  lines.push('')

  lines.push('■ チャート順位')
  lines.push(`総合: ${rankLabel(overall, CHART_LIMIT)}${rankDelta(overall, prev?.overall)}`)
  lines.push(
    `${info?.genreName || 'カテゴリ'}: ${rankLabel(category, CHART_LIMIT)}${rankDelta(category, prev?.category)}`,
  )
  lines.push('')

  lines.push(`■ キーワード検索順位（${country()}）`)
  for (const k of kws) {
    const cur = keywordRanks[k]
    const label = cur === null ? '圏外' : `${cur}位`
    lines.push(`${k}: ${label}${rankDelta(cur, prev?.keywords?.[k])}`)
  }
  lines.push('')
  lines.push(
    '※ 検索順位はiTunes Search APIベース（実App Store検索と細部が異なる場合あり）。圏外=検索200位／チャート100位以内に該当なし。',
  )

  await postSlack(lines.join('\n'))

  // ---- スナップショット保存 ----
  const snap: Snapshot = {
    date,
    rating: info?.rating || 0,
    reviewCount: info?.reviewCount || 0,
    overall,
    category,
    keywords: keywordRanks,
  }
  await saveSnapshot(snap)

  return {
    date,
    rating: snap.rating,
    reviewCount: snap.reviewCount,
    overall,
    category,
    keywords: keywordRanks,
  }
}
