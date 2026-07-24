import { prisma } from '@/lib/prisma'

/**
 * 毎朝のアクセスレポートに載せる「コンテンツ・SNS予約状況」セクション。
 * - X Harness の予約投稿（アカウント別の残数・今日の予定時刻・次回予定）
 * - IG Harness の予約投稿（残数・次回配信）
 * - 呪い日記メディアのドリップ公開進捗（sitemap 実測 + 前回スナップショット差分）
 *
 * 認証情報は env（X_HARNESS_API_URL/X_HARNESS_API_KEY, IG_HARNESS_API_URL/IG_HARNESS_API_KEY）。
 * 未設定の項目は黙ってスキップし、取得失敗はエラーとして返す（レポート全体は止めない）。
 */

const MEDIA_SNAPSHOT_KEY = 'noroi_media_publish_snapshot'

/** レポートに載せる IG アカウント（ig-harness の ig_accounts.id） */
const IG_ACCOUNTS: { id: string; label: string }[] = [
  { id: '89d8f7aa-f1de-44c7-98ef-086f87f740b1', label: 'noroi.nikki' },
  { id: 'c65b19e5-cf4f-4d94-bb7f-4f888f84205a', label: 'noroiglobal' },
]

/** X アカウントの表示順（呪い日記系を先頭に。未掲載のアカウントは末尾に続く） */
const X_HANDLE_ORDER = [
  'noroinikki_noro',
  'noroiglobal',
  'doyamarke',
  'yurusen2026',
  'YurusenGlobal',
  'mitsumori_ai',
]

/** JSTの YYYY-MM-DD */
function jstDateStr(offsetDays = 0): string {
  const d = new Date(Date.now() + 9 * 3600_000 - offsetDays * 86_400_000)
  return d.toISOString().slice(0, 10)
}

/** ISO日時文字列（Z/+09:00混在）→ JSTの {date, hhmm} */
function toJst(iso: string): { date: string; hhmm: string } | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const s = new Date(t + 9 * 3600_000).toISOString()
  return { date: s.slice(0, 10), hhmm: s.slice(11, 16) }
}

/** "YYYY-MM-DD" → "M/D" */
function md(date: string): string {
  const [, m, d] = date.split('-')
  return `${Number(m)}/${Number(d)}`
}

// ---------- 呪い日記メディア ドリップ公開進捗 ----------

type MediaCounts = { articles: number; zukan: number }

async function fetchMediaPublishedCounts(): Promise<MediaCounts> {
  const res = await fetch('https://game.surisuta.jp/noroi/sitemap.xml', {
    headers: { 'User-Agent': 'doya-analytics-report' },
  })
  if (!res.ok) throw new Error(`sitemap ${res.status}`)
  const xml = await res.text()
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] || '')
  let articles = 0
  let zukan = 0
  for (const loc of locs) {
    // ja のみ数える（/en/ /zh/ は同一コンテンツの言語違い）。/media/zukan はハブなので除外
    if (/^https:\/\/game\.surisuta\.jp\/noroi\/media\/zukan\/[^/]+\/?$/.test(loc)) zukan++
    else if (
      /^https:\/\/game\.surisuta\.jp\/noroi\/media\/[^/]+\/?$/.test(loc) &&
      !/\/media\/zukan\/?$/.test(loc)
    )
      articles++
  }
  return { articles, zukan }
}

async function buildMediaLines(errors: string[]): Promise<string[]> {
  try {
    const counts = await fetchMediaPublishedCounts()
    let diffText = ''
    try {
      const row = await prisma.systemSetting.findUnique({ where: { key: MEDIA_SNAPSHOT_KEY } })
      const prev = row ? (JSON.parse(row.value) as MediaCounts & { date?: string }) : null
      if (prev) {
        const da = counts.articles - (prev.articles ?? 0)
        const dz = counts.zukan - (prev.zukan ?? 0)
        const parts: string[] = []
        if (da > 0) parts.push(`記事+${da}`)
        if (dz > 0) parts.push(`図鑑+${dz}`)
        diffText = parts.length > 0 ? `（前回比 ${parts.join('・')}）` : '（新規公開なし）'
      }
      await prisma.systemSetting.upsert({
        where: { key: MEDIA_SNAPSHOT_KEY },
        create: { key: MEDIA_SNAPSHOT_KEY, value: JSON.stringify({ ...counts, date: jstDateStr() }) },
        update: { value: JSON.stringify({ ...counts, date: jstDateStr() }) },
      })
    } catch {
      // スナップショット失敗は差分表示を諦めるだけ（現在値は出す）
    }
    return [
      `・呪い日記メディア: 記事${counts.articles}本・図鑑${counts.zukan}体を公開済み${diffText}（毎日すこしずつ自動公開中）`,
    ]
  } catch (e: any) {
    errors.push(`メディア公開進捗: ${e?.message || e}`)
    return []
  }
}

