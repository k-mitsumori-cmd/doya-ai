// ============================================
// ドヤ商談準備（Shodan）リサーチエンジン
// 企業URLだけを起点に、深掘り調査を行う：
//  - 実従業員数（gBizINFO 優先 / サイト記載 フォールバック）
//  - マーケティング実施状況（SNS / 問い合わせ導線 / MA・解析ツール / 広告痕跡）
//  - 実施中のマーケ・保有サイト/チャネル（公式サイト/オウンドメディアの所在・SNS・PR TIMES）
//    ※記事数・更新頻度は信頼できる取得が難しいため計測しない
// 外部HTTP取得は SSRF安全な共有ユーティリティ（@/lib/net/safe-fetch）経由。
// ============================================
import { safeFetchText, htmlToText, type SafeFetchFailure } from '@/lib/net/safe-fetch'
import { scrapeCompanyWebsite } from '@/lib/doyalist/collect/web-scraper'
import { searchGbizInfo } from '@/lib/doyalist/collect/gbizinfo'
import type { CompanyResearch, PressRelease, ResearchDiagnostics } from './types'

// ---- HTMLユーティリティ ----
function extractTitle(html: string): string | undefined {
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
  if (og?.[1]) return decodeEntities(og[1].trim())
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (t?.[1]) return decodeEntities(t[1].trim())
  return undefined
}
function extractOgImage(html: string, baseUrl: string): string | null {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  if (!m?.[1]) return null
  try {
    const image = new URL(m[1].trim(), baseUrl)
    // 画像の形式だけで取得済みの企業情報を失敗扱いにしない。
    if (!['http:', 'https:'].includes(image.protocol) || image.username || image.password || image.href.length > 8192) return null
    return image.href
  } catch { return null }
}
// ---- DB に入れられない文字を取り除く ----
// 2026-10-26: 本番で、PR TIMES の検索結果の題に NUL（\u0000）が混じっていた（例「10\u0000時30分」）。
// PostgreSQL の JSON / 文字の列は NUL を受け付けず（22P05 unsupported Unicode escape sequence）、
// 調査の結果の保存が失敗して「企業調査に失敗しました」になっていた。
// 保存の前に、すべての文字（キーも）から NUL と、改行・タブ以外の制御文字を取り除く。
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

/** 調査の結果から、DB に入れられない文字を取り除く（テストのため export） */
export function stripControlChars<T>(value: T, depth = 0): T {
  if (depth > 20) return value
  if (typeof value === 'string') return value.replace(CONTROL, '') as T
  if (Array.isArray(value)) return value.map((v) => stripControlChars(v, depth + 1)) as T
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k.replace(CONTROL, '')] = stripControlChars(v, depth + 1)
    return out as T
  }
  return value
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
}
function extractLinks(html: string, baseUrl: string): { href: string; text: string }[] {
  const out: { href: string; text: string }[] = []
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  let base: URL
  try { base = new URL(baseUrl) } catch { return out }
  while ((m = re.exec(html)) && out.length < 400) {
    let href = m[1].trim()
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue
    try { href = new URL(href, base).toString() } catch { continue }
    const text = decodeEntities(m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 60)
    out.push({ href, text })
  }
  return out
}
function sameHost(a: string, b: string): boolean {
  try {
    const ha = new URL(a).hostname.replace(/^www\./, '')
    const hb = new URL(b).hostname.replace(/^www\./, '')
    return ha === hb || ha.endsWith('.' + hb) || hb.endsWith('.' + ha)
  } catch { return false }
}
function sameCompanyHost(a: string, b: string): boolean {
  try {
    return new URL(a).hostname.replace(/^www\./, '') === new URL(b).hostname.replace(/^www\./, '')
  } catch { return false }
}

