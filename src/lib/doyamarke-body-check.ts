import { voicePayload } from './slack-voice'
import { safeFetchResource } from './net/safe-fetch'

// ============================================================
// ドヤマーケ記事の本文消失チェック（doyamarke.surisuta.jp / Studio CMS）
//
// 2026-08 に商品カードの一括差し込みで記事8本の本文が消え、
// 公開ページに著者と商品カードしか残らない状態が約1か月続いた。
// 公開中の全記事を毎日取得し、本文が消えた・ページが開けない記事だけを Slack に通知する。
//
// 判定（どれか1つでも当てはまれば異常）:
//  - HTTPステータスが200以外
//  - <article> 内の本文が MIN_BODY_CHARS 字未満
//  - <article> 内の見出し(h2)が2個以下で、本文が SHORT_BODY_CHARS 字未満
//    （著者欄＋商品カードだけになった状態の特徴）
// 異常が無い日は通知しない。
// ============================================================

const SITEMAP_URL =
  'https://doyamarke.surisuta.jp/sitemap-dynamic/sitemap-dynamic-bm90ZXMvOnNsdWc.xml'
const MIN_BODY_CHARS = 1000
const SHORT_BODY_CHARS = 1500
const CONCURRENCY = 6
const FETCH_TIMEOUT_MS = 20000
const ARTICLE_HOST = 'doyamarke.surisuta.jp'

// もともと短い誘導用の記事（本文消失ではない）
const KNOWN_SHORT = new Set(['small-business-marketing-start-guide', 'lead-nurturing-btob-guide'])

export type BodyCheckIssue = { slug: string; url: string; reason: string }

async function fetchText(url: string): Promise<{ status: number; text: string }> {
  const target = new URL(url)
  if (target.protocol !== 'https:' || target.hostname !== ARTICLE_HOST) throw new Error('想定外の取得先です')
  let failedStatus = 0
  const resource = await safeFetchResource(url, {
    timeoutMs: FETCH_TIMEOUT_MS,
    maxBytes: 4 * 1024 * 1024,
    maxRedirects: 3,
    accept: 'text/html,application/xhtml+xml,application/xml,text/xml',
    onFailure: failure => { failedStatus = failure.status || 0 },
  })
  if (resource) return { status: resource.status || 200, text: resource.body.toString('utf8') }
  if (failedStatus) return { status: failedStatus, text: '' }
  throw new Error('ページを取得できませんでした')
}

export function measureArticle(html: string): { h2: number; chars: number } {
  const m = html.match(/<article[\s\S]*?<\/article>/)
  const article = m ? m[0] : ''
  const h2 = (article.match(/<h2[\s>]/g) || []).length
  // img の src に埋め込まれたインラインSVGでタグ除去がずれないよう、先に svg を落とす
  const text = article
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, '')
  return { h2, chars: text.length }
}

async function checkOne(url: string): Promise<BodyCheckIssue | null> {
  const slug = url.split('/notes/')[1] || url
  if (KNOWN_SHORT.has(slug)) return null
  try {
    const { status, text } = await fetchText(url)
    if (status !== 200) return { slug, url, reason: `HTTP ${status}` }
    const { h2, chars } = measureArticle(text)
    if (chars < MIN_BODY_CHARS) return { slug, url, reason: `本文 ${chars}字（見出し${h2}個）` }
    if (h2 <= 2 && chars < SHORT_BODY_CHARS) return { slug, url, reason: `見出し${h2}個・本文 ${chars}字` }
    return null
  } catch (e: any) {
    return { slug, url, reason: `取得失敗: ${e?.name === 'AbortError' ? 'タイムアウト' : e?.message || e}` }
  }
}

export async function runDoyamarkeBodyCheck(opts: { dryRun?: boolean } = {}): Promise<{
  checked: number
  issues: BodyCheckIssue[]
  posted: boolean
}> {
  const sm = await fetchText(SITEMAP_URL)
  if (sm.status !== 200) throw new Error(`sitemap HTTP ${sm.status}`)
  const urls = Array.from(sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)).map((x) => x[1].trim())
  if (urls.length === 0) throw new Error('sitemap has no URLs')
  if (urls.some(url => {
    try {
      const target = new URL(url)
      return target.protocol !== 'https:' || target.hostname !== ARTICLE_HOST || !target.pathname.startsWith('/notes/')
    } catch { return true }
  })) throw new Error('sitemap has unexpected URLs')

  const issues: BodyCheckIssue[] = []
  let i = 0
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (i < urls.length) {
      const url = urls[i++]
      const issue = await checkOne(url)
      if (issue) issues.push(issue)
    }
  })
  await Promise.all(workers)
  issues.sort((a, b) => a.slug.localeCompare(b.slug))

  let posted = false
  if (issues.length > 0 && !opts.dryRun) {
    const lines = issues.slice(0, 30).map((x) => `・${x.slug}：${x.reason}\n  ${x.url}`)
    const more = issues.length > 30 ? `\n…ほか${issues.length - 30}件` : ''
    const text =
      `【ドヤマーケ】本文が消えた可能性のある記事が ${issues.length}件 あります（全${urls.length}記事を確認）\n` +
      lines.join('\n') +
      more +
      `\n\nStudioで該当記事を開き、本文が商品カードだけになっていないか確認してください。` +
      `復旧用の記事HTMLは ~/.claude/projects/-Users-mitsumori-katsuki/doyamarke-seo/backup_* にあります。`
    const webhookUrl = process.env.SLACK_ANALYTICS_WEBHOOK_URL
    if (!webhookUrl) throw new Error('SLACK_ANALYTICS_WEBHOOK_URL is not set')
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(voicePayload({ text })),
    })
    if (!res.ok) throw new Error(`Slack webhook error: ${res.status}`)
    posted = true
  }
  return { checked: urls.length, issues, posted }
}
