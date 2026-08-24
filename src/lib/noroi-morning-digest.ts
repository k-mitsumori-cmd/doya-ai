import { prisma } from '@/lib/prisma'
import { sendAppStoreReport } from '@/lib/appstore-report'
import { sendAppStoreMarketingReport } from '@/lib/appstore-marketing-report'
import { sendAppStoreCountryReport, countryLabel } from '@/lib/appstore-country-report'
import { sendAppStoreSourceReport } from '@/lib/appstore-source-report'
import { sendNoroiEngagementReport } from '@/lib/noroi-engagement-report'

// ============================================
// 呪い日記「朝刊」— 1日1通の統合ダイジェスト（JST 10:00）
//
// これまで 10:00〜10:35 に5通へ分かれていた通知を1通にまとめたもの。
//   売上/DL・アプリ内の動き・流入経路・国別・ストア/順位・SNS
// 各セクションは既存レポートの集計関数を deliver:false で呼んで“数字だけ”受け取り、
// ここで短く組み直す。1つ落ちても他は出す（セクション単位で try/catch）。
//
// 先頭に「きのうを一言で」を置くのが主眼。数字の羅列ではなく、
// 良くなった点を拾って明るく言い切る。悪い時は事実だけ淡々と書く（誇張しない）。
//
// 通知先: SLACK_APPSTORE_WEBHOOK_URL
// ============================================

const YT_API = 'https://www.googleapis.com/youtube/v3'
const YT_SNAPSHOT_KEY = 'noroi_digest_youtube_snapshot'

/** 朝刊に載せる YouTube チャンネル（呪い日記の日英） */
const YT_CHANNELS: { id: string; label: string }[] = [
  { id: 'UCxfO6w6rf-jzF2IFl34NQSA', label: 'ノロッピー@呪い日記' },
  { id: 'UCuWdi7IEVypvhApM-b5_t4A', label: 'Curse Diary（英語）' },
]

// ---------- 小物 ----------

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('ja-JP')
}
function fmtYen(n: number): string {
  return `¥${fmtInt(n)}`
}
/** 増減を符号つきで。0 は「±0」 */
function delta(n: number): string {
  if (n > 0) return `+${fmtInt(n)}`
  if (n < 0) return `−${fmtInt(Math.abs(n))}`
  return '±0'
}
function deltaYen(n: number): string {
  if (n > 0) return `+${fmtYen(n)}`
  if (n < 0) return `−${fmtYen(Math.abs(n))}`
  return '±0'
}
/** 順位は小さいほど良い。改善を ↑ で表す */
function rankDelta(cur: number | null, prev: number | null | undefined): string {
  if (cur === null || prev === null || prev === undefined) return ''
  const d = prev - cur
  if (d > 0) return `（↑${d}）`
  if (d < 0) return `（↓${Math.abs(d)}）`
  return '（→）'
}
function rankLabel(r: number | null): string {
  return r === null ? '圏外' : `${r}位`
}
/** 2026-08-23 → 8/23 */
function md(d: string | null): string {
  if (!d) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  return m ? `${Number(m[2])}/${Number(m[3])}` : d
}
function jstToday(): string {
  const now = new Date(Date.now() + 9 * 3600 * 1000)
  return now.toISOString().slice(0, 10)
}
function jstWeekday(): string {
  const now = new Date(Date.now() + 9 * 3600 * 1000)
  return ['日', '月', '火', '水', '木', '金', '土'][now.getUTCDay()]
}

async function postSlack(text: string): Promise<void> {
  const url = process.env.SLACK_APPSTORE_WEBHOOK_URL
  if (!url) throw new Error('SLACK_APPSTORE_WEBHOOK_URL is not set')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    throw new Error(`Slack webhook error: ${res.status} ${await res.text().catch(() => '')}`)
  }
}

// ---------- YouTube ----------

type YtSnap = Record<string, { views: number; subs: number; date: string }>
type YtRow = { label: string; views: number; subs: number; viewsDelta: number | null; subsDelta: number | null }