// ---------- X Harness 予約投稿 ----------

async function buildXLines(errors: string[]): Promise<string[]> {
  const base = process.env.X_HARNESS_API_URL
  const key = process.env.X_HARNESS_API_KEY
  if (!base || !key) return []
  try {
    const headers = { Authorization: `Bearer ${key}` }
    const [accountsRes, scheduledRes] = await Promise.all([
      fetch(`${base}/api/x-accounts`, { headers }),
      fetch(`${base}/api/posts/scheduled`, { headers }),
    ])
    if (!accountsRes.ok) throw new Error(`x-accounts ${accountsRes.status}`)
    if (!scheduledRes.ok) throw new Error(`posts/scheduled ${scheduledRes.status}`)
    const accounts: { id: string; username: string }[] = (await accountsRes.json()).data ?? []
    const scheduled: { xAccountId: string; scheduledAt: string }[] =
      (await scheduledRes.json()).data ?? []

    const handleOf = new Map(accounts.map((a) => [a.id, a.username]))
    const today = jstDateStr()
    const nowMs = Date.now()

    type Acc = { total: number; todayTimes: string[]; next: { ms: number; date: string; hhmm: string } | null }
    const byHandle = new Map<string, Acc>()
    for (const p of scheduled) {
      const handle = handleOf.get(p.xAccountId) ?? p.xAccountId.slice(0, 8)
      const acc = byHandle.get(handle) ?? { total: 0, todayTimes: [], next: null }
      acc.total++
      const jst = toJst(p.scheduledAt)
      if (jst) {
        if (jst.date === today) acc.todayTimes.push(jst.hhmm)
        const ms = Date.parse(p.scheduledAt)
        if (ms > nowMs && (!acc.next || ms < acc.next.ms)) {
          acc.next = { ms, date: jst.date, hhmm: jst.hhmm }
        }
      }
      byHandle.set(handle, acc)
    }

    const orderedHandles = [
      ...X_HANDLE_ORDER.filter((h) => byHandle.has(h)),
      ...[...byHandle.keys()].filter((h) => !X_HANDLE_ORDER.includes(h)).sort(),
    ]
    const lines: string[] = []
    for (const handle of orderedHandles) {
      const acc = byHandle.get(handle)
      if (!acc) continue
      const todayText =
        acc.todayTimes.length > 0
          ? `今日${acc.todayTimes.length}件（${acc.todayTimes.sort().join('・')}）`
          : acc.next
            ? `今日はなし・次回${md(acc.next.date)} ${acc.next.hhmm}`
            : '今後の予定なし'
      lines.push(`・X @${handle}: 予約残り${acc.total}件 / ${todayText}`)
    }
    return lines
  } catch (e: any) {
    errors.push(`X予約投稿: ${e?.message || e}`)
    return []
  }
}

// ---------- IG Harness 予約投稿 ----------

async function buildIgLines(errors: string[]): Promise<string[]> {
  const base = process.env.IG_HARNESS_API_URL
  const key = process.env.IG_HARNESS_API_KEY
  if (!base || !key) return []
  const lines: string[] = []
  for (const account of IG_ACCOUNTS) {
    try {
      const res = await fetch(
        `${base}/api/scheduled-posts?account_id=${account.id}&status=pending&limit=200`,
        { headers: { Authorization: `Bearer ${key}` } },
      )
      if (!res.ok) throw new Error(`scheduled-posts ${res.status}`)
      const json = await res.json()
      const pending: number = json.counts?.pending ?? (json.data ?? []).length
      if (pending === 0) continue
      const nowMs = Date.now()
      let next: { date: string; hhmm: string; ms: number } | null = null
      for (const p of json.data ?? []) {
        const ms = Date.parse(p.scheduled_at)
        const jst = toJst(p.scheduled_at)
        if (jst && ms > nowMs && (!next || ms < next.ms)) next = { ...jst, ms }
      }
      const nextText = next ? ` / 次回${md(next.date)} ${next.hhmm}` : ''
      lines.push(`・Instagram @${account.label}: 予約残り${pending}件${nextText}`)
    } catch (e: any) {
      errors.push(`IG予約投稿(${account.label}): ${e?.message || e}`)
    }
  }
  return lines
}

// ---------- セクション組み立て ----------

export async function buildContentScheduleSection(): Promise<{
  section: string | null
  errors: string[]
}> {
  const errors: string[] = []
  const [mediaLines, xLines, igLines] = await Promise.all([
    buildMediaLines(errors),
    buildXLines(errors),
    buildIgLines(errors),
  ])
  const lines = [...mediaLines, ...xLines, ...igLines]

  if (lines.length === 0 && errors.length === 0) return { section: null, errors }
  const body = [
    '《コンテンツ・SNS予約状況》',
    ...lines,
    ...errors.map((e) => `（取得エラー: ${e}）`),
  ].join('\n')
  return { section: body, errors }
}
