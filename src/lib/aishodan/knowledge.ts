// ============================================
// ドヤAI商談 ナレッジ取り込み＋検索（RAG）
// ============================================
// MVPは「文字バイグラムのコサイン類似」で検索する。
// pgvector/embeddings は Phase 2。日本語に強く・依存なし・低レイテンシで、
// 商談中の2秒予算に収めるにはこれが現実解（ドヤカンニングで実証済み）。
//
// ⚠️ 根拠が見つからない場合は回答を作らせない。
//    商談は取引の入口であり、もっともらしい嘘は実害になる。
import { prisma } from '@/lib/prisma'
import { safeFetchText, htmlToText } from '@/lib/net/safe-fetch'
import { chunkText } from '@/lib/cunning/rag'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import type { ProductProfile } from './types'

/**
 * 優先して読むパス。ここに当たるものから先に取り込む。
 * ⚠️ **ここに当たらないリンクも読むこと。** 以前は当たるものだけを辿っており、
 *    サービスのパスが /quote /mensetsu のような固有名のサイトでは
 *    1ページも追加で取れず、トップページだけで商談に臨むことになっていた。
 *    実際に「サービスの強みが何も答えられない」という形で表面化した（2026-08-31）。
 */
const HINT_PATHS = ['/service', '/services', '/price', '/pricing', '/plan', '/plans', '/about', '/company', '/faq', '/case', '/cases', '/feature', '/product', '/solution']

/** 読んでも商談の役に立たないパス。件数を食うだけなので除く */
const SKIP_PATH_PATTERNS = [
  /^\/api\//, /^\/auth\//, /^\/_next\//, /^\/admin\//, /^\/login/, /^\/signup/,
  /^\/terms/, /^\/privacy/, /^\/tokushoho/, /^\/legal/, /^\/contact/,
  /\.(png|jpe?g|webp|gif|svg|ico|css|js|pdf|zip|xml|txt)$/i,
]

const MAX_PAGES = 14
const MAX_CHARS_PER_PAGE = 12000

function extractTitle(html: string): string | undefined {
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return t?.[1]?.trim()
}

export interface CrawledPage {
  url: string
  title?: string
  text: string
}

/** 同一ドメイン内のサービス・料金・FAQ系ページを集める */
export async function crawlProductSite(sourceUrl: string): Promise<CrawledPage[]> {
  const base = new URL(sourceUrl)
  const pages: CrawledPage[] = []

  const topHtml = await safeFetchText(base.toString()).catch(() => '')
  if (topHtml) {
    pages.push({
      url: base.toString(),
      title: extractTitle(topHtml),
      text: htmlToText(topHtml).slice(0, MAX_CHARS_PER_PAGE),
    })
  }

  // ⚠️ 優先パスと、それ以外の内部リンクを分けて集める。
  //    優先パスを先に読み切り、枠が余ったら他のページで埋める。
  const hinted: string[] = []
  const others: string[] = []
  const seenPaths = new Set<string>()
  if (topHtml) {
    const re = /href=["'](\/[^"'#?\s]*)/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(topHtml)) !== null) {
      const path = m[1].replace(/\/$/, '') || '/'
      if (path === '/' || seenPaths.has(path)) continue
      if (SKIP_PATH_PATTERNS.some((r) => r.test(path))) continue
      seenPaths.add(path)
      if (HINT_PATHS.some((h) => path.toLowerCase().startsWith(h))) hinted.push(path)
      else others.push(path)
      if (seenPaths.size >= 80) break
    }
  }

  for (const path of [...hinted, ...others]) {
    if (pages.length >= MAX_PAGES) break
    const url = new URL(path, base).toString()
    if (pages.some((p) => p.url === url)) continue
    const html = await safeFetchText(url).catch(() => '')
    if (!html) continue
    const text = htmlToText(html).slice(0, MAX_CHARS_PER_PAGE)
    if (text.length < 200) continue
    pages.push({ url, title: extractTitle(html), text })
  }

  return pages
}

/** 取り込んだページを source として保存し、チャンク化してインデックス化する */
export async function ingestPages(productId: string, pages: CrawledPage[]): Promise<number> {
  let total = 0
  for (const page of pages) {
    const source = await prisma.aishodanSource.create({
      data: { productId, type: 'url', url: page.url, title: page.title || null, rawText: page.text },
    })
    const chunks = chunkText(page.text)
    if (chunks.length === 0) continue
    await prisma.aishodanChunk.createMany({
      data: chunks.map((text, ord) => ({ productId, sourceId: source.id, ord, text })),
    })
    total += chunks.length
  }
  return total
}

