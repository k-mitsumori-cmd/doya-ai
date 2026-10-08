// ============================================
// ドヤAI質問リンク サイトの読み取り（4-1）
// ============================================
// 新規のスクレイパーは書かない。取得は adimage と同じ SSRF 安全な safe-fetch、
// 色の抽出は adimage/brand.ts の extractColors を再利用する。
//
// ⚠️ URLはAIに書かせない。ページ内のリンクから候補一覧を作り、AIには**番号で選ばせる**。
//    こうすると、サイトに存在しないURLが抽出結果に混ざることが構造上起きない。
import * as cheerio from 'cheerio'
import { safeFetchResource, htmlToText, type SafeFetchFailure } from '@/lib/net/safe-fetch'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { extractColors } from '@/lib/adimage/brand'
import type { Audience, SiteProfile } from './types'

const MAX_TEXT = 12000
const MAX_CANDIDATES = 80

export class SiteUnreadableError extends Error {
  constructor(public readonly failure: SafeFetchFailure | { reason: 'insufficient_text' }) {
    super('このサイトを自動で読み取れませんでした。URLを確認するか、サービスの説明を入力して続けてください。')
    this.name = 'SiteUnreadableError'
  }
}

export interface SiteReadResult {
  site: SiteProfile
  audience: Audience
  /** 質問文に置いてよいURLの集合 */
  allowedUrls: string[]
}

interface LinkCandidate {
  url: string
  text: string
}

/** 外部ドメインでも候補に残すリンク（フォームや資料DLが別ドメインにあるサイトは多い） */
const EXTERNAL_KEEP = /問い合わせ|問合せ|お問合|相談|資料|ダウンロード|料金|価格|プラン|予約|申し?込|見積|contact|download|pricing|reserve|booking/i

function bareHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '')
}

/**
 * 同じサイトか。ホストが同じ（www の有無は無視）か、どちらかが他方のサブドメインのときだけ。
 * ⚠️ 「親ドメインが同じ」で判定しない。example.co.jp の親を取ると co.jp になり、
 *    .co.jp のサイトが全部同じサイト扱いになる。
 */
function isSameSite(a: string, b: string): boolean {
  const x = bareHost(a)
  const y = bareHost(b)
  return x === y || x.endsWith('.' + y) || y.endsWith('.' + x)
}

/** リンクの文字。画像だけのリンクは alt を使う（noscript 内のHTMLが文字として混ざるのを避ける） */
function linkText($: cheerio.CheerioAPI, el: Parameters<cheerio.CheerioAPI>[0]): string {
  const $el = $(el)
  let text = $el.text().replace(/\s+/g, ' ').trim()
  if (!text || text.includes('<')) text = ''
  if (!text) text = $el.find('img[alt]').first().attr('alt') || $el.attr('aria-label') || $el.attr('title') || ''
  return text.replace(/\s+/g, ' ').trim().slice(0, 60)
}

export function collectLinks(html: string, base: URL): LinkCandidate[] {
  const $ = cheerio.load(html)
  const seen = new Set<string>()
  const out: LinkCandidate[] = []
  $('a[href]').each((_, el) => {
    if (out.length >= MAX_CANDIDATES) return
    const href = String($(el).attr('href') || '').trim()
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return
    let u: URL
    try {
      u = new URL(href, base)
    } catch {
      return
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return
    u.hash = ''
    // 計測パラメータの付いたURLは質問文に入れない（機械チェックでも utm_ を弾く）
    if (/utm_/i.test(u.search)) return
    // 文字の無い画像リンクは、URLの末尾をAIへの手がかりにする
    const text = linkText($, el) || `(画像リンク: ${u.pathname.split('/').filter(Boolean).pop() || '/'})`
    const sameSite = isSameSite(u.hostname, base.hostname)
    if (!sameSite && !EXTERNAL_KEEP.test(text + ' ' + u.pathname)) return
    const key = u.toString()
    if (seen.has(key)) return
    seen.add(key)
    out.push({ url: key, text })
  })
  return out
}

interface RawProfile {
  name?: string
  summary?: string
  strengths?: string[]
  target?: string
  audience?: string
  contact?: number | null
  download?: number | null
  pricing?: number | null
  pages?: { index?: number; label?: string }[]
}

function pick(candidates: LinkCandidate[], i: unknown): string | null {
  const n = typeof i === 'number' ? i : Number(i)
  if (!Number.isInteger(n) || n < 0 || n >= candidates.length) return null
  return candidates[n].url
}

/** トップページか（問い合わせ・料金などの専用ページとしては扱わない） */
function isTopPage(url: string | null, base: URL): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '') === base.hostname.replace(/^www\./, '') && (u.pathname === '/' || u.pathname === '') && !u.search
  } catch {
    return false
  }
}

