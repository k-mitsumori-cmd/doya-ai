// ============================================
// ドヤ社内インタビュー 会社サイトの読み取り
// ============================================
// 取得は adimage・asklink と同じ SSRF 安全な safe-fetch。リンク候補の収集は asklink/site.ts を再利用する。
//
// ⚠️ 読み取るページはAIに選ばせない。リンクの文字とURLの機械的な判定で選ぶ（存在しないURLを作らせない）。
// ⚠️ robots.txt で禁止されたパスは読まない。
// ⚠️ プロフィール項目はページ本文からの原文引用を必須にし、引用が本文に無い項目は捨てる。
import { createHash } from 'node:crypto'
import { safeFetchResource, safeFetchText, htmlToText } from '@/lib/net/safe-fetch'
import { collectLinks } from '@/lib/asklink/site'
import { extractColors } from '@/lib/adimage/brand'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { prisma } from '@/lib/prisma'
import { quoteExists } from './evidence'
import { clip, oneOf, type ProfileCategory, type SourceKind } from './types'

const PAGE_TEXT_MAX = 8000
const PROMPT_TEXT_MAX = 36000
const MAX_SOURCES = 6

/** 種類ごとに読みに行くページの上限（トップページを除く） */
const EXTRA_PAGES: Record<SourceKind, number> = { corporate: 6, service: 3, recruit: 4, other: 2 }

/** 会社を知るのに役立つページか（リンク文字＋パス） */
const USEFUL_LINK =
  /会社概要|会社案内|企業情報|会社情報|私たちについて|わたしたち|about|company|corporate|理念|ミッション|ビジョン|バリュー|mission|vision|value|philosophy|代表|メッセージ|message|事業|サービス|service|business|solution|product|特徴|強み|導入事例|実績|事例|case|works|採用|recruit|career|jobs|社員|メンバー|member|people|interview|カルチャー|culture|働き方|福利厚生|制度|benefit|数字|numbers|沿革|history/i
/** 読まないページ */
const SKIP_LINK = /privacy|プライバシー|個人情報|terms|規約|cookie|login|ログイン|signin|cart|カート|contact|問い合わせ|お問合|sitemap|\.pdf$|\.zip$|\.(jpe?g|png|gif|webp|svg)$/i

export const PROFILE_CATEGORIES: readonly ProfileCategory[] = ['mission', 'business', 'service', 'number', 'culture', 'benefit', 'other']
export const SOURCE_KINDS: readonly SourceKind[] = ['corporate', 'service', 'recruit', 'other']

/** 入力URLの検証。http(s) のみ */
export function parseSiteUrl(raw: unknown): string | null {
  const s = String(raw || '').trim()
  if (!s || s.length > 2000) return null
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (!u.hostname.includes('.')) return null
    u.hash = ''
    return u.toString()
  } catch {
    return null
  }
}

// ---------- robots.txt ----------

interface RobotsRules {
  disallow: string[]
  allow: string[]
}

async function readRobots(origin: string): Promise<RobotsRules> {
  const rules: RobotsRules = { disallow: [], allow: [] }
  const text = await safeFetchText(`${origin}/robots.txt`, { timeoutMs: 6000, accept: 'text/plain, */*', maxBytes: 256 * 1024 }).catch(() => null)
  if (!text) return rules
  let applies = false
  let sawAgentInGroup = false
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/)
    if (!m) continue
    const key = m[1].toLowerCase()
    const value = m[2].trim()
    if (key === 'user-agent') {
      if (!sawAgentInGroup) applies = false
      sawAgentInGroup = true
      if (value === '*') applies = true
      continue
    }
    sawAgentInGroup = false
    if (!applies) continue
    if (key === 'disallow' && value) rules.disallow.push(value)
    if (key === 'allow' && value) rules.allow.push(value)
  }
  return rules
}

const MAX_ROBOTS_RULES = 200
const MAX_RULE_LENGTH = 200

/**
 * robots.txt のパターン照合（* と末尾 $ のみ）。
 * ⚠️ 正規表現を組み立てない。相手サイトの robots.txt は外部入力で、
 *    `*` を並べたパターンで正規表現のバックトラックを爆発させられる（ReDoS）。線形時間の貪欲照合で判定する。
 */
export function wildcardMatch(pattern: string, path: string): boolean {
  let p = pattern.slice(0, MAX_RULE_LENGTH)
  const anchored = p.endsWith('$')
  if (anchored) p = p.slice(0, -1)
  const s = path.slice(0, 2000)
  let pi = 0
  let si = 0
  let star = -1
  let mark = 0
  while (si < s.length) {
    if (pi < p.length && p[pi] === '*') {
      star = pi++
      mark = si
    } else if (pi < p.length && p[pi] === s[si]) {
      pi++
      si++
    } else if (pi === p.length && !anchored) {
      return true
    } else if (star >= 0) {
      pi = star + 1
      si = ++mark
    } else {
      return false
    }
  }
  while (pi < p.length && p[pi] === '*') pi++
  return pi === p.length
}