async function fetchYoutube(): Promise<YtRow[]> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set')

  let snap: YtSnap = {}
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: YT_SNAPSHOT_KEY } })
    if (row) snap = JSON.parse(row.value)
  } catch {
    // スナップショットが読めなくても当日値は出す（増分だけ省略）
  }

  const qs = new URLSearchParams({
    part: 'snippet,statistics',
    id: YT_CHANNELS.map((c) => c.id).join(','),
    key: apiKey,
  })
  const res = await fetch(`${YT_API}/channels?${qs}`)
  if (!res.ok) {
    throw new Error(`YouTube API error ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  }
  const data = await res.json()

  const rows: YtRow[] = []
  const next: YtSnap = {}
  const today = jstToday()
  for (const ch of YT_CHANNELS) {
    const item = (data.items || []).find((i: any) => i.id === ch.id)
    if (!item) continue
    const views = Number(item.statistics?.viewCount) || 0
    const subs = Number(item.statistics?.subscriberCount) || 0
    const prev = snap[ch.id]
    rows.push({
      label: ch.label,
      views,
      subs,
      viewsDelta: prev ? views - prev.views : null,
      subsDelta: prev ? subs - prev.subs : null,
    })
    next[ch.id] = { views, subs, date: today }
  }

  try {
    await prisma.systemSetting.upsert({
      where: { key: YT_SNAPSHOT_KEY },
      create: { key: YT_SNAPSHOT_KEY, value: JSON.stringify(next) },
      update: { value: JSON.stringify(next) },
    })
  } catch {
    // 保存に失敗しても今回の表示は成立するので握りつぶす（次回が「計測開始」に戻るだけ）
  }
  return rows
}

// ---------- 見出し（きのうを一言で） ----------

type Highlights = {
  dl: number
  dlDiff: number | null
  grossDiff: number | null
  gross: number
  topSource: string | null
  rankUp: string | null
  ytViewsDelta: number | null
  newUsers: number | null
}

/**
 * 明るく、ただし事実だけで見出しを作る。
 * 伸びた項目があればそれを主役にし、無ければ静かな日として淡々と書く。
 */
function buildHeadline(h: Highlights): string[] {
  const L: string[] = []

  // 1行目: DL と売上
  if (h.dl === 0 && h.gross === 0) {
    L.push('きのうは 新規ダウンロード・売上ともにありませんでした。')
  } else {
    const dlPart =
      h.dlDiff === null
        ? `ダウンロード${fmtInt(h.dl)}件`
        : `ダウンロード${fmtInt(h.dl)}件（${delta(h.dlDiff)}）`
    const grossPart =
      h.grossDiff === null ? `売上${fmtYen(h.gross)}` : `売上${fmtYen(h.gross)}（${deltaYen(h.grossDiff)}）`
    L.push(`きのうは ${dlPart}・${grossPart}。`)
  }

  // 2行目: 良かったことを拾う（最大2つ。無ければ書かない）
  const good: string[] = []
  if (h.rankUp) good.push(h.rankUp)
  if (h.topSource) good.push(`流入は${h.topSource}が最多`)
  if (h.ytViewsDelta !== null && h.ytViewsDelta > 0) {
    good.push(`YouTubeが${delta(h.ytViewsDelta)}再生`)
  }
  if (h.newUsers !== null && h.newUsers > 0 && (h.dlDiff === null || h.dlDiff <= 0)) {
    // DLが伸びていない日でも、新規登録が出ていれば拾う
    good.push(`新規登録${fmtInt(h.newUsers)}人`)
  }
  if (good.length > 0) L.push(good.slice(0, 2).join('。') + '。')

  return L
}

// ---------- メイン ----------

export type DigestResult = {
  delivered: boolean
  errors: string[]
}

/**
 * 呪い日記の朝刊を組み立てて Slack に1通で送る。
 * @param opts.deliver false なら送信せず本文だけ返す（動作確認用）
 */
export async function sendNoroiMorningDigest(
  opts: { deliver?: boolean } = {},
): Promise<DigestResult & { message: string }> {
  const deliver = opts.deliver !== false
  const errors: string[] = []
  const L: string[] = []

  // --- 各セクションの数字を集める（1つ落ちても続行）---
  const sales = await sendAppStoreReport({ deliver: false }).catch((e) => {
    errors.push(`売上/DL: ${e instanceof Error ? e.message : String(e)}`)
    return null
  })
  const engagement = await sendNoroiEngagementReport({ deliver: false }).catch((e) => {
    errors.push(`アプリ内の動き: ${e instanceof Error ? e.message : String(e)}`)
    return null
  })
  const source = await sendAppStoreSourceReport({ deliver: false }).catch((e) => {
    errors.push(`流入経路: ${e instanceof Error ? e.message : String(e)}`)
    return null
  })
  const country = await sendAppStoreCountryReport({ deliver: false }).catch((e) => {
    errors.push(`国別: ${e instanceof Error ? e.message : String(e)}`)
    return null
  })
  const marketing = await sendAppStoreMarketingReport({ deliver: false }).catch((e) => {
    errors.push(`ストア/順位: ${e instanceof Error ? e.message : String(e)}`)
    return null
  })
  const youtube = await fetchYoutube().catch((e) => {
    errors.push(`YouTube: ${e instanceof Error ? e.message : String(e)}`)
    return null
  })

  // --- 見出し用のハイライトを作る ---
  const sortedSources = source
    ? Object.entries(source.bySourceType).sort((a, b) => b[1].downloads - a[1].downloads)
    : []
  const totalSourceDl = sortedSources.reduce((s, [, v]) => s + v.downloads, 0)

  let rankUp: string | null = null
  if (marketing && marketing.prev) {
    const cands: { label: string; up: number }[] = []
    if (marketing.category !== null && marketing.prev.category !== null && marketing.prev.category !== undefined) {
      const up = marketing.prev.category - marketing.category
      if (up > 0) cands.push({ label: `${marketing.genreName || 'カテゴリ'}${marketing.category}位（↑${up}）`, up })
    }
    for (const [kw, cur] of Object.entries(marketing.keywords)) {
      const p = marketing.prev.keywords?.[kw]
      if (cur !== null && p !== null && p !== undefined) {
        const up = p - cur
        if (up > 0) cands.push({ label: `「${kw}」が${cur}位（↑${up}）`, up })
      }
    }
    cands.sort((a, b) => b.up - a.up)
    if (cands[0]) rankUp = cands[0].label
  }

  const ytTotalDelta =
    youtube && youtube.some((r) => r.viewsDelta !== null)
      ? youtube.reduce((s, r) => s + (r.viewsDelta || 0), 0)
      : null

  L.push(`■ 呪い日記 朝刊　${md(jstToday())}（${jstWeekday()}）`)
  L.push('')
  L.push(
    ...buildHeadline({
      dl: sales?.downloads ?? 0,
      dlDiff: sales?.prev ? sales.downloads - sales.prev.downloads : null,
      gross: sales?.grossJpy ?? 0,
      grossDiff: sales?.prev ? sales.grossJpy - sales.prev.grossJpy : null,
      topSource: totalSourceDl > 0 && sortedSources[0] ? sourceJa(sortedSources[0][0]) : null,
      rankUp,
      ytViewsDelta: ytTotalDelta,
      newUsers: engagement?.newUsers ?? null,
    }),
  )

  // --- ダウンロード・売上 ---
  if (sales) {
    L.push('')
    L.push(`■ ダウンロード・売上（${md(sales.reportDate)}分）`)
    if (sales.prev) {
      L.push(
        `　DL ${fmtInt(sales.downloads)}件（前日 ${fmtInt(sales.prev.downloads)} → ${delta(sales.downloads - sales.prev.downloads)}）`,
      )
      L.push(
        `　売上 ${fmtYen(sales.grossJpy)} 税込（前日 ${fmtYen(sales.prev.grossJpy)} → ${deltaYen(sales.grossJpy - sales.prev.grossJpy)}）`,
      )
    } else {
      L.push(`　DL ${fmtInt(sales.downloads)}件`)
      L.push(`　売上 ${fmtYen(sales.grossJpy)} 税込`)
    }
    L.push(`　手取り ${fmtYen(sales.proceedsJpy)}／購入 ${fmtInt(sales.purchaseUnits)}件`)
  }

  // --- アプリ内の動き ---
  if (engagement) {
    L.push('')
    L.push(`■ アプリ内の動き（${md(engagement.day)}分）`)
    L.push(
      `　DAU ${fmtInt(engagement.dau)}人／新規 ${fmtInt(engagement.newUsers)}人／累計 ${fmtInt(engagement.totalUsers)}人`,
    )
    L.push(`　日記 ${fmtInt(engagement.diaryPosts)}件／ガチャ ${fmtInt(engagement.gachaDraws)}回`)
    const ret = engagement.d1Retention === null ? '—' : `${engagement.d1Retention}%`
    L.push(
      `　課金 ${fmtYen(engagement.revenueJpy)}（${fmtInt(engagement.purchaseCount)}件）／D1継続 ${ret}`,
    )
  }

  // --- 流入経路 ---
  if (source) {
    L.push('')
    if (source.status !== 'ok') {
      L.push('■ 流入経路')
      L.push('　Apple 側でデータ生成待ちです（通常1〜2日）。')
    } else {
      L.push(`■ 流入経路（${md(source.processingDate)}分）`)
      if (sortedSources.length === 0) {
        L.push('　この日の流入データはありませんでした。')
      } else {
        if (totalSourceDl > 0) {
          const parts = sortedSources
            .filter(([, agg]) => agg.downloads > 0)
            .map(([src, agg]) => {
              const share = Math.round((agg.downloads / totalSourceDl) * 100)
              return `${sourceJa(src)} ${fmtInt(agg.downloads)}件（${share}%）`
            })
          L.push(`　初回DL: ${parts.join('／')}`)
        } else {
          L.push('　初回DLはこの日ありませんでした。')
        }
        // 見られ方（表示→閲覧）は DL が無い日でも動きが分かるので併記する
        const seen = sortedSources
          .filter(([, agg]) => agg.impressions > 0 || agg.ppViews > 0)
          .sort((a, b) => b[1].impressions - a[1].impressions)
          .slice(0, 3)
          .map(([src, agg]) => `${sourceJa(src)} 表示${fmtInt(agg.impressions)}→閲覧${fmtInt(agg.ppViews)}`)
        if (seen.length > 0) L.push(`　見られ方: ${seen.join('／')}`)
      }
      if (source.topReferrerDomains.length > 0) {
        const doms = source.topReferrerDomains
          .slice(0, 4)
          .map((d) => `${d.domain} ${fmtInt(d.downloads)}`)
        L.push(`　Web参照元: ${doms.join('、')}`)
      }
    }
  }

  // --- 国別 ---
  if (country && country.countries.length > 0) {
    L.push('')
    L.push(`■ 国別（${md(country.reportDate)}分）`)
    const top = country.countries
      .slice(0, 5)
      .map((c) => `${countryLabel(c.code)} DL${fmtInt(c.downloads)}／${fmtYen(c.revenueJpy)}`)
    L.push(`　${top.join('　')}`)
    if (country.countries.length > 5) {
      const rest = country.countries.slice(5)
      L.push(
        `　ほか${rest.length}カ国 DL${fmtInt(rest.reduce((s, r) => s + r.downloads, 0))}／${fmtYen(rest.reduce((s, r) => s + r.revenueJpy, 0))}`,
      )
    }
  }

  // --- ストア・順位 ---
  if (marketing) {
    L.push('')
    L.push('■ ストア・順位')
    L.push(
      `　評価 ★${marketing.rating.toFixed(1)}（${fmtInt(marketing.reviewCount)}件${marketing.prev ? ` ${delta(marketing.reviewCount - marketing.prev.reviewCount)}` : ''}）`,
    )
    L.push(
      `　総合 ${rankLabel(marketing.overall)}${rankDelta(marketing.overall, marketing.prev?.overall)}` +
        `／${marketing.genreName || 'カテゴリ'} ${rankLabel(marketing.category)}${rankDelta(marketing.category, marketing.prev?.category)}`,
    )
    const kws = Object.entries(marketing.keywords)
    const ranked = kws
      .filter(([, v]) => v !== null)
      .sort((a, b) => (a[1] as number) - (b[1] as number))
    const out = kws.length - ranked.length
    if (ranked.length > 0) {
      L.push(
        `　${ranked
          .slice(0, 5)
          .map(([k, v]) => `「${k}」${rankLabel(v)}${rankDelta(v, marketing.prev?.keywords?.[k])}`)
          .join('　')}`,
      )
    }
    if (out > 0) L.push(`　（ほか${out}語は圏外）`)
  }

  // --- SNS ---
  if (youtube && youtube.length > 0) {
    L.push('')
    L.push('■ SNS（前回からの増分）')
    for (const r of youtube) {
      const v = r.viewsDelta === null ? '計測開始' : `${delta(r.viewsDelta)}再生`
      const s = r.subsDelta === null ? `登録${fmtInt(r.subs)}` : `登録${fmtInt(r.subs)}（${delta(r.subsDelta)}）`
      L.push(`　YouTube ${r.label}: ${v}／${s}`)
    }
  }

  // DL数が2種類出るので出所を明記する（Sales Report と Analytics は別集計・別日付）
  if (sales && source && source.status === 'ok') {
    L.push('')
    L.push(
      '※「ダウンロード・売上」は売上レポート、「流入経路」は Analytics レポートの数字です。' +
        '確定タイミングが違うため日付と件数がずれます。',
    )
  }

  if (errors.length > 0) {
    L.push('')
    L.push('※ 取得できなかった項目:')
    for (const e of errors) L.push(`　・${e}`)
  }

  const message = L.join('\n')
  if (deliver) await postSlack(message)
  return { delivered: deliver, errors, message }
}

/** Source Type の英語表記 → 日本語ラベル（appstore-source-report と同じ対応） */
function sourceJa(s: string): string {
  const map: Record<string, string> = {
    'App Store Search': 'App Store検索',
    'App Store Browse': 'ブラウズ',
    'App Referrer': 'アプリ経由',
    'Web Referrer': 'Web経由',
    'Institutional Purchase': '法人一括',
    Unavailable: '不明',
  }
  if (map[s]) return map[s]
  // 実データは 'App Store search' のように小文字混じりで来る
  const hit = Object.keys(map).find((k) => k.toLowerCase() === s.toLowerCase())
  return hit ? map[hit] : s
}
