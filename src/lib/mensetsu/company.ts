// ============================================
// ドヤ面接官 企業URL調査（F3-1〜F3-3）
// ============================================
// 企業URLから事業内容・提供価値・カルチャー・求める人物像を抽出する。
// 外部HTTP取得は SSRF安全な共有ユーティリティ経由（@/lib/net/safe-fetch）。
import { safeFetchText, htmlToText } from '@/lib/net/safe-fetch'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import type { CompanyProfileData } from './types'

/** 採用情報が載っていそうなパス（見つかれば追加で読む） */
const RECRUIT_HINTS = [
  '/recruit',
  '/recruit/',
  '/careers',
  '/careers/',
  '/career',
  '/about',
  '/company',
  '/culture',
  '/philosophy',
]

const MAX_PAGES = 5
const MAX_CHARS_PER_PAGE = 8000
const MAX_TOTAL_CHARS = 24000

interface FetchedPage {
  url: string
  text: string
}

function extractTitle(html: string): string | undefined {
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
  if (og?.[1]) return og[1].trim()
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (t?.[1]) return t[1].trim()
  return undefined
}

/** 同一ドメインの採用/会社紹介ページを最大 MAX_PAGES 件まで収集 */
export async function collectCompanyPages(sourceUrl: string): Promise<{
  pages: FetchedPage[]
  siteName?: string
}> {
  const base = new URL(sourceUrl)
  const pages: FetchedPage[] = []
  let siteName: string | undefined

  const topHtml = await safeFetchText(base.toString()).catch(() => '')
  if (topHtml) {
    siteName = extractTitle(topHtml)
    pages.push({ url: base.toString(), text: htmlToText(topHtml).slice(0, MAX_CHARS_PER_PAGE) })
  }

  // トップに含まれるリンクのうち、採用/会社系のパスだけを候補にする
  const linkPaths = new Set<string>()
  if (topHtml) {
    const re = /href=["'](\/[^"'#?]*)/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(topHtml)) !== null) {
      const p = m[1].replace(/\/$/, '') || '/'
      if (RECRUIT_HINTS.some((h) => p === h.replace(/\/$/, '') || p.startsWith(h))) {
        linkPaths.add(p)
      }
    }
  }
  for (const h of RECRUIT_HINTS) linkPaths.add(h.replace(/\/$/, ''))

  for (const p of Array.from(linkPaths)) {
    if (pages.length >= MAX_PAGES) break
    const url = new URL(p || '/', base).toString()
    if (pages.some((x) => x.url === url)) continue
    const html = await safeFetchText(url).catch(() => '')
    if (!html) continue
    const text = htmlToText(html).slice(0, MAX_CHARS_PER_PAGE)
    if (text.length < 200) continue // 実質空のページは捨てる
    pages.push({ url, text })
  }

  return { pages, siteName }
}

/** 収集したページ本文から企業プロフィールを構造化抽出 */
export async function analyzeCompany(sourceUrl: string): Promise<{
  profile: CompanyProfileData
  pages: FetchedPage[]
}> {
  const { pages, siteName } = await collectCompanyPages(sourceUrl)
  if (pages.length === 0) {
    throw new Error('企業サイトの本文を取得できませんでした。URLをご確認ください。')
  }

  let corpus = ''
  for (const p of pages) {
    const chunk = `\n\n--- ${p.url} ---\n${p.text}`
    if (corpus.length + chunk.length > MAX_TOTAL_CHARS) break
    corpus += chunk
  }

  const prompt = [
    'あなたは採用コンサルタントです。以下の企業サイトの本文から、採用面接の設計に必要な情報を抽出してください。',
    '',
    '出力するJSONの形式:',
    '{',
    '  "companyName": "会社名",',
    '  "business": "事業内容（200字以内）",',
    '  "valueProp": "提供価値・強み（200字以内）",',
    '  "culture": "カルチャー・行動指針・働き方の特徴（300字以内）",',
    '  "idealProfile": "求める人物像（300字以内）"',
    '}',
    '',
    '制約:',
    '- 本文に書かれていないことは推測で埋めず、空文字にすること。',
    '- カルチャーや人物像は、サイトの表現をそのまま要約する（一般論で埋めない）。',
    '',
    `参考（サイトタイトル）: ${siteName || '不明'}`,
    '',
    '=== 企業サイト本文 ===',
    corpus,
  ].join('\n')

  const profile = await geminiGenerateJson<CompanyProfileData>(
    { prompt, model: GEMINI_TEXT_MODEL_DEFAULT },
    'MensetsuCompanyProfile'
  )

  return {
    profile: {
      companyName: profile.companyName || siteName || undefined,
      business: profile.business || undefined,
      valueProp: profile.valueProp || undefined,
      culture: profile.culture || undefined,
      idealProfile: profile.idealProfile || undefined,
    },
    pages,
  }
}