// ---- マーケティング実施状況の検出 ----
function detectMarketing(html: string, links: { href: string; text: string }[]) {
  const lower = html.toLowerCase()
  const snsMap: { key: string; label: string }[] = [
    { key: 'twitter.com', label: 'X(Twitter)' }, { key: 'x.com/', label: 'X(Twitter)' },
    { key: 'facebook.com', label: 'Facebook' }, { key: 'instagram.com', label: 'Instagram' },
    { key: 'youtube.com', label: 'YouTube' }, { key: 'youtu.be', label: 'YouTube' },
    { key: 'linkedin.com', label: 'LinkedIn' }, { key: 'note.com', label: 'note' },
    { key: 'tiktok.com', label: 'TikTok' }, { key: 'line.me', label: 'LINE' },
  ]
  const snsChannels = Array.from(new Set(snsMap.filter((s) => lower.includes(s.key)).map((s) => s.label)))

  const martech: { key: string | RegExp; label: string }[] = [
    { key: 'googletagmanager.com', label: 'Google Tag Manager' },
    { key: 'google-analytics.com', label: 'Google Analytics' },
    { key: 'gtag(', label: 'Google Analytics(GA4)' },
    { key: 'js.hs-scripts.com', label: 'HubSpot' }, { key: 'hs-analytics', label: 'HubSpot' },
    { key: 'munchkin.marketo', label: 'Marketo' }, { key: 'pardot', label: 'Pardot' },
    { key: 'salesforce', label: 'Salesforce' }, { key: 'ptengine', label: 'Ptengine' },
    { key: 'facebook.net/en_us/fbevents', label: 'Meta Pixel' }, { key: 'fbq(', label: 'Meta Pixel' },
    { key: 'clarity.ms', label: 'Microsoft Clarity' }, { key: 'karte.io', label: 'KARTE' },
  ]
  const martechTools = Array.from(new Set(martech.filter((t) => (typeof t.key === 'string' ? lower.includes(t.key) : t.key.test(lower))).map((t) => t.label)))

  const formKeywords = ['お問い合わせ', 'お問合せ', 'contact', '資料請求', '無料相談', 'お見積', 'デモ', 'トライアル']
  const hasContactForm = formKeywords.some((k) => lower.includes(k.toLowerCase())) || /<form[\s>]/i.test(html)
  const magnetKeywords = ['資料ダウンロード', '資料dl', 'ホワイトペーパー', 'whitepaper', 'メルマガ', 'ニュースレター', 'newsletter', '無料ダウンロード', 'eブック', 'ebook']
  const hasLeadMagnet = magnetKeywords.some((k) => lower.includes(k.toLowerCase()))
  const runsAds = lower.includes('googleads') || lower.includes('googlesyndication') || lower.includes('doubleclick') || lower.includes('gclid') || martechTools.includes('Meta Pixel')

  const bits: string[] = []
  bits.push(snsChannels.length ? `SNS ${snsChannels.length}媒体運用` : 'SNS露出は確認できず')
  bits.push(martechTools.length ? `計測/MA ${martechTools.length}種導入` : '計測タグ未検出')
  if (hasContactForm) bits.push('問い合わせ導線あり')
  if (hasLeadMagnet) bits.push('リード獲得施策あり')
  if (runsAds) bits.push('広告運用の痕跡あり')
  const summary = bits.join(' / ')

  return { snsChannels, hasContactForm, hasLeadMagnet, martechTools, runsAds, summary }
}

// ---- オウンドメディア検出＆規模・更新頻度 ----
const MEDIA_PATH_KEYS = ['blog', 'news', 'column', 'columns', 'magazine', 'media', 'topics', 'archives', 'journal', 'article', 'articles', 'press', 'pickup', 'knowledge', 'insight', 'report', 'case', 'voice']
function findMediaUrls(links: { href: string; text: string }[], baseUrl: string): string[] {
  const out = new Set<string>()
  for (const { href, text } of links) {
    if (!sameHost(href, baseUrl)) continue
    let path = ''
    try { path = new URL(href).pathname.toLowerCase() } catch { continue }
    const hitPath = MEDIA_PATH_KEYS.some((k) => path.split('/').includes(k) || path.includes(`/${k}/`) || path.endsWith(`/${k}`))
    const hitText = /ブログ|ニュース|コラム|お知らせ|記事|メディア|事例|プレス|読み物/.test(text)
    if (hitPath || hitText) out.add(href.split('#')[0])
  }
  return Array.from(out).slice(0, 4)
}
// オウンドメディア/関連サイトの「有無と所在」だけを収集する。
// ※記事数・更新頻度は信頼できる取得が難しいため計測しない（仕様変更）。
function summarizeOwnedMedia(mediaUrls: string[]) {
  // 記事数・更新頻度・規模は信頼できる取得が難しいため計測しない（所在＝mediaUrls のみ収集）。
  return {
    hasOwnedMedia: mediaUrls.length > 0,
    mediaUrls,
    articleCountEstimate: 0,
    latestArticleDate: null as string | null,
    updateFrequency: 'unknown' as CompanyResearch['ownedMedia']['updateFrequency'],
    frequencyNote: '記事数・更新頻度は信頼できる取得が難しいため計測していません',
    siteScale: 'unknown' as CompanyResearch['ownedMedia']['siteScale'],
  }
}