/** 専用ページとしての採用。トップページを選んだ場合は「未確認」に落とす（料金ページが無いサイトでモデルがトップを選ぶ） */
function pickPage(candidates: LinkCandidate[], i: unknown, base: URL): string | null {
  const url = pick(candidates, i)
  return isTopPage(url, base) ? null : url
}

/**
 * サイトを読み取り、抽出結果と ToB/ToC 判定を返す。
 * @param manualText 読み取れないサイト向けの手入力。指定時は取得を行わない
 */
export async function readSite(sourceUrl: string, manualText?: string): Promise<SiteReadResult> {
  let base = new URL(sourceUrl)
  let text = manualText?.trim().slice(0, MAX_TEXT) || ''
  let candidates: LinkCandidate[] = []
  let colors: string[] = []

  if (!text) {
    let failure: SafeFetchFailure = { reason: 'network' }
    const res = await safeFetchResource(base.toString(), {
      timeoutMs: 15000,
      maxRedirects: 5,
      onFailure: (d) => {
        failure = d
      },
    })
    if (!res) throw new SiteUnreadableError(failure)
    // リダイレクト後の最終URLを基準にする（相対リンクの解決先がずれないように）
    try {
      base = new URL(res.url)
    } catch {}
    const html = res.body.toString('utf8')
    text = htmlToText(html).slice(0, MAX_TEXT)
    if (text.length < 150) throw new SiteUnreadableError({ reason: 'insufficient_text' })
    candidates = collectLinks(html, base)
    colors = await extractColors(html, base).catch(() => [])
  }

  const list = candidates.map((c, i) => `${i}: ${c.text || '(テキストなし)'} — ${c.url}`).join('\n')
  const prompt = [
    'Webサイトの内容から、訪問者向けの相談導線を作るための情報を抽出してください。',
    '書かれている内容だけを使い、書かれていないことは空欄にしてください。',
    '',
    '【出力するJSONの形式】',
    '{',
    '  "name": "会社名またはサービス名",',
    '  "summary": "何を提供しているか（80字以内）",',
    '  "strengths": ["強み（各30字以内、3件まで）"],',
    '  "target": "主な対象顧客（40字以内）",',
    '  "audience": "b2b か b2c（法人向けが主なら b2b、個人向けが主なら b2c）",',
    '  "contact": 問い合わせ・無料相談ページのリンク番号 または null,',
    '  "download": 資料ダウンロードページのリンク番号 または null,',
    '  "pricing": 料金ページのリンク番号 または null,',
    '  "pages": [{ "index": 主要ページのリンク番号, "label": "ページの内容（15字以内）" }]（4件まで）',
    '}',
    '',
    'リンク番号は下の「リンク一覧」の番号だけを使ってください。該当が無ければ null にしてください。',
    '',
    manualText ? '【利用者が入力したサービス説明】' : '【サイトの本文】',
    text,
    '',
    '【リンク一覧】',
    list || '(なし)',
  ].join('\n')

  const raw = await geminiGenerateJson<RawProfile>({ prompt, model: GEMINI_TEXT_MODEL_DEFAULT }, 'AskLinkSite')

  const contactUrl = pickPage(candidates, raw?.contact, base)
  const downloadUrl = pickPage(candidates, raw?.download, base)
  const pricingUrl = pickPage(candidates, raw?.pricing, base)
  const pages: SiteProfile['pages'] = []
  for (const p of Array.isArray(raw?.pages) ? raw.pages : []) {
    const url = pickPage(candidates, p?.index, base)
    if (!url || pages.some((x) => x.url === url)) continue
    pages.push({ label: String(p?.label || '').slice(0, 30) || 'ページ', url })
    if (pages.length >= 4) break
  }

  const site: SiteProfile = {
    name: String(raw?.name || base.hostname).slice(0, 80),
    summary: String(raw?.summary || '').slice(0, 200),
    strengths: (Array.isArray(raw?.strengths) ? raw.strengths : []).filter((s) => typeof s === 'string').map((s) => s.slice(0, 60)).slice(0, 3),
    target: String(raw?.target || '').slice(0, 80),
    contactUrl,
    downloadUrl,
    pricingUrl,
    pages,
    colors: colors.length ? colors.slice(0, 3) : [],
  }

  // 入力URL（読み取れた場合は最終URL）も置いてよい。手入力のときは入力URLのみ
  const allowed = new Set<string>([manualText ? sourceUrl : base.toString()])
  for (const u of [contactUrl, downloadUrl, pricingUrl, ...pages.map((p) => p.url)]) if (u) allowed.add(u)

  return {
    site,
    audience: raw?.audience === 'b2c' ? 'b2c' : 'b2b',
    allowedUrls: [...allowed],
  }
}

/** 入力URLの検証。http(s) のみ */
export function parseSourceUrl(raw: unknown): string | null {
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