function robotsAllows(rules: RobotsRules, path: string): boolean {
  const match = (pattern: string) => wildcardMatch(pattern, path)
  const longest = (list: string[]) => list.slice(0, MAX_ROBOTS_RULES).filter(match).reduce((n, p) => Math.max(n, p.length), -1)
  const d = longest(rules.disallow)
  if (d < 0) return true
  return longest(rules.allow) >= d
}

// ---------- 取得 ----------

interface FetchedPage {
  url: string
  title: string
  text: string
  html: string
}

async function fetchPage(url: string): Promise<FetchedPage | null> {
  const res = await safeFetchResource(url, { timeoutMs: 15000, maxRedirects: 5 })
  if (!res) return null
  const html = res.body.toString('utf8')
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim().slice(0, 200)
  const body = html.replace(/<(header|nav|footer)[\s\S]*?<\/\1>/gi, ' ')
  const text = htmlToText(body).slice(0, PAGE_TEXT_MAX)
  return { url: res.url || url, title, text, html }
}

function sameHost(a: URL, b: URL) {
  return a.hostname.replace(/^www\./, '') === b.hostname.replace(/^www\./, '')
}

function hashText(text: string) {
  return createHash('sha256').update(text).digest('hex')
}

export interface CrawlSummary {
  pagesRead: number
  pagesChanged: number
  itemsAdded: number
  failures: { url: string; message: string }[]
  robotsSkipped: number
}

/**
 * 会社に登録された全URLを読み取り、内容が変わったページだけプロフィール項目を作り直す。
 * 手入力の項目（origin='manual'）には触れない。
 */
export async function crawlCompany(companyId: string): Promise<CrawlSummary> {
  const company = await prisma.shanaiCompany.findUnique({
    where: { id: companyId },
    include: { sources: { orderBy: { createdAt: 'asc' }, take: MAX_SOURCES } },
  })
  if (!company) throw new Error('company not found')

  const summary: CrawlSummary = { pagesRead: 0, pagesChanged: 0, itemsAdded: 0, failures: [], robotsSkipped: 0 }
  const changed: { pageId: string; sourceId: string; kind: SourceKind; url: string; title: string; text: string }[] = []
  let colors: string[] = []

  for (const source of company.sources) {
    const kind = oneOf(source.kind, SOURCE_KINDS, 'other')
    let base: URL
    try {
      base = new URL(source.url)
    } catch {
      continue
    }
    const robots = await readRobots(base.origin)
    if (!robotsAllows(robots, base.pathname || '/')) {
      summary.robotsSkipped++
      await prisma.shanaiCompanySource.update({ where: { id: source.id }, data: { error: 'このサイトは robots.txt で自動読み取りが許可されていないため、読み取りませんでした。', lastCrawledAt: new Date() } })
      continue
    }

    const top = await fetchPage(base.toString())
    if (!top || top.text.length < 100) {
      summary.failures.push({ url: source.url, message: 'ページを読み取れませんでした' })
      await prisma.shanaiCompanySource.update({ where: { id: source.id }, data: { error: 'ページを読み取れませんでした。URLをご確認いただくか、会社の説明を手入力してください。', lastCrawledAt: new Date() } })
      continue
    }
    if (kind === 'corporate' && colors.length === 0) {
      colors = await extractColors(top.html, base).catch(() => [])
    }

    const finalBase = new URL(top.url)
    const targets = collectLinks(top.html, finalBase)
      .filter((l) => {
        try {
          const u = new URL(l.url)
          if (!sameHost(u, finalBase)) return false
          if (u.pathname === finalBase.pathname) return false
          if (SKIP_LINK.test(l.url) || SKIP_LINK.test(l.text)) return false
          if (!robotsAllows(robots, u.pathname)) {
            summary.robotsSkipped++
            return false
          }
          return USEFUL_LINK.test(l.text + ' ' + decodeURIComponent(u.pathname))
        } catch {
          return false
        }
      })
      .slice(0, EXTRA_PAGES[kind])

    // ⚠️ 順番に取ると URL 6件×7ページで関数の時間制限（300秒）を超えうるため、ソースごとに並列で取る
    const fetched = await Promise.all(targets.map((t) => fetchPage(t.url).catch(() => null)))
    const pages: FetchedPage[] = [top, ...fetched.filter((p): p is FetchedPage => !!p && p.text.length >= 100)]

    for (const p of pages) {
      summary.pagesRead++
      const contentHash = hashText(p.text)
      const existing = await prisma.shanaiWebPage.findUnique({ where: { sourceId_url: { sourceId: source.id, url: p.url } } })
      if (existing && existing.contentHash === contentHash) continue
      const saved = existing
        ? await prisma.shanaiWebPage.update({ where: { id: existing.id }, data: { title: p.title, contentText: p.text, contentHash, fetchedAt: new Date() } })
        : await prisma.shanaiWebPage.create({ data: { sourceId: source.id, url: p.url, title: p.title, contentText: p.text, contentHash } })
      summary.pagesChanged++
      changed.push({ pageId: saved.id, sourceId: source.id, kind, url: p.url, title: p.title, text: p.text })
    }

    await prisma.shanaiCompanySource.update({ where: { id: source.id }, data: { error: null, lastCrawledAt: new Date() } })
  }

  if (changed.length > 0) {
    // 変わったページから作った古い項目は消して作り直す
    await prisma.shanaiProfileItem.deleteMany({ where: { companyId, origin: 'site', webPageId: { in: changed.map((c) => c.pageId) } } })
    summary.itemsAdded = await extractProfileItems(companyId, changed)
  }

  await prisma.shanaiCompany.update({
    where: { id: companyId },
    data: { crawledAt: new Date(), ...(colors.length ? { colors } : {}) },
  })
  return summary
}