// ---- PR TIMES からプレスリリース（市場・企業動向）を収集 ----
function parsePrtimes(html: string): PressRelease[] {
  const out: PressRelease[] = []
  const seen = new Set<string>()
  // リリース詳細リンク: /main/html/rd/p/000000123.000012345.html
  const re = /\/main\/html\/rd\/p\/\d+\.\d+\.html/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && out.length < 12) {
    const path = m[0]
    const url = 'https://prtimes.jp' + path
    if (seen.has(url)) continue
    seen.add(url)
    // 周辺ウィンドウからタイトル・画像・日付を拾う
    const start = Math.max(0, m.index - 900)
    const win = html.slice(start, m.index + 900)
    // 画像（lazy対応）
    const img = win.match(/(?:data-src|data-original|src)=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i)?.[1]
      || win.match(/(?:data-src|src)=["'](https?:\/\/(?:prcdn|prtimes|images\.prtimes)[^"']+)["']/i)?.[1]
    // タイトル（aタグのテキスト or alt or title属性）
    let title = ''
    const aTextRe = new RegExp(`<a[^>]+href=["'][^"']*${path.replace(/[.]/g, '\\.')}["'][^>]*>([\\s\\S]*?)<\\/a>`, 'i')
    const aText = html.match(aTextRe)?.[1]
    if (aText) title = decodeEntities(aText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    if (!title) title = decodeEntities((win.match(/alt=["']([^"']{8,})["']/i)?.[1] || win.match(/title=["']([^"']{8,})["']/i)?.[1] || '').trim())
    if (!title) continue
    const date = win.match(/(20\d{2})[年.\-/](\d{1,2})[月.\-/](\d{1,2})/)?.[0]?.replace(/[年月]/g, '-').replace(/日/g, '') || null
    out.push({ title: title.slice(0, 120), url, date, image: img || null, source: 'PR TIMES' })
  }
  return out
}

async function researchPressReleases(companyName: string | undefined): Promise<{ items: PressRelease[]; status: 'ok' | 'failed' | 'skipped' }> {
  if (!companyName) return { items: [], status: 'skipped' }
  const name = companyName.replace(/[|｜\-–—].*$/, '').trim().slice(0, 40)
  if (!name) return { items: [], status: 'skipped' }
  const urls = [
    `https://prtimes.jp/main/html/searchrlp/company_name/${encodeURIComponent(name)}`,
    `https://prtimes.jp/main/action.php?run=html&page=searchkey&search_word=${encodeURIComponent(name)}`,
  ]
  let fetched = false
  for (const u of urls) {
    const html = await safeFetchText(u, { timeoutMs: 9000 }).catch(() => null)
    if (!html) continue
    fetched = true
    const items = parsePrtimes(html)
    if (items.length) return { items: items.slice(0, 8), status: 'ok' }
  }
  return { items: [], status: fetched ? 'ok' : 'failed' }
}

// ---- gBizINFO で実従業員数などの公的データを引く ----
function normalizeCompanyName(name: string): string {
  return name.trim()
    .replace(/^(株式会社|有限会社|合同会社)\s*/, '')
    .replace(/\s*(株式会社|有限会社|合同会社)$/, '')
    .replace(/[\s\u3000・･]/g, '')
    .toLowerCase()
}