/** 手入力のFAQ・想定問答を取り込む */
export async function ingestManual(productId: string, title: string, text: string): Promise<number> {
  const source = await prisma.aishodanSource.create({
    data: { productId, type: 'manual', title, rawText: text },
  })
  const chunks = chunkText(text)
  if (chunks.length === 0) return 0
  await prisma.aishodanChunk.createMany({
    data: chunks.map((t, ord) => ({ productId, sourceId: source.id, ord, text: t })),
  })
  return chunks.length
}

// --- 検索 ---

function bigrams(s: string): Map<string, number> {
  const norm = s.toLowerCase().replace(/\s+/g, '')
  const m = new Map<string, number>()
  for (let i = 0; i < norm.length - 1; i++) {
    const g = norm.slice(i, i + 2)
    m.set(g, (m.get(g) || 0) + 1)
  }
  return m
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, na = 0, nb = 0
  for (const v of a.values()) na += v * v
  for (const v of b.values()) nb += v * v
  const [small, big] = a.size < b.size ? [a, b] : [b, a]
  for (const [g, v] of small) {
    const w = big.get(g)
    if (w) dot += v * w
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

export interface RetrievedChunk {
  id: string
  text: string
  score: number
  sourceTitle: string | null
  sourceUrl: string | null
}

/**
 * 質問に関連するチャンク上位K件。
 * ⚠️ minScore を下回るものは返さない。無理に返すと「根拠がある」ことになってしまい、
 *    根拠なしを検出できなくなる。
 */
export async function retrieve(
  productId: string,
  query: string,
  topK = 4,
  minScore = 0.12
): Promise<RetrievedChunk[]> {
  if (!query.trim()) return []
  const chunks = await prisma.aishodanChunk.findMany({
    where: { productId },
    select: { id: true, text: true, source: { select: { title: true, url: true } } },
    take: 3000,
  })
  if (chunks.length === 0) return []

  const q = bigrams(query)
  return chunks
    .map((c) => ({
      id: c.id,
      text: c.text,
      score: cosine(q, bigrams(c.text)),
      sourceTitle: c.source?.title ?? null,
      sourceUrl: c.source?.url ?? null,
    }))
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

/** 取り込んだ内容から商材プロフィールを自動生成（ホストが編集して確定する） */
export async function generateProfile(pages: CrawledPage[]): Promise<ProductProfile> {
  const text = pages
    .map((p) => `【${p.title || p.url}】\n${p.text}`)
    .join('\n\n')
    .slice(0, 30000)

  const prompt = [
    'あなたは法人向けサービスの営業資料を作るプロです。',
    '以下のWebサイトの内容から、AIが商談で使う「商材プロフィール」を作成してください。',
    '',
    '【重要な制約】',
    '- **サイトに書かれていることだけ**から作ってください。あなたの知識で補完してはいけません。',
    '- pricing は、サイトに金額の記載があればそれを書き写し、無ければ空文字にしてください。',
    '  推測した金額を書くことは禁止です。',
    '- faq はサイトに実際にあるQ&A、または本文から確実に答えられる質問だけにしてください。',
    '',
    '【出力するJSONの形式】',
    '{',
    '  "oneLiner": "このサービスを一言で（40字以内）",',
    '  "valueProp": "提供価値（150字程度）",',
    '  "targetCustomer": "想定顧客（100字程度）",',
    '  "pricing": "料金（サイト記載のまま。記載が無ければ空文字）",',
    '  "differentiators": ["競合との違い（3〜5件）"],',
    '  "faq": [{ "q": "想定される質問", "a": "資料に基づく回答" }]',
    '}',
    '',
    '【サイトの内容】',
    text,
  ].join('\n')

  const raw = await geminiGenerateJson<ProductProfile>({ prompt, model: GEMINI_TEXT_MODEL_DEFAULT }, 'AishodanProfile')

  return {
    oneLiner: String(raw?.oneLiner || '').slice(0, 200),
    valueProp: String(raw?.valueProp || '').slice(0, 800),
    targetCustomer: String(raw?.targetCustomer || '').slice(0, 500),
    pricing: String(raw?.pricing || '').slice(0, 800),
    differentiators: (raw?.differentiators || []).filter((s) => typeof s === 'string').slice(0, 8),
    faq: (raw?.faq || [])
      .filter((f: any) => f && f.q && f.a)
      .slice(0, 20)
      .map((f: any) => ({ q: String(f.q).slice(0, 300), a: String(f.a).slice(0, 1000) })),
    doNotMention: [],
  }
}