interface RawItem {
  page?: number
  category?: string
  statement?: string
  quote?: string
}

async function extractProfileItems(
  companyId: string,
  pages: { pageId: string; sourceId: string; kind: SourceKind; url: string; title: string; text: string }[]
): Promise<number> {
  let added = 0
  // プロンプトに入る分ずつ処理する
  const batches: (typeof pages)[] = []
  let current: typeof pages = []
  let size = 0
  for (const p of pages) {
    if (size + p.text.length > PROMPT_TEXT_MAX && current.length) {
      batches.push(current)
      current = []
      size = 0
    }
    current.push(p)
    size += p.text.length
  }
  if (current.length) batches.push(current)

  for (const batch of batches) {
    const prompt = [
      'あなたは企業の採用広報の編集者です。以下は、ある会社のWebサイトの本文です。',
      '社員インタビュー記事に会社の魅力として書ける「事実」を抜き出してください。',
      '',
      '【厳守】',
      '- ページに書かれている事実だけを抜き出す。推測・一般論・誇張は書かない。',
      '- quote にはページ本文の文字列をそのまま（一字一句変えずに）10〜120字で写す。要約しない。',
      '- statement は quote の内容を記事で使いやすい一文（60字以内）に言い換える。quote に無い情報を足さない。',
      '- 数字（社員数・導入社数・創業年・売上など）は category を "number" にする。',
      '- 1ページあたり最大8件、全体で最大30件。重複は1件にまとめる。',
      '',
      'category は次のいずれか: mission（ミッション・ビジョン・理念）, business（事業内容）, service（サービスの特徴・強み）, number（数字・実績）, culture（カルチャー・価値観）, benefit（制度・働き方・福利厚生）, other',
      '',
      '【出力するJSONの形式】',
      '{ "items": [ { "page": ページ番号, "category": "...", "statement": "...", "quote": "..." } ] }',
      '',
      ...batch.flatMap((p, i) => [`===== ページ${i}（${p.kind === 'service' ? 'サービスサイト' : p.kind === 'recruit' ? '採用ページ' : '会社サイト'}）: ${p.title} ${p.url} =====`, p.text, '']),
    ].join('\n')

    let raw: { items?: RawItem[] } | null = null
    try {
      raw = await geminiGenerateJson<{ items?: RawItem[] }>({ prompt, model: GEMINI_TEXT_MODEL_DEFAULT, generationConfig: { temperature: 0.2 } }, 'ShanaiCompanyProfile')
    } catch (e) {
      console.warn('[shanai] profile extraction failed', (e as Error)?.name)
      continue
    }
    const rows = []
    for (const item of Array.isArray(raw?.items) ? raw!.items!.slice(0, 40) : []) {
      const page = batch[Number(item?.page)]
      const quote = clip(item?.quote, 400)
      const statement = clip(item?.statement, 200)
      if (!page || !quote || !statement) continue
      // ⚠️ 本文に無い引用は捨てる
      if (!quoteExists(quote, page.text)) continue
      rows.push({
        companyId,
        webPageId: page.pageId,
        sourceId: page.sourceId,
        category: oneOf(item?.category, PROFILE_CATEGORIES, 'other'),
        statement,
        quote,
        origin: 'site',
      })
    }
    if (rows.length) {
      await prisma.shanaiProfileItem.createMany({ data: rows })
      added += rows.length
    }
  }
  return added
}