async function lookupGbiz(companyName: string | undefined, targetUrl: string) {
  if (!companyName) return { company: null, status: 'skipped' as const }
  const cleaned = companyName.replace(/[|｜\-–—].*$/, '').trim().slice(0, 40)
  if (!cleaned) return { company: null, status: 'skipped' as const }
  const r = await searchGbizInfo({ keyword: cleaned, limit: 20 }).catch(() => null)
  if (!r || (r.status !== 200 && r.status !== 404)) return { company: null, status: 'failed' as const }
  if (!r.companies.length) return { company: null, status: 'ok' as const }
  const normalized = normalizeCompanyName(cleaned)
  const hostMatches = r.companies.filter((c) => c.companyUrl && sameCompanyHost(c.companyUrl, targetUrl))
  const exactNameMatches = r.companies.filter((c) => normalized && normalizeCompanyName(c.name) === normalized)
  // 検索APIは類似名を返し得る。URLか社名で一意に照合できなければ公的情報を紐付けない。
  let company: (typeof r.companies)[number] | null = null
  if (hostMatches.length === 1) {
    company = hostMatches[0]
  } else if (hostMatches.length > 1) {
    const bothMatches = hostMatches.filter((c) => exactNameMatches.includes(c))
    if (bothMatches.length === 1) company = bothMatches[0]
  } else if (exactNameMatches.length === 1 && r.totalCount <= r.companies.length) {
    // 検索結果がページ上限で切れている場合、同名の別法人が後続ページにあるか判断できない。
    company = exactNameMatches[0]
  }
  return { company, status: 'ok' as const }
}

function parseEmployee(s?: string | null): number | null {
  if (!s) return null
  const n = parseInt(String(s).replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

// ---- 公式サイトを読む（失敗の理由を持ち帰り、1回だけ手を変えて読み直す） ----
// 失敗のチェックリスト: docs/architecture/agent-orchestration/FAILURE-CHECKLIST.md S2〜S12
export const HOMEPAGE_TIMEOUT_MS = 12000
export const HOMEPAGE_RETRY_TIMEOUT_MS = 20000

type HomepageResult = { html: string | null; url: string; failure?: SafeFetchFailure; attempts: number }

/** www. を付けた・外した URL（付け外しできなければ null） */
function toggleWww(raw: string): string | null {
  try {
    const u = new URL(raw)
    if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) || !u.hostname.includes('.')) return null
    u.hostname = u.hostname.startsWith('www.') ? u.hostname.slice(4) : `www.${u.hostname}`
    return u.toString()
  } catch { return null }
}

async function fetchHomepage(targetUrl: string, timeouts: [number, number] = [HOMEPAGE_TIMEOUT_MS, HOMEPAGE_RETRY_TIMEOUT_MS]): Promise<HomepageResult> {
  const attempt = async (url: string, timeoutMs: number) => {
    let failure: SafeFetchFailure | undefined
    const html = await safeFetchText(url, { timeoutMs, onFailure: (f) => { failure = f } }).catch(() => null)
    return { html, failure: html ? undefined : failure ?? { reason: 'network' as const } }
  }
  const first = await attempt(targetUrl, timeouts[0])
  if (first.html) return { html: first.html, url: targetUrl, attempts: 1 }
  const f = first.failure!
  let next: string | null = null
  let timeoutMs = timeouts[0]
  if (f.reason === 'timeout') { next = targetUrl; timeoutMs = timeouts[1] }
  else if (f.reason === 'dns' || f.reason === 'network') next = toggleWww(targetUrl)
  else if (f.reason === 'http' && (f.status === 404 || f.status === 410)) {
    try { const u = new URL(targetUrl); if (u.pathname !== '/' || u.search) next = `${u.origin}/` } catch { /* そのまま */ }
  }
  if (!next) return { html: null, url: targetUrl, failure: f, attempts: 1 }
  const second = await attempt(next, timeoutMs)
  // 2回目も失敗したら、最初の理由を返す（利用者が入れた URL の話にする）。時間切れだけは 2回目の長い方の話にする
  if (second.html) return { html: second.html, url: next, attempts: 2 }
  return { html: null, url: targetUrl, failure: f.reason === 'timeout' ? (second.failure ?? f) : f, attempts: 2 }
}

/** JavaScript で描くサイト向け: 題・説明・og・JSON-LD（会社の情報）から、AI に渡す短い文を作る */
export function pageSummaryText(html: string): string {
  const meta = (attr: 'name' | 'property', key: string) =>
    html.match(new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1]
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${key}["']`, 'i'))?.[1]
  const parts = [
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1],
    meta('name', 'description'),
    meta('property', 'og:site_name'),
    meta('property', 'og:title'),
    meta('property', 'og:description'),
  ]
  // JSON-LD の Organization / Corporation / LocalBusiness
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1])
      const nodes: unknown[] = Array.isArray(data) ? data : Array.isArray(data?.['@graph']) ? data['@graph'] : [data]
      for (const n of nodes.slice(0, 20)) {
        const o = (n && typeof n === 'object' ? n : {}) as Record<string, unknown>
        const type = String(o['@type'] ?? '')
        if (!/Organization|Corporation|LocalBusiness|Company/i.test(type)) continue
        const addr = o.address && typeof o.address === 'object' ? Object.values(o.address as Record<string, unknown>).filter((x) => typeof x === 'string').join(' ') : o.address
        const emp = o.numberOfEmployees && typeof o.numberOfEmployees === 'object' ? (o.numberOfEmployees as Record<string, unknown>).value : o.numberOfEmployees
        parts.push(
          typeof o.legalName === 'string' ? `会社名: ${o.legalName}` : typeof o.name === 'string' ? `会社名: ${o.name}` : undefined,
          typeof o.description === 'string' ? o.description : undefined,
          typeof addr === 'string' ? `住所: ${addr}` : undefined,
          typeof o.telephone === 'string' ? `電話: ${o.telephone}` : undefined,
          typeof o.foundingDate === 'string' ? `設立: ${o.foundingDate}` : undefined,
          emp != null ? `従業員数: ${String(emp)}` : undefined,
        )
      }
    } catch { /* 壊れた JSON-LD は読まない */ }
  }
  const seen = new Set<string>()
  return parts
    .map((p) => (p ? decodeEntities(String(p)).replace(/\s+/g, ' ').trim() : ''))
    .filter((p) => p && !seen.has(p) && (seen.add(p), true))
    .join('\n')
    .slice(0, 3000)
}

/** 本文がこれより短ければ、JavaScript で描くサイトとみなし、題と説明を足して AI に渡す */
export const SHORT_BODY_CHARS = 200

const HTTP_BLOCKED = new Set([401, 403, 407, 429, 451])

/** 調べられなかったときの、利用者向けの文（原因と次の一手。FAILURE-CHECKLIST.md S2〜S12・S21） */
export function researchFailureMessage(d: ResearchDiagnostics | undefined): string {
  const tail = '今月の利用枠は減っていません。'
  const f = d?.homepage
  if (!f || f.ok) {
    return d?.jsRendered
      ? `サイトから会社の情報を読み取れませんでした（中身を JavaScript で表示するサイトのようです）。会社名で調べ直してください。${tail}`
      : `サイトから会社の情報を読み取れませんでした。会社名で調べ直してください。${tail}`
  }
  switch (f.reason) {
    case 'dns': return `サイトが見つかりませんでした（ドメインが引けません）。URL の綴りを確かめるか、会社名で調べ直してください。${tail}`
    case 'timeout': return `サイトが応答しませんでした（${Math.round(HOMEPAGE_RETRY_TIMEOUT_MS / 1000)}秒）。少し時間をおいてやり直すか、会社名で調べ直してください。${tail}`
    case 'network': return `サイトにつながりませんでした（接続できないか、証明書に問題があります）。会社名で調べ直してください。${tail}`
    case 'redirect': return `サイトの転送が多すぎて読めませんでした。転送先の URL を入れるか、会社名で調べ直してください。${tail}`
    case 'content_type': return `入れた URL は Web ページではありませんでした（PDF など）。会社のトップページの URL を入れてください。${tail}`
    case 'body': return `サイトが大きすぎて読み切れませんでした。会社名で調べ直してください。${tail}`
    case 'url_rejected': return `このアドレスは調べられません（社内のアドレスなど）。公開している会社のサイトを入れてください。${tail}`
    case 'http':
      if (f.status && HTTP_BLOCKED.has(f.status)) return `サイトに読み込みを断られました（アクセスの制限）。会社名で調べ直してください。${tail}`
      if (f.status === 404 || f.status === 410) return `そのページはありませんでした。会社のトップページの URL を入れるか、会社名で調べ直してください。${tail}`
      return `サイトがエラーを返しました（相手のサイトの不具合）。時間をおいてやり直すか、会社名で調べ直してください。${tail}`
    default: return `サイトを読めませんでした。会社名で調べ直してください。${tail}`
  }
}

/**
 * 企業URLを起点に深掘り調査を実行して CompanyResearch を返す。
 * 失敗しても可能な範囲で部分結果を返す（throwしない）。
 */
export async function researchCompany(targetUrl: string, opts: { companyName?: string; /** テストだけで使う（1回目・読み直しの待ち時間） */ timeoutsMs?: [number, number] } = {}): Promise<CompanyResearch> {
  // ホームページは一度だけ取得し、リンク抽出・マーケ検出・会社情報抽出で共有する（失敗したら理由に合わせて1回だけ読み直す）
  const page = await fetchHomepage(targetUrl, opts.timeoutsMs)
  const homepage = page.html
  const links = homepage ? extractLinks(homepage, page.url) : []
  const titleName = homepage ? extractTitle(homepage) : undefined
  const bodyChars = homepage ? htmlToText(homepage).length : 0
  const jsRendered = !!homepage && bodyChars < SHORT_BODY_CHARS
  const summary = jsRendered ? pageSummaryText(homepage) : ''
  // JavaScript で描くサイトは本文がほぼ空なので、題・説明・JSON-LD を足して AI に渡す
  const forAi = homepage ? (summary ? `${homepage}\n<div>${summary.replace(/[<>]/g, ' ')}</div>` : homepage) : null

  // 取得済みHTMLを渡して二重取得を回避（会社名/事業内容/従業員数記載 等を抽出）。
  // 読めなかったときは、今までどおり scrapeCompanyWebsite が自分でもう1回読む（別の読み方で読める場合がある）
  const basic = await scrapeCompanyWebsite(page.url, forAi || undefined).catch(() => null)
  // オウンドメディア/関連サイトは「所在」だけ収集（記事数・更新頻度は計測しない）
  const mediaInfo = summarizeOwnedMedia(findMediaUrls(links, targetUrl))

  const hint = opts.companyName?.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 100) || undefined
  // 利用者が入れた会社名を先に使う（サイトが読めないときに、会社名で調べ直すため）
  const companyName = hint || basic?.companyName || titleName
  const [gbizResult, pressResult] = await Promise.all([
    lookupGbiz(companyName, targetUrl),
    researchPressReleases(companyName),
  ])
  const gbiz = gbizResult.company

  const employeeFromGbiz = parseEmployee(gbiz?.employeeNumber)
  const employeeFromSite = parseEmployee(basic?.employeeCount)
  const employeeCount = employeeFromGbiz ?? employeeFromSite
  const employeeCountSource: CompanyResearch['employeeCountSource'] = employeeFromGbiz != null ? 'gbizinfo' : employeeFromSite != null ? 'website' : 'unknown'

  const marketing = homepage
    ? detectMarketing(homepage, links)
    : { ...detectMarketing('', []), summary: '公式サイトを取得できず、マーケ施策は未確認' }

  const research: CompanyResearch = {
    companyName: gbiz?.name || companyName,
    url: targetUrl,
    sourceStatus: {
      homepage: homepage ? 'ok' : 'failed',
      gbizinfo: gbizResult.status,
      prtimes: pressResult.status,
    },
    corporateNumber: gbiz?.corporateNumber,
    employeeCount,
    employeeCountSource,
    capital: gbiz?.capitalStock || basic?.capital || null,
    industry: gbiz?.industry || basic?.industry || null,
    foundedYear: gbiz?.foundingYear || gbiz?.dateOfEstablishment || (basic?.foundedYear ? String(basic.foundedYear) : null),
    address: gbiz?.address || basic?.address || null,
    representative: gbiz?.representativeName || basic?.representative || null,
    description: basic?.description || gbiz?.businessSummary || undefined,
    services: basic?.services || undefined,
    ogImage: homepage ? extractOgImage(homepage, targetUrl) : null,
    crawledUrls: Array.from(new Set([targetUrl, ...mediaInfo.mediaUrls])).slice(0, 5),
    pressReleases: pressResult.items,
    marketing,
    ownedMedia: mediaInfo,
    rawNotes: homepage ? (htmlToText(homepage) || summary).slice(0, 1500) : undefined,
    diagnostics: {
      homepage: homepage ? { ok: true } : { ok: false, reason: page.failure?.reason ?? 'network', ...(page.failure?.status ? { status: page.failure.status } : {}) },
      attempts: page.attempts,
      bodyChars,
      jsRendered,
      usedPageSummary: !!summary,
      aiExtracted: !!basic,
      companyNameFrom: hint ? 'input' : basic?.companyName ? 'site' : titleName ? 'title' : null,
    },
  }
  // 外のサイトの文に混じる NUL などは、DB に保存できない（保存が失敗して調査全体が失敗になる）。返す前に取り除く
  return stripControlChars(research)
}
