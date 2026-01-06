import { prisma } from '@/lib/prisma'
import { geminiGenerateJson, geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'
import { fetchAndExtract } from '@seo/lib/extract'
import { SeoCreateArticleInput, SeoOutline, SeoOutlineSchema } from '@seo/lib/types'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'
import { guessArticleGenreJa, buildArticleBannerPrompt } from '@seo/lib/bannerPlan'
import { hasSerpApiKey, serpapiSearchGoogle } from '@seo/lib/serpapi'

type ResearchEvent = {
  id: string
  at: number
  kind: 'search' | 'candidates' | 'discover' | 'queue' | 'fetch' | 'summarize' | 'store' | 'warn' | 'error'
  title: string
  detail?: string
  url?: string
}

function nowIso() {
  return new Date().toISOString()
}

function shortHost(u: string): string {
  try {
    return new URL(u).host
  } catch {
    return ''
  }
}

async function pushResearchEvent(jobId: string | undefined | null, ev: Omit<ResearchEvent, 'id'>) {
  const id = String(jobId || '').trim()
  if (!id) return
  const p = prisma as any
  try {
    const cur = await p.seoJob.findUnique({ where: { id }, select: { meta: true } })
    const meta = (cur?.meta as any) || {}
    const prev = Array.isArray(meta.researchEvents) ? (meta.researchEvents as any[]) : []
    const event: ResearchEvent = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      ...ev,
    }
    const next = [...prev, event].slice(-160)
    meta.researchEvents = next
    meta.researchLast = event
    await p.seoJob.update({ where: { id }, data: { meta } })
  } catch {
    // ignore (ログはベストエフォート)
  }
}

async function setResearchStats(jobId: string | undefined | null, patch: Record<string, any>) {
  const id = String(jobId || '').trim()
  if (!id) return
  const p = prisma as any
  try {
    const cur = await p.seoJob.findUnique({ where: { id }, select: { meta: true } })
    const meta = (cur?.meta as any) || {}
    meta.researchStats = { ...(meta.researchStats || {}), ...patch, updatedAt: Date.now() }
    await p.seoJob.update({ where: { id }, data: { meta } })
  } catch {
    // ignore
  }
}

function clampText(s: string, max = 12000): string {
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max)}\n...(truncated)` : s
}

async function buildUserKnowledgeContext(userId?: string | null): Promise<string> {
  const uid = String(userId || '').trim()
  if (!uid) return ''
  try {
    const p = prisma as any
    const items = await p.seoKnowledgeItem.findMany({
      where: { userId: uid, type: 'user_knowledge' },
      orderBy: { createdAt: 'desc' },
      take: 8,
    })
    if (!Array.isArray(items) || items.length === 0) return ''
    const blocks = items.map((it: any) => {
      const title = String(it.title || '').trim()
      const content = clampText(String(it.content || ''), 1800)
      return `- ${title}\n${content}`
    })
    return `\n\n=== 独自情報（あなたのナレッジ） ===\n${blocks.join('\n\n')}\n`
  } catch {
    return ''
  }
}

function mdCharCount(s: string): number {
  return (s || '').replace(/\r\n/g, '\n').length
}

async function generateTopTables(article: any, merged: string): Promise<string> {
  // 短い記事ほど「冒頭に表」が効く（表でスキャン→本文を読ませる）
  const target = Math.max(3000, Number(article?.targetChars || 10000))
  if (target > 6500) return ''

  const forbidden = Array.isArray(article.forbidden) ? article.forbidden : (article.forbidden as any) || []
  const requestText = article.requestText ? clampText(String(article.requestText || ''), 1800) : ''
  const userKnowledge = await buildUserKnowledgeContext(article.userId)

  const prompt = [
    'You are a Japanese business editor.',
    'Goal: Create table-first blocks to improve scanability for a short Japanese article.',
    'Output ONLY Markdown.',
    NO_AI_MARKDOWN_RULES,
    '',
    `Title: ${String(article.title || '')}`,
    `Keywords: ${((article.keywords as any) || []).join(', ')}`,
    article.persona ? `Persona: ${clampText(String(article.persona || ''), 800)}` : '',
    article.searchIntent ? `Search intent: ${clampText(String(article.searchIntent || ''), 800)}` : '',
    `Target chars: ${target}`,
    `Tone: ${String(article.tone || '')}`,
    forbidden.length ? `Forbidden: ${(forbidden as string[]).join(' / ')}` : '',
    requestText
      ? `\n【一次情報（最優先で反映）】\n以下はユーザーが提供した固有情報です。必ず具体的に反映してください。\n- ここに無い事実（数字/体験/実績/断定）は作らない\n\n${requestText}\n`
      : '',
    '',
    userKnowledge,
    'Context (truncated):',
    clampText(merged, 6500),
    '',
    'Rules:',
    '- Create TWO blocks placed near the top of the article.',
    '- Use headings starting from "##".',
    '- Block 1: "## 要点早見表" then a markdown table (6-10 rows) that summarizes conclusions and next actions.',
    '- Block 2: "## 迷ったらこれ（判断チェック表）" then a markdown table (6-10 rows) that helps decision-making (criteria, how to judge, recommended choice).',
    '- Tables must be valid Markdown tables using "|" and a separator row like "| --- |".',
    '- Do NOT add any intro text before the first heading.',
    '- Do not include code fences.',
  ].join('\n')

  try {
    const out = await geminiGenerateText({
      model: GEMINI_TEXT_MODEL_DEFAULT,
      parts: [{ text: prompt }],
      generationConfig: { temperature: 0.45, maxOutputTokens: 1700 },
    })
    return out?.trim() ? sanitizeAiMarkdown(out.trim()) : ''
  } catch {
    return ''
  }
}

async function canUseSeoImagesForArticle(article: any): Promise<boolean> {
  try {
    const userId = String(article?.userId || '').trim()
    if (!userId) return false
    // autoBundleが明示OFFなら常に生成しない
    if (article?.autoBundle === false) return false
    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: { seoPlan: true, plan: true },
    })
    const raw = String(user?.seoPlan || user?.plan || '').toUpperCase().trim()
    return raw === 'PRO' || raw === 'ENTERPRISE'
  } catch {
    return false
  }
}

// いかにもAIっぽいMarkdown記号を避ける（プロンプトでも強制しつつ、最後に軽くサニタイズ）
function sanitizeAiMarkdown(md: string): string {
  let s = String(md || '')
  // 強調記号（太字/下線）を落とす（"**" や "__" が残るとAI感が強い）
  s = s.replace(/\*\*/g, '')
  s = s.replace(/__/g, '')
  // チェックボックス記法を通常の箇条書きに寄せる
  s = s.replace(/^\s*-\s*\[\s*[xX]?\s*\]\s*/gm, '- ')
  return s
}

function truncateMarkdownByParagraph(md: string, maxChars: number): string {
  const max = Math.max(500, Number(maxChars || 0))
  const chunks = String(md || '').replace(/\r\n/g, '\n').split(/\n{2,}/g)
  const out: string[] = []
  let cur = 0
  for (const c of chunks) {
    const t = c.trim()
    if (!t) continue
    const nextLen = cur + t.length + (out.length ? 2 : 0)
    if (nextLen > max) break
    out.push(t)
    cur = nextLen
  }
  const trimmed = out.join('\n\n').trim()
  return trimmed || String(md || '').slice(0, max).trim()
}

const NO_AI_MARKDOWN_RULES = [
  'Important formatting rules (must follow):',
  '- Do NOT use Markdown emphasis markers: do not output "**", "*", "__", "_".',
  '- Do NOT use checklist notation: do not output "- [ ]" or "- [x]". Use normal bullet/numbered lists instead.',
  '- Do NOT wrap labels like Q/A with bold. Use plain "Q:" / "A:".',
  '- You can use bullet lists ("- " or "* ") and numbered lists ("1. " "2. ") when appropriate for readability.',
].join('\n')

function normalizeH2Heading(md: string, fallback: string): string {
  const t = (md || '').trim()
  if (!t) return `## ${fallback}\n\n（生成に失敗しました）`
  if (/^##\s+/m.test(t)) return t
  // 先頭がH2でない場合は補う（統合で崩れないように）
  return `## ${fallback}\n\n${t}`
}

function computeMinSections(targetChars: number): number {
  // 目標文字数に応じた適切なセクション数を計算
  // 1セクションあたり約1500-2500字を目安
  const t = Math.max(3000, Number(targetChars || 10000))
  
  if (t <= 5000) {
    // 5,000字以下: 3-5セクション
    return Math.max(3, Math.ceil(t / 1500))
  } else if (t <= 10000) {
    // 5,001-10,000字: 5-8セクション
    return Math.max(5, Math.ceil(t / 1800))
  } else if (t <= 20000) {
    // 10,001-20,000字: 8-12セクション
    return Math.max(8, Math.ceil(t / 2200))
  } else {
    // 20,001字以上: 12-28セクション
    const min = Math.ceil(t / 2800)
    return Math.max(12, Math.min(28, min))
  }
}

function ensureMinSections(outline: SeoOutline, targetChars: number): SeoOutline {
  const minSections = computeMinSections(targetChars)
  if (outline.sections.length >= minSections) return outline

  // 目標文字数に応じた1セクションあたりの文字数
  const charsPerSection = Math.max(800, Math.min(2500, Math.round(targetChars / minSections)))

  const extras: SeoOutline['sections'] = []
  const templates = [
    { h2: '比較表で一気に整理：RPO会社の選び方（用途別）', intentTag: '比較' },
    { h2: '導入前に必ず確認すべきチェックリスト（コピペ可）', intentTag: '手順' },
    { h2: 'よくある失敗談と回避策（現場で起きがち）', intentTag: '失敗例' },
    { h2: '社内稟議を通すための説明テンプレ（例文つき）', intentTag: 'テンプレ' },
    { h2: 'よくある質問（FAQ）', intentTag: 'FAQ' },
  ]
  let idx = 0
  while (outline.sections.length + extras.length < minSections) {
    const t = templates[idx % templates.length]
    extras.push({
      h2: t.h2,
      intentTag: t.intentTag,
      plannedChars: charsPerSection,
      h3: [],
      h4: {},
    })
    idx++
  }

  return {
    ...outline,
    sections: [...outline.sections, ...extras],
  }
}

function outlineItemToString(v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>
    const pick = (k: string) => (typeof obj[k] === 'string' ? (obj[k] as string).trim() : '')
    // よくあるキー候補（faq/question, glossary/term 等）
    const s =
      pick('text') ||
      pick('value') ||
      pick('title') ||
      pick('name') ||
      pick('q') ||
      pick('question') ||
      pick('term')
    if (s) return s
    try {
      return JSON.stringify(obj)
    } catch {
      return ''
    }
  }
  return ''
}

function normalizeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map(outlineItemToString)
    .map((s) => s.trim())
    .filter(Boolean)
}

function toOutlineMarkdown(outline: SeoOutline): string {
  const lines: string[] = []
  lines.push('# アウトライン')
  // entries() は環境によって downlevelIteration が必要になるため、通常forで回す
  for (let i = 0; i < outline.sections.length; i++) {
    const sec = outline.sections[i]
    lines.push(`\n## ${i + 1}. ${sec.h2}${sec.intentTag ? `（意図: ${sec.intentTag}）` : ''}`)
    if (sec.h3?.length) {
      for (const h3 of sec.h3) {
        lines.push(`- ${h3}`)
        const h4s = sec.h4?.[h3] || []
        for (const h4 of h4s) lines.push(`  - ${h4}`)
      }
    }
  }
  if (outline.faq?.length) {
    lines.push('\n## FAQ候補')
    for (const q of outline.faq) lines.push(`- ${q}`)
  }
  if (outline.glossary?.length) {
    lines.push('\n## 用語集候補')
    for (const t of outline.glossary) lines.push(`- ${t}`)
  }
  if (outline.internalLinkIdeas?.length) {
    lines.push('\n## 内部リンク案')
    for (const t of outline.internalLinkIdeas) lines.push(`- ${t}`)
  }
  if (outline.diagramIdeas?.length) {
    lines.push('\n## 図解アイデア')
    for (const d of outline.diagramIdeas) {
      lines.push(`- ${d.title}: ${d.description}${d.insertionHint ? `（挿入: ${d.insertionHint}）` : ''}`)
    }
  }
  return lines.join('\n')
}

async function buildResearchContext(articleId: string): Promise<string> {
  const p = prisma as any
  const refs = await p.seoReference.findMany({
    where: { articleId },
    orderBy: { createdAt: 'asc' },
  })
  if (!refs.length) return ''

  const blocks = refs.map((r: any) => {
    const h2 = (r.headings as any)?.h2
    const h3 = (r.headings as any)?.h3
    const insights = r.insights as any
    return [
      `URL: ${r.url}`,
      r.title ? `TITLE: ${r.title}` : '',
      r.summary ? `SUMMARY: ${clampText(r.summary, 1200)}` : '',
      Array.isArray(h2) && h2.length ? `H2: ${h2.slice(0, 15).join(' / ')}` : '',
      Array.isArray(h3) && h3.length ? `H3: ${h3.slice(0, 20).join(' / ')}` : '',
      insights?.claims?.length ? `CLAIMS: ${(insights.claims as string[]).slice(0, 10).join(' / ')}` : '',
      insights?.faq?.length ? `FAQ: ${(insights.faq as string[]).slice(0, 10).join(' / ')}` : '',
      insights?.internalLinks?.length
        ? `INTERNAL_LINKS: ${(insights.internalLinks as string[]).slice(0, 10).join(' / ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n')
  })

  return `\n\n=== RESEARCH (summarized) ===\n${blocks.join('\n\n---\n\n')}\n`
}

function normalizeUrlMaybe(raw: any): string {
  const s = String(raw || '').trim()
  if (!s) return ''
  if (!/^https?:\/\//i.test(s)) return ''
  return s
}

function comparisonCoverageNote(article: any): string {
  const isComparison = String(article?.mode || '').toLowerCase() === 'comparison_research'
  if (!isComparison) return ''
  const cfg = (article?.comparisonConfig as any) || {}
  const desired = Math.max(0, Math.min(60, Number(cfg?.count || 0)))
  const candidates = Array.isArray(article?.comparisonCandidates) ? (article.comparisonCandidates as any[]) : []
  const actual = uniqCandidatesByName(candidates).length
  const names = uniqCandidatesByName(candidates)
    .map((c: any) => String(c?.name || '').trim())
    .filter(Boolean)
    .slice(0, 10)
  const nameNote = names.length ? `（比較対象: ${names.join(' / ')}${actual > names.length ? ' …' : ''}）` : ''

  // 比較件数は必ず本文に明記する（仕様）
  if (!desired) {
    return `本記事はオンライン検索・公式サイト等の公開情報をもとに、実在する ${actual}社を比較して作成しています。${nameNote}`.trim()
  }
  if (actual >= desired) {
    return `本記事はオンライン検索・公式サイト等の公開情報をもとに、実在する ${actual}社（目標: ${desired}社）を比較して作成しています。${nameNote}`.trim()
  }
  return `【注意】本記事は当初「${desired}社比較」を想定していましたが、執筆時点で調査できたのは ${actual}社分まででした。以降の比較・表は ${actual}社の範囲で作成しています。${nameNote}`.trim()
}

async function maybeDiscoverReferenceUrls(article: any, jobId?: string) {
  // NOTE: 全記事向け。どのタイプの記事でも最新情報・具体例を収集
  const p = prisma as any
  const existing = Array.isArray(article?.referenceUrls) ? (article.referenceUrls as any[]) : []
  const targetChars = Math.max(3000, Number(article?.targetChars || 10000))
  // 文字数が小さい記事ほど検索を軽く（必要に応じて機能を調整）
  const maxUrls = targetChars >= 20000 ? 12 : targetChars >= 10000 ? 10 : 6
  if (existing.length >= Math.min(5, maxUrls)) return // 既に十分あればスキップ
  if (!hasSerpApiKey()) return

  const title = String(article?.title || '').trim()
  const keywords = Array.isArray(article?.keywords) ? (article.keywords as any[]) : []
  // NOTE: タイトル丸ごとだとノイズで検索精度が落ちるため「核だけ」に正規化
  const q = buildResearchBaseQuery(title, keywords) || [title, ...keywords.slice(0, 3)].filter(Boolean).join(' ')
  if (!q) return

  await pushResearchEvent(jobId, {
    at: Date.now(),
    kind: 'search',
    title: '参考記事を検索中…',
    detail: q,
  })

  // 複数の検索クエリで多角的に情報収集
  const queries =
    targetChars >= 10000
      ? [
          `${q} 最新`, // 最新情報
          `${q} 事例 成功事例`, // 具体例・実例
          `${q} やり方 方法`, // ハウツー
          `${q} 料金 費用`, // 料金情報
        ]
      : [
          `${q} 最新`,
          `${q} やり方 方法`,
          `${q} 料金 費用`,
        ]

  const allUrls: string[] = [...existing]
  for (const query of queries) {
    if (allUrls.length >= maxUrls) break
    try {
      const perQuery = targetChars >= 10000 ? 5 : 3
      const found = await serpapiSearchGoogle({ query, gl: 'jp', hl: 'ja', num: perQuery })
      for (const r of found.organic) {
        if (r.url && !allUrls.includes(r.url)) {
          allUrls.push(r.url)
        }
      }
    } catch {
      // ignore individual query failures
    }
  }

  const urls = allUrls.slice(0, maxUrls)
  if (!urls.length) return

  await pushResearchEvent(jobId, {
    at: Date.now(),
    kind: 'discover',
    title: `参考記事を追加しました（${urls.length - existing.length}件）`,
    detail: urls.slice(0, 5).map((u) => shortHost(u)).filter(Boolean).join(' / '),
  })

  try {
    await p.seoArticle.update({ where: { id: article.id }, data: { referenceUrls: urls as any } })
    article.referenceUrls = urls
  } catch {
    // ignore
  }
}

async function maybeDiscoverComparisonThirdPartyUrls(article: any, jobId?: string) {
  const p = prisma as any
  const isComparison = String(article?.mode || '').toLowerCase() === 'comparison_research'
  if (!isComparison) return
  const cfg = (article?.comparisonConfig as any) || {}
  if (!cfg?.includeThirdParty) return
  if (!hasSerpApiKey()) return

  const existing = Array.isArray(article?.referenceUrls) ? (article.referenceUrls as any[]) : []
  const base = (() => {
    const keywords = Array.isArray(article?.keywords) ? (article.keywords as any[]) : []
    const q = buildResearchBaseQuery(article?.title, keywords) || String(keywords[0] || article?.title || '').trim()
    return q
  })()
  if (!base) return

  // 比較メディア/レビュー/評判など第三者情報を少数追加（コスト/タイムアウト対策）
  const query = `${base} 比較 評判 口コミ おすすめ`
  const region = String(cfg?.region || 'JP').toUpperCase() === 'GLOBAL' ? 'GLOBAL' : 'JP'
  const gl = region === 'JP' ? 'jp' : 'us'
  const hl = region === 'JP' ? 'ja' : 'en'
  await pushResearchEvent(jobId, {
    at: Date.now(),
    kind: 'search',
    title: '比較メディア/評判を検索中…',
    detail: query,
  })
  const found = await serpapiSearchGoogle({ query, gl, hl, num: 10 })
  const urls = found.organic.map((x) => x.url).filter(Boolean).slice(0, 6)
  if (!urls.length) return

  const merged = Array.from(new Set([...existing, ...urls])).slice(0, 25)
  try {
    await p.seoArticle.update({ where: { id: article.id }, data: { referenceUrls: merged as any } })
    article.referenceUrls = merged
    await pushResearchEvent(jobId, {
      at: Date.now(),
      kind: 'discover',
      title: `参考記事を追加しました（${urls.length}件）`,
      detail: urls.map((u) => shortHost(u)).filter(Boolean).slice(0, 6).join(' / '),
    })
    await setResearchStats(jobId, { referenceUrls: merged.length })
  } catch {
    // ignore
  }
}

async function progressiveResearchFromReferenceUrls(article: any, opts?: { maxUrls?: number; jobId?: string }) {
  const p = prisma as any
  const urls = Array.isArray(article?.referenceUrls) ? (article.referenceUrls as any[]) : []
  const list = urls.map((u: any) => normalizeUrlMaybe(u)).filter(Boolean)
  if (!list.length) return { stored: 0 }

  const maxUrls = typeof opts?.maxUrls === 'number' && opts.maxUrls > 0 ? opts.maxUrls : 1

  // まだ保存されていないURLだけを対象にする
  const already = await p.seoReference.findMany({
    where: { articleId: article.id, url: { in: list } },
    select: { url: true },
  })
  const done = new Set((already || []).map((x: any) => String(x.url || '')))
  const pending = list.filter((u) => !done.has(u)).slice(0, maxUrls)
  if (!pending.length) return { stored: 0 }

  await pushResearchEvent(opts?.jobId, {
    at: Date.now(),
    kind: 'queue',
    title: `解析キューに追加（${pending.length}件）`,
    detail: pending.map((u) => shortHost(u)).filter(Boolean).join(' / '),
  })

  // 既存の researchAndStore は article.referenceUrls の先頭から順に回るので、
  // ここでは優先順を入れ替えて一時的に上書き → 解析後に元へ戻す
  const original = Array.isArray(article.referenceUrls) ? (article.referenceUrls as any[]) : []
  const reordered = Array.from(new Set([...pending, ...original.map((u: any) => String(u || '').trim())])).slice(0, 20)
  try {
    await p.seoArticle.update({ where: { id: article.id }, data: { referenceUrls: reordered as any } })
  } catch {
    // ignore
  }

  const out = await researchAndStore(article.id, { maxUrls: pending.length, jobId: opts?.jobId }).catch(() => ({ stored: 0 }))
  await setResearchStats(opts?.jobId, { referencesStored: (out as any)?.stored || 0 })
  return out
}

async function maybeAutoResearchComparison(article: any, jobId?: string) {
  const p = prisma as any
  const isComparison = String(article?.mode || '').toLowerCase() === 'comparison_research'
  if (!isComparison) return

  const candidates = Array.isArray(article?.comparisonCandidates) ? (article.comparisonCandidates as any[]) : []
  const urlsFromCandidates = candidates
    .map((c) => normalizeUrlMaybe(c?.websiteUrl))
    .filter(Boolean)
    .slice(0, 8) // タイムアウト/コスト対策

  if (!urlsFromCandidates.length) return

  // 既に参照が十分あるなら、毎回は走らせない
  const existingCount = await p.seoReference.count({
    where: { articleId: article.id, url: { in: urlsFromCandidates } },
  })
  if (existingCount >= Math.min(2, urlsFromCandidates.length)) return

  // referenceUrls にも反映（ログ/ナレッジ用途）
  const existing = Array.isArray(article.referenceUrls) ? (article.referenceUrls as any[]) : []
  const merged = Array.from(new Set([...existing, ...urlsFromCandidates])).slice(0, 25)
  try {
    await p.seoArticle.update({ where: { id: article.id }, data: { referenceUrls: merged as any } })
  } catch {
    // ignore
  }

  // 公式URL中心に抽出→要約を保存（最大2件）
  try {
    await pushResearchEvent(jobId, {
      at: Date.now(),
      kind: 'queue',
      title: '候補企業の公式URLを解析中…',
      detail: urlsFromCandidates.map((u) => shortHost(u)).filter(Boolean).join(' / '),
    })
    await researchAndStore(article.id, { maxUrls: Math.min(2, urlsFromCandidates.length), jobId })
  } catch (e) {
    console.warn('[comparison research] researchAndStore failed', e)
  }
}

function pickCandidateNameFromTitle(title: string): string {
  const t = String(title || '').trim()
  if (!t) return ''
  const parts = t.split(/[\|\｜\-–—]/).map((s) => s.trim()).filter(Boolean)
  const head = parts[0] || t
  const cleaned = head
    // よくある括弧注記を落とす（例: "〇〇（公式）", "△△【2026年】" など）
    .replace(/（[^）]{0,24}）/g, '')
    .replace(/【[^】]{0,24}】/g, '')
    // プレースホルダっぽい語を排除
    .replace(/(ツール名|サービス名|企業名|会社名|サービスA|会社A|ツールA|XXX|ＸＸＸ|〇〇).*/gi, '')
    .replace(/(料金|価格|評判|口コミ|比較|おすすめ|とは|まとめ|ランキング).*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  // 極端に短い/汎用語のみなら候補として採用しない
  if (cleaned.length < 2) return ''
  return cleaned
}

async function extractCandidatesFromSerpOrganic(args: {
  baseQuery: string
  organic: { title: string; url: string; snippet?: string }[]
  maxCandidates: number
  jobId?: string
}): Promise<{ name: string; websiteUrl?: string; notes?: string }[]> {
  const organic = Array.isArray(args.organic) ? args.organic : []
  if (!organic.length) return []

  // 検索結果一覧を渡して「サービス名」を抽出する（タイトルパースだけに依存しない）
  // NOTE: 比較メディアのタイトルが多い領域（例: RPO）で特に効く
  const max = Math.max(1, Math.min(80, Number(args.maxCandidates || 30)))
  const list = organic
    .slice(0, 60)
    .map((r, i) => `${i + 1}. TITLE: ${r.title}\nURL: ${r.url}\nSNIPPET: ${String(r.snippet || '').slice(0, 160)}`)
    .join('\n\n')

  const prompt = [
    'あなたは検索結果から「実在するサービス名」を抽出するデータ抽出器です。',
    '',
    `テーマ: ${args.baseQuery}`,
    '',
    '入力はGoogle検索結果（SerpAPI）の一覧です。ここから比較対象になり得る「サービス名（固有名詞）」をできるだけ多く抽出してください。',
    '',
    '重要ルール:',
    '- 架空のサービス名は絶対に作らない',
    '- できるだけ「サービス/プロダクト名」を優先（企業名しか分からない場合は企業名でもOK）',
    '- 比較メディア/口コミサイト/まとめサイト自体（例: ITreview, BOXIL, note, Qiita, Wikipedia等）は候補に入れない',
    '- URLは公式が確実なら websiteUrl に入れる。不確実なら空文字にしてよい（後段で公式URL補完する）',
    `- 最大 ${max} 件まで`,
    '',
    '出力形式: JSON配列のみ（説明不要）',
    '例: [{"name":"◯◯","websiteUrl":"https://...","notes":"短い補足"}]',
    '',
    '検索結果一覧:',
    list,
  ].join('\n')

  try {
    const result = await geminiGenerateJson({
      model: GEMINI_TEXT_MODEL_DEFAULT,
      parts: [{ text: prompt }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4000 },
    })
    if (!Array.isArray(result)) return []
    return result
      .map((x: any) => ({
        name: String(x?.name || '').trim().slice(0, 60),
        websiteUrl: typeof x?.websiteUrl === 'string' ? normalizeUrlMaybe(x.websiteUrl) : undefined,
        notes: typeof x?.notes === 'string' ? String(x.notes).trim().slice(0, 140) : undefined,
      }))
      .filter((x) => x.name.length >= 2 && !containsPlaceholderNames(x.name))
      .slice(0, max)
  } catch (e: any) {
    await pushResearchEvent(args.jobId, {
      at: Date.now(),
      kind: 'error',
      title: '検索結果からの候補抽出（AI）に失敗しました',
      detail: String(e?.message || e || '').slice(0, 240),
    })
    return []
  }
}

function containsPlaceholderNames(text: string): boolean {
  const s = String(text || '')
  // 「（ツール名）」などのテンプレや、A/B/XXX/〇〇 のダミーを検知
  return /（\s*(ツール名|サービス名|企業名|会社名)\s*）|\(\s*(tool name|service name|company name)\s*\)|サービス[ＡA]|会社[ＡA]|ツール[ＡA]|XXX|ＸＸＸ|〇〇/.test(s)
}

function escapeMdCell(s: any): string {
  const t = String(s || '').replace(/\r\n/g, '\n').replace(/\n+/g, ' ').trim()
  // markdown table のセルを壊す記号を軽く抑える
  return t.replace(/\|/g, '｜')
}

function buildServiceListTableMarkdown(candidates: any[], maxRows: number): string {
  const rows = (Array.isArray(candidates) ? candidates : []).slice(0, Math.max(0, maxRows))
  const header = ['サービス名', '特徴', '料金', '得意な業界・職種', 'URL']
  const sep = ['---', '---', '---', '---', '---']
  const lines: string[] = []
  lines.push(`| ${header.join(' | ')} |`)
  lines.push(`| ${sep.join(' | ')} |`)
  for (const c of rows) {
    const name = escapeMdCell(c?.name || '')
    const features = Array.isArray(c?.features) && c.features.length ? escapeMdCell(c.features.slice(0, 3).join('、')) : ''
    const desc = escapeMdCell(c?.description || c?.notes || '')
    const featureCell = features || desc || '要問い合わせ'
    const pricing = escapeMdCell(c?.pricing || '要問い合わせ')
    // 得意領域がない場合は、説明から軽く推測せず「要問い合わせ」に寄せる（架空抑止）
    const domain = escapeMdCell(c?.domain || c?.specialty || '') || '要問い合わせ'
    const url = escapeMdCell(normalizeUrlMaybe(c?.websiteUrl) || '')
    lines.push(`| ${name || '（名称不明）'} | ${featureCell} | ${pricing} | ${domain} | ${url} |`)
  }
  return lines.join('\n')
}

function fillEmptyServiceTables(md: string, candidates: any[], maxRows: number): string {
  let s = String(md || '')
  if (!s.trim()) return s
  const table = buildServiceListTableMarkdown(candidates, maxRows)
  if (!table.trim() || table.split('\n').length < 3) return s

  // 「サービス名/特徴/料金/得意な業界・職種/URL」の表がヘッダーだけ（行が無い）なら差し替える
  // 例:
  // | サービス名 | 特徴 | 料金 | 得意な業界・職種 | URL |
  // | --- | --- | --- | --- | --- |
  // （ここで途切れる/空行/次の見出しに行く）
  const emptyTableRe =
    /\|\s*サービス名\s*\|\s*特徴\s*\|\s*料金\s*\|\s*得意な業界・職種\s*\|\s*URL\s*\|\s*\n\|\s*-{3,}\s*\|\s*-{3,}\s*\|\s*-{3,}\s*\|\s*-{3,}\s*\|\s*-{3,}\s*\|\s*(?:\n(?!(\|)).*)?/g

  // まずはシンプルな「ヘッダー+区切りのみ」のケースを置換
  s = s.replace(
    /\|\s*サービス名\s*\|\s*特徴\s*\|\s*料金\s*\|\s*得意な業界・職種\s*\|\s*URL\s*\|\s*\n\|\s*-{3,}\s*\|\s*-{3,}\s*\|\s*-{3,}\s*\|\s*-{3,}\s*\|\s*-{3,}\s*\|\s*(?=\n(?!\|))/g,
    table + '\n'
  )

  // それでも残っていたら、やや広めに（次行が見出し/注釈で始まる等）を置換
  s = s.replace(
    /\|\s*サービス名\s*\|\s*特徴\s*\|\s*料金\s*\|\s*得意な業界・職種\s*\|\s*URL\s*\|\s*\n\|\s*-{3,}\s*\|\s*-{3,}\s*\|\s*-{3,}\s*\|\s*-{3,}\s*\|\s*-{3,}\s*\|\s*\n(?=(?:\n|##\s|注\s*:|※|$))/g,
    table + '\n\n'
  )

  return s
}

function deriveStrengthWeakness(c: any): { strength: string; weakness: string } {
  const features =
    Array.isArray(c?.features) && c.features.length
      ? c.features
          .slice(0, 4)
          .map((x: any) => String(x || '').trim())
          .filter(Boolean)
      : []
  const desc = String(c?.description || c?.notes || '').trim()
  const pricing = String(c?.pricing || '').trim()
  const url = String(normalizeUrlMaybe(c?.websiteUrl) || '').trim()

  // 強み: 公式サイトから抽出できた特徴（features/description）をベースにする
  const strength = escapeMdCell(features.length ? features.join('、') : desc ? desc.slice(0, 80) : '要確認（公式サイトで確認）')

  // 弱み: 断定・推測を避け、公開情報の不足/確認点を中心に記載する（架空抑止）
  const weaknessHints: string[] = []
  if (!pricing || pricing.includes('要問い合わせ')) weaknessHints.push('料金が公開されていない/要問い合わせ')
  if (!url) weaknessHints.push('公式URLが不明（要確認）')
  if (!weaknessHints.length) weaknessHints.push('プラン/条件により内容が変わる可能性（要確認）')
  const weakness = escapeMdCell(weaknessHints.slice(0, 2).join('、'))

  return { strength, weakness }
}

function buildProsConsTableMarkdown(candidates: any[], maxRows: number): string {
  const rows = (Array.isArray(candidates) ? candidates : []).slice(0, Math.max(0, maxRows))
  const header = ['サービス名', '強み（特徴）', '弱み（注意点）', '料金', '公式URL']
  const sep = ['---', '---', '---', '---', '---']
  const lines: string[] = []
  lines.push(`| ${header.join(' | ')} |`)
  lines.push(`| ${sep.join(' | ')} |`)
  for (const c of rows) {
    const name = escapeMdCell(c?.name || '') || '（名称不明）'
    const { strength, weakness } = deriveStrengthWeakness(c)
    const pricingCell = escapeMdCell(c?.pricing || '要問い合わせ')
    const urlCell = escapeMdCell(normalizeUrlMaybe(c?.websiteUrl) || '')
    lines.push(`| ${name} | ${strength} | ${weakness} | ${pricingCell} | ${urlCell} |`)
  }
  return lines.join('\n')
}

function insertAfterH1(md: string, block: string): string {
  const s = String(md || '').replace(/\r\n/g, '\n')
  if (!s.trim() || !block.trim()) return s
  const lines = s.split('\n')
  if (!lines.length) return s
  // 既に挿入済みなら何もしない
  if (s.includes('## 比較表（強み・弱み）')) return s

  const out: string[] = []
  let i = 0
  out.push(lines[i] || '')
  i++
  // drop/keep blanks
  while (i < lines.length && !lines[i].trim()) {
    out.push(lines[i])
    i++
  }
  // keep banner image line if already present
  if (i < lines.length && /^!\[.*\]\(.+\)/.test(lines[i].trim())) {
    out.push(lines[i])
    i++
    while (i < lines.length && !lines[i].trim()) {
      out.push(lines[i])
      i++
    }
  }
  out.push('')
  out.push(block.trim())
  out.push('')
  out.push(...lines.slice(i))
  return out.join('\n').replace(/\n{4,}/g, '\n\n\n').trim()
}

function ensureProsConsTable(md: string, candidates: any[], maxRows: number): string {
  const list = uniqCandidatesByName(Array.isArray(candidates) ? candidates : [])
  if (!list.length) return md
  const table = buildProsConsTableMarkdown(list, maxRows)
  if (!table.trim() || table.split('\n').length < 3) return md
  const block = [
    '## 比較表（強み・弱み）',
    '',
    '※ 強みは公式サイト等の公開情報から抽出した特徴ベース、弱みは「要確認点（公開情報の不足/条件差）」中心に記載しています。',
    '',
    table,
  ].join('\n')
  return insertAfterH1(md, block)
}

function inferComparisonCountFromTitle(title: string, keywords: any): number {
  const t = String(title || '')
  const ks = Array.isArray(keywords) ? keywords.map((x: any) => String(x || '')).join(' ') : String(keywords || '')
  const hay = `${t} ${ks}`.replace(/\s+/g, ' ').trim()
  if (!hay) return 0

  // 例: "おすすめ50選", "比較30社", "ランキング20選", "TOP50"
  const patterns = [
    /(?:おすすめ|比較|ランキング|厳選)\s*([0-9]{1,2})\s*(?:選|社)/i,
    /TOP\s*([0-9]{1,2})/i,
    /([0-9]{1,2})\s*(?:選|社)\s*(?:おすすめ|比較|ランキング)/i,
  ]
  for (const re of patterns) {
    const m = hay.match(re)
    const n = m?.[1] ? Number(m[1]) : 0
    if (Number.isFinite(n) && n > 0) return Math.max(0, Math.min(60, Math.floor(n)))
  }
  return 0
}

function buildComparisonBaseQuery(title: any, keywords: any): string {
  const t = String(title || '').replace(/\r\n/g, ' ').trim()
  const ks = Array.isArray(keywords) ? keywords.map((x: any) => String(x || '')).join(' ') : String(keywords || '')
  const raw = `${t} ${ks}`.replace(/\s+/g, ' ').trim()
  if (!raw) return ''

  // 例: 「RPO（採用代行）おすすめ比較50選｜選び方と料金相場【2026年最新】」
  // → 「RPO 採用代行」
  let s = raw
    // 記号/飾りを落とす
    .replace(/[｜|]/g, ' ')
    .replace(/【[^】]*】/g, ' ')
    .replace(/（[^）]*）/g, (m) => ` ${m.replace(/[（）]/g, '')} `) // 括弧の中身は残す（採用代行など）
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/（\s*[^）]*\s*）/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // 記号類を空白へ（日本語/英数は残す）
    .replace(/\s+/g, ' ')
    .trim()

  // 比較ワード/ノイズを削る
  s = s
    .replace(/(?:おすすめ|比較|ランキング|厳選|まとめ|選び方|料金相場|とは|最新|完全版|保存版)/g, ' ')
    .replace(/(?:top)\s*\d{1,3}/gi, ' ')
    .replace(/\d{1,3}\s*(?:選|社)/g, ' ')
    .replace(/\b20\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // 極端に長いと検索が死ぬので短く
  const tokens = s.split(' ').filter(Boolean)
  const compact = tokens.slice(0, 4).join(' ')
  return compact
}

function buildResearchBaseQuery(title: any, keywords: any): string {
  // 比較だけでなく通常記事でも「核だけ」を検索するための正規化
  const t = String(title || '').replace(/\r\n/g, ' ').trim()
  const ks = Array.isArray(keywords) ? keywords.map((x: any) => String(x || '')).join(' ') : String(keywords || '')
  const raw = `${t} ${ks}`.replace(/\s+/g, ' ').trim()
  if (!raw) return ''

  let s = raw
    .replace(/[｜|]/g, ' ')
    .replace(/【[^】]*】/g, ' ')
    .replace(/（[^）]*）/g, (m) => ` ${m.replace(/[（）]/g, '')} `)
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // 記事タイトルによく入るノイズ語を削る
  s = s
    .replace(
      /(?:おすすめ|比較|ランキング|厳選|まとめ|完全版|保存版|初心者|入門|ガイド|やり方|方法|手順|テンプレ|例文|チェックリスト|料金|費用|相場|口コミ|評判|最新)/g,
      ' '
    )
    .replace(/(?:top)\s*\d{1,3}/gi, ' ')
    .replace(/\d{1,3}\s*(?:選|社)/g, ' ')
    .replace(/\b20\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const tokens = s.split(' ').filter(Boolean)
  return tokens.slice(0, 5).join(' ')
}

function isWeakSearchQuery(q: string): boolean {
  const s = String(q || '').trim()
  if (!s) return true
  // 例: 「年最新版」などの“中身が無い”検索を弾く
  const stop = new Set([
    '年',
    '最新版',
    '最新',
    'おすすめ',
    '比較',
    'ランキング',
    '厳選',
    'まとめ',
    '完全版',
    '保存版',
    '選び方',
    '料金',
    '費用',
    '相場',
    '口コミ',
    '評判',
    'ガイド',
    '入門',
    '初心者',
  ])
  const tokens = s
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !stop.has(t))
  if (!tokens.length) return true
  if (tokens.join('').length < 3) return true
  return false
}

function buildCandidateSearchSeed(article: any): string {
  const title = String(article?.title || '').trim()
  const keywords = Array.isArray(article?.keywords) ? (article.keywords as any[]) : []
  const k0 = String(keywords?.[0] || '').trim()

  // 1) 比較向けに圧縮した核
  const q1 = buildComparisonBaseQuery(title, keywords)
  if (!isWeakSearchQuery(q1)) return q1

  // 2) 全記事向けの核（やや広め）
  const q2 = buildResearchBaseQuery(title, keywords)
  if (!isWeakSearchQuery(q2)) return q2

  // 3) キーワード先頭（ユーザーが意図してる可能性が高い）
  if (!isWeakSearchQuery(k0)) return k0

  // 4) タイトルをそのまま（最後の手段）
  return title
}

async function maybeAutoEnableComparisonResearchMode(article: any, jobId?: string) {
  // 「おすすめ50選」「比較30社」などのタイトルを検知したら、比較調査モードに自動で切り替える
  // 目的: standardモードで"サンプル数社"になってしまう失敗を防ぐ
  try {
    const curMode = String(article?.mode || '').toLowerCase()
    const desired = inferComparisonCountFromTitle(article?.title, article?.keywords)
    if (!desired) return
    if (!hasSerpApiKey()) return

    // 比較ワードがタイトル/キーワードにある場合のみ発動（過検知を防ぐ）
    const hay = `${String(article?.title || '')} ${(Array.isArray(article?.keywords) ? article.keywords : []).join(' ')}`.toLowerCase()
    const looksLikeList = /おすすめ|比較|ランキング|top/i.test(hay)
    if (!looksLikeList) return

    const cfg = (article?.comparisonConfig as any) || {}
    const nextCfg = {
      ...cfg,
      count: desired,
      region: cfg?.region || 'JP',
      requireOfficial: cfg?.requireOfficial !== false, // default true
      includeThirdParty: cfg?.includeThirdParty !== false, // default true
      template: cfg?.template || 'list',
    }

    const llmo = (article?.llmoOptions as any) || {}
    const nextLlmo = { ...llmo, comparison: llmo?.comparison !== false }

    if (curMode !== 'comparison_research' || Number(cfg?.count || 0) !== desired) {
      await pushResearchEvent(jobId, {
        at: Date.now(),
        kind: 'discover',
        title: 'タイトルから比較リサーチを自動適用',
        detail: `「${desired}選/社」形式を検知したため、比較モードで候補収集→表を作成します。`,
      })
      try {
        await (prisma as any).seoArticle.update({
          where: { id: article.id },
          data: {
            mode: 'comparison_research',
            comparisonConfig: nextCfg as any,
            llmoOptions: nextLlmo as any,
          },
        })
      } catch {
        // ignore
      }
      article.mode = 'comparison_research'
      article.comparisonConfig = nextCfg
      article.llmoOptions = nextLlmo
    }
  } catch {
    // ignore
  }
}

function uniqCandidatesByName(items: any[]): any[] {
  const seen = new Set<string>()
  const out: any[] = []
  for (const it of items) {
    const name = String(it?.name || '').trim()
    const key = name.toLowerCase()
    if (!name) continue
    if (seen.has(key)) continue
    seen.add(key)
    out.push(it)
  }
  return out
}

/**
 * 比較メディア記事をパースして、サービス名・URL・概要を抽出
 */
async function extractServicesFromComparisonArticle(
  articleUrl: string,
  baseQuery: string,
  jobId?: string
): Promise<{ name: string; websiteUrl?: string; notes?: string; sourceUrl?: string }[]> {
  try {
    await pushResearchEvent(jobId, {
      at: Date.now(),
      kind: 'fetch',
      title: '比較記事を解析中…',
      detail: shortHost(articleUrl),
      url: articleUrl,
    })
    const extracted = await fetchAndExtract(articleUrl)
    if (!extracted.text || extracted.text.length < 200) return []

    // AIに比較記事からサービス名・公式URL・概要を抽出させる
    const prompt = [
      'You are a data extractor. Parse the following comparison article and extract service/company names with their details.',
      '',
      `Base topic: ${baseQuery}`,
      '',
      '=== Article content (truncated) ===',
      clampText(extracted.text, 8000),
      '',
      '=== Task ===',
      'Extract up to 60 services/companies mentioned in this comparison article.',
      'For each, extract:',
      '- name: The exact service/company name (e.g., "マルゴト人事", "doda PRO")',
      '- websiteUrl: Official website URL if mentioned (leave empty if not found)',
      '- notes: Brief description (max 100 chars) of the service',
      '',
      'Output JSON array only. No explanation.',
      'Example: [{"name":"ServiceA","websiteUrl":"https://example.com","notes":"Description here"}]',
    ].join('\n')

    const result = await geminiGenerateJson({
      model: GEMINI_TEXT_MODEL_DEFAULT,
      parts: [{ text: prompt }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4000 },
    })

    if (!Array.isArray(result)) return []
    return result
      .filter((x: any) => typeof x?.name === 'string' && x.name.trim().length >= 2)
      .map((x: any) => ({
        name: String(x.name || '').trim().slice(0, 60),
        websiteUrl: typeof x.websiteUrl === 'string' ? normalizeUrlMaybe(x.websiteUrl) : undefined,
        notes: typeof x.notes === 'string' ? x.notes.slice(0, 150) : undefined,
        sourceUrl: articleUrl,
      }))
      .slice(0, 60)
  } catch (e) {
    console.warn('[extractServicesFromComparisonArticle] failed', e)
    return []
  }
}

/**
 * 候補リストに対して、公式URLが不足しているものを個別検索で補完
 */
async function enrichCandidatesWithOfficialUrls(
  candidates: any[],
  gl: 'jp' | 'us',
  hl: 'ja' | 'en',
  jobId?: string
): Promise<any[]> {
  const enriched: any[] = []
  let enrichCount = 0
  const maxEnrich = 50 // 最大50社まで公式URL補完

  for (const c of candidates) {
    const name = String(c?.name || '').trim()
    if (!name) continue

    // 既に公式URLがあるならスキップ
    if (c.websiteUrl && /^https?:\/\//.test(c.websiteUrl)) {
      enriched.push(c)
      continue
    }

    // 上限に達したらそのまま追加
    if (enrichCount >= maxEnrich) {
      enriched.push(c)
      continue
    }

    // 「サービス名 公式」で検索
    try {
      await pushResearchEvent(jobId, {
        at: Date.now(),
        kind: 'search',
        title: '公式サイトを検索中…',
        detail: name,
      })
      const found = await serpapiSearchGoogle({ query: `${name} 公式`, gl, hl, num: 3 })
      const officialUrl = found.organic.find((r) => {
        const u = String(r.url || '').toLowerCase()
        // 比較サイト/メディアを除外して公式っぽいものを優先
        return !u.includes('itreview') && !u.includes('boxil') && !u.includes('comparison') && !u.includes('ranking')
      })?.url

      enriched.push({
        ...c,
        websiteUrl: officialUrl || c.websiteUrl,
        source: officialUrl ? 'serpapi_official' : c.source,
      })
      enrichCount++
    } catch {
      enriched.push(c)
    }
  }

  return enriched
}

/**
 * Gemini知識ベースからサービス候補を生成（検索結果から取得できなかった場合のフォールバック）
 */
async function generateCandidatesFromGeminiKnowledge(args: {
  baseQuery: string
  keywords: string[]
  title: string
  existingNames: string[]
  maxCandidates: number
  jobId?: string
}): Promise<{ name: string; websiteUrl?: string; pricing?: string; features?: string[]; description?: string }[]> {
  const { baseQuery, keywords, title, existingNames, maxCandidates, jobId } = args

  await pushResearchEvent(jobId, {
    at: Date.now(),
    kind: 'search',
    title: 'Gemini知識からサービス候補を生成中…',
    detail: `「${baseQuery}」に関連する実在サービスを${maxCandidates}件程度抽出`,
  })

  const prompt = [
    'You are a Japanese business research expert with comprehensive knowledge of various service providers.',
    '',
    '=== Task ===',
    `Generate a list of REAL, EXISTING service providers/companies related to the following topic.`,
    'These must be actual companies that exist in the real world - DO NOT invent fictional names.',
    '',
    `Topic/Query: ${baseQuery}`,
    `Keywords: ${keywords.join(', ')}`,
    `Article title: ${title}`,
    '',
    existingNames.length ? `Already collected (do NOT include these): ${existingNames.slice(0, 20).join(', ')}` : '',
    '',
    '=== Requirements ===',
    '- Only include real, verifiable companies/services',
    '- Focus on well-known and reputable providers in Japan',
    '- Include a mix of large enterprises and notable mid-size companies',
    '- Provide official website URL if known (or leave empty if unsure)',
    '- Include typical pricing information if known publicly',
    '- List 3-5 key features for each service',
    '',
    `=== Output ===`,
    `Provide exactly ${Math.min(60, maxCandidates)} services in JSON array format:`,
    '[{"name":"サービス名","websiteUrl":"https://...","pricing":"月額○○円〜/要問い合わせ","features":["特徴1","特徴2","特徴3"],"description":"概要説明"}]',
    '',
    'IMPORTANT:',
    '- Output valid JSON array only',
    '- All text in Japanese',
    '- If pricing is unknown, use "要問い合わせ"',
    '- If URL is unknown, omit websiteUrl field',
  ].filter(Boolean).join('\n')

  const result = await geminiGenerateJson<any[]>({
    model: GEMINI_TEXT_MODEL_DEFAULT,
    prompt,
    generationConfig: { temperature: 0.3, maxOutputTokens: 8000 },
  })

  if (!Array.isArray(result)) return []

  const existingSet = new Set(existingNames.map((n) => n.toLowerCase().trim()))

  return result
    .filter((x: any) => {
      const name = String(x?.name || '').trim()
      if (name.length < 2) return false
      if (existingSet.has(name.toLowerCase())) return false
      if (containsPlaceholderNames(name)) return false
      return true
    })
    .map((x: any) => ({
      name: String(x.name || '').trim().slice(0, 60),
      websiteUrl: typeof x.websiteUrl === 'string' ? normalizeUrlMaybe(x.websiteUrl) : undefined,
      pricing: typeof x.pricing === 'string' ? x.pricing.slice(0, 100) : '要問い合わせ',
      features: Array.isArray(x.features) ? x.features.slice(0, 5).map((f: any) => String(f || '').slice(0, 50)) : [],
      description: typeof x.description === 'string' ? x.description.slice(0, 200) : undefined,
    }))
    .slice(0, maxCandidates)
}

/**
 * 候補の詳細情報（料金・特徴）を公式サイトから抽出
 */
async function enrichCandidatesWithDetails(
  candidates: any[],
  jobId?: string
): Promise<any[]> {
  const enriched: any[] = []
  let detailCount = 0
  const maxDetail = 50 // 最大50社まで詳細情報取得

  for (const c of candidates) {
    const url = normalizeUrlMaybe(c?.websiteUrl)
    if (!url || detailCount >= maxDetail) {
      enriched.push(c)
      continue
    }

    // 既に詳細情報があるならスキップ
    if (c.pricing || c.features) {
      enriched.push(c)
      continue
    }

    try {
      await pushResearchEvent(jobId, {
        at: Date.now(),
        kind: 'fetch',
        title: '詳細情報を取得中…',
        detail: `${c.name} (${shortHost(url)})`,
        url,
      })
      const extracted = await fetchAndExtract(url)
      if (!extracted.text || extracted.text.length < 100) {
        enriched.push(c)
        continue
      }

      // AIで料金・特徴を抽出
      const prompt = [
        'Extract service details from the following official website content.',
        '',
        `Service name: ${c.name}`,
        `URL: ${url}`,
        '',
        '=== Website content (truncated) ===',
        clampText(extracted.text, 4000),
        '',
        '=== Task ===',
        'Extract:',
        '- pricing: Price information (e.g., "月額10万円〜", "要問い合わせ", "成功報酬型")',
        '- features: Key features (max 3 items, each max 30 chars)',
        '- description: Brief description (max 100 chars)',
        '- officialUrl: Confirm/correct the official URL',
        '',
        'Output JSON only. If info not found, use "要問い合わせ" or empty.',
        'Example: {"pricing":"月額10万円〜","features":["機能A","機能B"],"description":"説明","officialUrl":"https://..."}',
      ].join('\n')

      const result = await geminiGenerateJson({
        model: GEMINI_TEXT_MODEL_DEFAULT,
        parts: [{ text: prompt }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
      })

      const enrichedCandidate = {
        ...c,
        pricing: result?.pricing || c.pricing || '要問い合わせ',
        features: Array.isArray(result?.features) ? result.features.slice(0, 5) : c.features,
        description: result?.description || c.description || c.notes,
        websiteUrl: normalizeUrlMaybe(result?.officialUrl) || c.websiteUrl,
        enriched: true,
      }
      enriched.push(enrichedCandidate)
      detailCount++

      // 取得した情報をイベントで通知
      const featuresText = Array.isArray(enrichedCandidate.features) && enrichedCandidate.features.length > 0
        ? enrichedCandidate.features.slice(0, 2).join('、')
        : ''
      await pushResearchEvent(jobId, {
        at: Date.now(),
        kind: 'success',
        title: `✅ ${c.name} の情報を取得`,
        detail: [
          enrichedCandidate.pricing ? `料金: ${enrichedCandidate.pricing}` : '',
          featuresText ? `特徴: ${featuresText}` : '',
        ].filter(Boolean).join(' / ') || '詳細情報を抽出しました',
      })
    } catch {
      enriched.push(c)
    }
  }

  return enriched
}

async function ensureComparisonCandidates(article: any, jobId?: string): Promise<any[]> {
  const isComparison = String(article?.mode || '').toLowerCase() === 'comparison_research'
  if (!isComparison) {
    await pushResearchEvent(jobId, {
      at: Date.now(),
      kind: 'warn',
      title: '比較候補の自動抽出はスキップされました',
      detail: 'mode が comparison_research ではありません。',
    })
    return []
  }

  const cfg = (article?.comparisonConfig as any) || {}
  let desired = Math.max(0, Math.min(60, Number(cfg?.count || 0)))
  const existing = Array.isArray(article?.comparisonCandidates) ? (article.comparisonCandidates as any[]) : []
  const uniqExisting = uniqCandidatesByName(existing)

  // count が未設定（0）の場合、タイトルから推定するか、デフォルト10社で進める
  if (!desired) {
    const inferred = inferComparisonCountFromTitle(article?.title, article?.keywords)
    if (inferred > 0) {
      desired = inferred
      await pushResearchEvent(jobId, {
        at: Date.now(),
        kind: 'discover',
        title: `タイトルから比較数を推定しました（${desired}社）`,
        detail: `「${String(article?.title || '').slice(0, 40)}」から自動検出`,
      })
      // DB にも反映
      try {
        const nextCfg = { ...cfg, count: desired }
        await (prisma as any).seoArticle.update({
          where: { id: article.id },
          data: { comparisonConfig: nextCfg as any },
        })
        article.comparisonConfig = nextCfg
      } catch {
        // ignore
      }
    } else {
      // タイトルからも推定できない場合はデフォルト10社で進める
      desired = 10
      await pushResearchEvent(jobId, {
        at: Date.now(),
        kind: 'warn',
        title: '比較数が未設定のためデフォルト10社で進行します',
        detail: '比較したいサービス数を明示的に設定することをお勧めします。',
      })
      try {
        const nextCfg = { ...cfg, count: desired }
        await (prisma as any).seoArticle.update({
          where: { id: article.id },
          data: { comparisonConfig: nextCfg as any },
        })
        article.comparisonConfig = nextCfg
      } catch {
        // ignore
      }
    }
  }
  if (uniqExisting.length >= desired) return uniqExisting.slice(0, desired)

  const keywords = Array.isArray(article.keywords) ? article.keywords : (article.keywords as any) || []
  const baseQuery = buildCandidateSearchSeed(article)
  if (!baseQuery) {
    await pushResearchEvent(jobId, {
      at: Date.now(),
      kind: 'error',
      title: '比較候補を自動収集できません',
      detail: '検索クエリ（キーワード/タイトル）が空です。',
    })
    return uniqExisting
  }
  if (isWeakSearchQuery(baseQuery)) {
    await pushResearchEvent(jobId, {
      at: Date.now(),
      kind: 'error',
      title: '比較候補を自動収集できません',
      detail:
        `検索クエリが曖昧すぎます: "${baseQuery}"。例: 「RPO 採用代行」「オンライン英会話」など“テーマの核”をタイトル/キーワードに入れてください。`,
    })
    return uniqExisting
  }

  // SerpAPIが無い場合でも、すでに referenceUrls（比較メディア等）が入っていればそこから抽出して進める
  // （架空サービスで埋めないため「実在ページの抽出」に限定したフォールバック）
  if (!hasSerpApiKey()) {
    await pushResearchEvent(jobId, {
      at: Date.now(),
      kind: 'warn',
      title: 'SerpAPIが未設定のため、参照URLから比較候補を抽出します',
      detail: 'SEO_SERPAPI_KEY（または SERPAPI_API_KEY）が未設定です。referenceUrls（比較メディア/公式URL）があればそこから抽出して続行します。',
    })

    const refUrls = Array.isArray(article?.referenceUrls) ? (article.referenceUrls as any[]) : []
    const normalizedRefs = refUrls
      .map((u: any) => normalizeUrlMaybe(u))
      .filter(Boolean) as string[]

    const collected: any[] = [...uniqExisting]
    const maxParse = desired >= 30 ? 10 : 5
    for (const u of normalizedRefs.slice(0, maxParse)) {
      if (uniqCandidatesByName(collected).length >= desired) break
      const services = await extractServicesFromComparisonArticle(u, baseQuery, jobId)
      for (const s of services) {
        if (s.name && !containsPlaceholderNames(s.name)) {
          collected.push({ ...s, source: 'reference_urls', sourceUrl: s.sourceUrl || u })
        }
      }
      await pushResearchEvent(jobId, {
        at: Date.now(),
        kind: 'candidates',
        title: `候補を追加（${services.length}件）`,
        detail: services.slice(0, 5).map((s) => s.name).join(' / '),
      })
    }

    let merged = uniqCandidatesByName(collected).slice(0, desired)

    // referenceUrlsからの抽出でも足りない場合、Gemini知識で補完
    if (merged.length < Math.max(3, Math.ceil(desired * 0.3))) {
      await pushResearchEvent(jobId, {
        at: Date.now(),
        kind: 'warn',
        title: '参照URLからの候補収集が不十分でした',
        detail: `${merged.length}/${desired}社しか取得できませんでした。Gemini知識から補完します。`,
      })

      try {
        const geminiCandidates = await generateCandidatesFromGeminiKnowledge({
          baseQuery,
          keywords: Array.isArray(article.keywords) ? article.keywords : [],
          title: article.title,
          existingNames: merged.map((c) => String(c?.name || '').trim()).filter(Boolean),
          maxCandidates: Math.min(60, desired - merged.length),
          jobId,
        })

        for (const gc of geminiCandidates) {
          if (gc.name && !containsPlaceholderNames(gc.name)) {
            collected.push({ ...gc, source: 'gemini_knowledge' })
          }
        }
        merged = uniqCandidatesByName(collected).slice(0, desired)

        await pushResearchEvent(jobId, {
          at: Date.now(),
          kind: 'candidates',
          title: `Gemini知識から候補を追加しました（${geminiCandidates.length}件）`,
          detail: geminiCandidates.slice(0, 5).map((c) => c.name).join(' / '),
        })
      } catch (e: any) {
        await pushResearchEvent(jobId, {
          at: Date.now(),
          kind: 'error',
          title: 'Gemini知識からの候補生成に失敗しました',
          detail: String(e?.message || e || '').slice(0, 200),
        })
      }
    }

    // 公式URLがある候補は、可能な範囲で詳細を補完（SerpAPI不要）
    await pushResearchEvent(jobId, {
      at: Date.now(),
      kind: 'fetch',
      title: '詳細情報を取得中…',
      detail: `上位${Math.min(15, merged.length)}社の料金・特徴を調査`,
    })
    merged = await enrichCandidatesWithDetails(merged, jobId)

    try {
      await (prisma as any).seoArticle.update({
        where: { id: article.id },
        data: { comparisonCandidates: merged as any },
      })
    } catch {
      // ignore
    }
    article.comparisonCandidates = merged
    await setResearchStats(jobId, { candidates: merged.length, candidatesTarget: desired })

    if (!merged.length) {
      await pushResearchEvent(jobId, {
        at: Date.now(),
        kind: 'error',
        title: '比較候補が0件でした',
        detail: '参照URL・Gemini知識の両方からサービス名を取得できませんでした。キーワードを具体化するか、候補を手動追加してください。',
      })
    }

    return merged
  }

  await pushResearchEvent(jobId, {
    at: Date.now(),
    kind: 'discover',
    title: '候補収集の検索クエリ（核）を決定しました',
    detail: baseQuery,
  })

  const region = String(cfg?.region || 'JP').toUpperCase() === 'GLOBAL' ? 'GLOBAL' : 'JP'
  const gl = region === 'JP' ? 'jp' : 'us'
  const hl = region === 'JP' ? 'ja' : 'en'

  // ========= 改善: 比較メディアをパースしてサービスを抽出 =========
  await pushResearchEvent(jobId, {
    at: Date.now(),
    kind: 'search',
    title: '比較メディアを検索中…',
    detail: `${baseQuery} 比較 おすすめ 一覧`,
  })

  const comparisonMediaUrls: string[] = []
  // テーマが「RPO/採用代行」系なら、同義語/補助語も併用して拾いやすくする
  const extraSeeds = Array.from(
    new Set(
      [
        baseQuery,
        baseQuery.includes('RPO') || baseQuery.includes('採用代行') ? 'RPO 採用代行' : '',
        baseQuery.includes('RPO') || baseQuery.includes('採用代行') ? '採用アウトソーシング' : '',
        baseQuery.includes('RPO') || baseQuery.includes('採用代行') ? '採用代行' : '',
      ].filter(Boolean)
    )
  )

  // desired が大きいほど検索のバリエーションを増やす（必要に応じて機能を調整）
  const queries = Array.from(
    new Set(
      extraSeeds.flatMap((seed) => [
        `${seed} 比較 おすすめ 一覧`,
        `${seed} サービス比較 ランキング`,
        `${seed} 比較 50社`,
        ...(desired >= 30
          ? [
              `${seed} 会社 一覧`,
              `${seed} 事業者 一覧`,
              `${seed} サービス 一覧`,
              `${seed} 提供 企業`,
              `${seed} ベンダー 一覧`,
              `${seed} 評判 口コミ 比較`,
            ]
          : []),
      ])
    )
  )

  for (const q of queries) {
    try {
      const found = await serpapiSearchGoogle({ query: q, gl, hl, num: 10 })
      for (const r of found.organic) {
        const maxMedia = desired >= 30 ? 10 : 6
        if (comparisonMediaUrls.length >= maxMedia) break
        const url = normalizeUrlMaybe(r.url)
        if (!url) continue
        // 比較メディアっぽいURLを優先
        const host = shortHost(url).toLowerCase()
        if (
          host.includes('itreview') ||
          host.includes('boxil') ||
          host.includes('comparison') ||
          host.includes('best') ||
          host.includes('recommend') ||
          host.includes('ranking') ||
          r.title?.includes('比較') ||
          r.title?.includes('おすすめ') ||
          r.title?.includes('選')
        ) {
          if (!comparisonMediaUrls.includes(url)) {
            comparisonMediaUrls.push(url)
          }
        }
      }
    } catch (e: any) {
      await pushResearchEvent(jobId, {
        at: Date.now(),
        kind: 'error',
        title: 'SerpAPI検索に失敗しました',
        detail: String(e?.message || e || '').slice(0, 240),
      })
    }
    const maxMedia = desired >= 30 ? 10 : 6
    if (comparisonMediaUrls.length >= maxMedia) break
  }

  // 比較メディアURLを引用元として保存（記事本文で「比較サイトから抽出」として出典表示できるように）
  try {
    if (comparisonMediaUrls.length) {
      const cfg2 = (article?.comparisonConfig as any) || {}
      const includeThirdParty = cfg2?.includeThirdParty !== false
      if (includeThirdParty) {
        const existingRefs = Array.isArray(article?.referenceUrls) ? (article.referenceUrls as any[]) : []
        const mergedRefs = Array.from(new Set([...existingRefs, ...comparisonMediaUrls])).slice(0, 25)
        await (prisma as any).seoArticle.update({
          where: { id: article.id },
          data: { referenceUrls: mergedRefs as any },
        })
        article.referenceUrls = mergedRefs
        await pushResearchEvent(jobId, {
          at: Date.now(),
          kind: 'discover',
          title: `比較メディアURLを引用元として保存しました（${comparisonMediaUrls.length}件）`,
          detail: comparisonMediaUrls.map((u) => shortHost(u)).filter(Boolean).slice(0, 5).join(' / '),
        })
        await setResearchStats(jobId, { referenceUrls: mergedRefs.length })
      }
    }
  } catch {
    // ignore
  }

  // 比較メディアからサービスを抽出（最大5記事をパース）
  const collected: any[] = [...uniqExisting]
  const maxParse = desired >= 30 ? 10 : 5
  for (const mediaUrl of comparisonMediaUrls.slice(0, maxParse)) {
    if (uniqCandidatesByName(collected).length >= desired) break
    const services = await extractServicesFromComparisonArticle(mediaUrl, baseQuery, jobId)
    for (const s of services) {
      if (s.name && !containsPlaceholderNames(s.name)) {
        collected.push({ ...s, source: 'comparison_media', sourceUrl: s.sourceUrl || mediaUrl })
      }
    }
    await pushResearchEvent(jobId, {
      at: Date.now(),
      kind: 'candidates',
      title: `候補を追加（${services.length}件）`,
      detail: services.slice(0, 5).map(s => s.name).join(' / '),
    })
  }

  // フォールバック: まだ足りなければ従来の検索も実行
  if (uniqCandidatesByName(collected).length < desired) {
    const fallbackQueries = Array.from(
      new Set([
        `${baseQuery} 比較`,
        `${baseQuery} おすすめ`,
        `${baseQuery} 料金`,
        `${baseQuery} 会社`,
        `${baseQuery} 事業者`,
        ...(desired >= 30 ? [`${baseQuery} サービス`, `${baseQuery} 導入 事例`, `${baseQuery} 支援 会社`] : []),
      ])
    )
    for (const q of fallbackQueries) {
      await pushResearchEvent(jobId, {
        at: Date.now(),
        kind: 'search',
        title: '追加候補を検索中…',
        detail: q,
      })
      // desired が大きいほどページングを増やす（必要に応じて検索量を調整）
      const maxStart = desired >= 40 ? 100 : desired >= 20 ? 60 : 30
      const organicPool: { title: string; url: string; snippet?: string }[] = []

      for (let start = 0; start < maxStart && uniqCandidatesByName(collected).length < desired; start += 10) {
        let found: { organic: { title: string; url: string; snippet?: string }[] } | null = null
        try {
          found = await serpapiSearchGoogle({ query: q, gl, hl, num: 10, start })
        } catch (e: any) {
          await pushResearchEvent(jobId, {
            at: Date.now(),
            kind: 'error',
            title: 'SerpAPI検索に失敗しました',
            detail: String(e?.message || e || '').slice(0, 240),
          })
          break
        }
        if (!found?.organic?.length) break
        organicPool.push(...found.organic.slice(0, 10))
        if (uniqCandidatesByName(collected).length >= desired) break
      }

      // Serp結果一覧からAIでサービス名を抽出（タイトルパースだけに頼らない）
      try {
        const extracted = await extractCandidatesFromSerpOrganic({
          baseQuery,
          organic: organicPool,
          maxCandidates: Math.min(80, Math.max(20, desired * 2)),
          jobId,
        })
        for (const x of extracted) {
          if (x.name && !containsPlaceholderNames(x.name)) {
            collected.push({ name: x.name, websiteUrl: x.websiteUrl, notes: x.notes, source: 'serpapi_ai' })
          }
        }
      } catch {
        // ignore
      }

      if (uniqCandidatesByName(collected).length >= desired) break
    }
  }

  let merged = uniqCandidatesByName(collected).slice(0, desired)

  // ========= 最終フォールバック: 検索結果から候補が得られなかった場合はGemini知識から生成 =========
  if (merged.length < Math.max(3, Math.ceil(desired * 0.3))) {
    await pushResearchEvent(jobId, {
      at: Date.now(),
      kind: 'warn',
      title: '検索からの候補収集が不十分でした',
      detail: `${merged.length}/${desired}社しか取得できませんでした。Gemini知識から補完します。`,
    })

    try {
      const geminiCandidates = await generateCandidatesFromGeminiKnowledge({
        baseQuery,
        keywords: Array.isArray(article.keywords) ? article.keywords : [],
        title: article.title,
        existingNames: merged.map((c) => String(c?.name || '').trim()).filter(Boolean),
        maxCandidates: Math.min(60, desired - merged.length),
        jobId,
      })

      for (const gc of geminiCandidates) {
        if (gc.name && !containsPlaceholderNames(gc.name)) {
          collected.push({ ...gc, source: 'gemini_knowledge' })
        }
      }
      merged = uniqCandidatesByName(collected).slice(0, desired)

      await pushResearchEvent(jobId, {
        at: Date.now(),
        kind: 'candidates',
        title: `Gemini知識から候補を追加しました（${geminiCandidates.length}件）`,
        detail: geminiCandidates.slice(0, 5).map((c) => c.name).join(' / '),
      })
    } catch (e: any) {
      await pushResearchEvent(jobId, {
        at: Date.now(),
        kind: 'error',
        title: 'Gemini知識からの候補生成に失敗しました',
        detail: String(e?.message || e || '').slice(0, 200),
      })
    }
  }

  if (!merged.length) {
    await pushResearchEvent(jobId, {
      at: Date.now(),
      kind: 'error',
      title: '比較候補が0件でした',
      detail:
        '検索結果・Gemini知識の両方からサービス名を取得できませんでした。キーワードを具体化するか、候補を手動追加してください。',
    })
  }

  // ========= 改善: 公式URLが不足している候補を補完 =========
  await pushResearchEvent(jobId, {
    at: Date.now(),
    kind: 'search',
    title: '公式URLを補完中…',
    detail: `${merged.length}社の公式サイトを確認`,
  })
  merged = await enrichCandidatesWithOfficialUrls(merged, gl, hl, jobId)

  // ========= 改善: 各候補の詳細情報（料金・特徴）を取得 =========
  await pushResearchEvent(jobId, {
    at: Date.now(),
    kind: 'fetch',
    title: '詳細情報を取得中…',
    detail: `上位${Math.min(15, merged.length)}社の料金・特徴を調査`,
  })
  merged = await enrichCandidatesWithDetails(merged, jobId)

  // 詳細情報（料金・特徴）が取得できた件数をカウント
  const enrichedCount = merged.filter((c) => c?.enriched || c?.pricing).length
  const withUrlCount = merged.filter((c) => c?.websiteUrl).length
  await pushResearchEvent(jobId, {
    at: Date.now(),
    kind: 'candidates',
    title: `🎯 候補を確定（${merged.length}/${desired}社）`,
    detail: [
      `料金情報: ${enrichedCount}社`,
      `公式URL: ${withUrlCount}社`,
      merged.slice(0, 5).map((c) => String(c?.name || '').trim()).filter(Boolean).join('、'),
    ].join(' / '),
  })
  await setResearchStats(jobId, { candidates: merged.length, candidatesTarget: desired })

  // 呼び出し元は article を参照し続けるので、DB更新 + ローカルも同期しておく
  try {
    await (prisma as any).seoArticle.update({
      where: { id: article.id },
      data: { comparisonCandidates: merged as any },
    })
  } catch {
    // ignore
  }
  article.comparisonCandidates = merged
  return merged
}

function llmoOptionsText(article: any): string {
  const o = (article.llmoOptions as any) || {}
  const on = (k: string, label: string) => (o?.[k] === false ? `OFF: ${label}` : `ON: ${label}`)
  return [
    on('tldr', 'TL;DR'),
    on('conclusionFirst', '結論ファースト＋根拠'),
    on('faq', 'FAQ'),
    on('glossary', '用語集'),
    on('comparison', '比較表'),
    on('quotes', '引用・根拠（言い換え）'),
    on('templates', '実務テンプレ（手順/チェックリスト/例文）'),
    on('objections', '反論に答える'),
  ].join('\n')
}

function parseOutlineFromMarkdown(md: string, targetChars: number): SeoOutline {
  const lines = String(md || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const sections: SeoOutline['sections'] = []
  let current: SeoOutline['sections'][number] | null = null
  let currentH3: string | null = null

  const cleanHeading = (s: string) =>
    s
      .replace(/^#+\s*/, '')
      .replace(/^\d+\.\s*/, '')
      .trim()

  for (const raw of lines) {
    if (raw.startsWith('#### ')) {
      const h4 = cleanHeading(raw)
      if (current && currentH3 && h4) {
        const arr = current.h4[currentH3] || []
        if (!arr.includes(h4)) current.h4[currentH3] = [...arr, h4]
      }
      continue
    }
    if (raw.startsWith('### ')) {
      const h3 = cleanHeading(raw)
      if (current && h3) {
        if (!current.h3.includes(h3)) current.h3.push(h3)
        currentH3 = h3
        if (!current.h4[currentH3]) current.h4[currentH3] = []
      }
      continue
    }
    if (raw.startsWith('## ') && !raw.startsWith('###')) {
      const h2raw = cleanHeading(raw)
      if (!h2raw) continue
      // 例: "xxx（意図: 比較）" を intentTag に分離
      const m = h2raw.match(/^(.*?)(?:（意図:\s*([^）]+)）)?$/)
      const h2 = (m?.[1] || h2raw).trim()
      const intentTag = (m?.[2] || '').trim()
      current = { h2, intentTag, plannedChars: 2200, h3: [], h4: {} }
      currentH3 = null
      sections.push(current)
      continue
    }
    // 先頭の "# タイトル" は無視
  }

  const minSections = computeMinSections(targetChars)
  const baseCount = Math.max(minSections, sections.length || 0)
  // 目標文字数に応じた1セクションあたりの文字数（小さい記事にも対応）
  const per = Math.max(600, Math.min(3500, Math.round(Math.max(3000, targetChars) / Math.max(1, baseCount))))
  for (const s of sections) s.plannedChars = per

  const outline: SeoOutline = {
    sections: sections.length ? sections : [{ h2: '概要', intentTag: '定義', plannedChars: per, h3: [], h4: {} }],
    internalLinkIdeas: [],
    faq: [],
    glossary: [],
    diagramIdeas: [],
  }
  return ensureMinSections(outline, targetChars)
}

async function generateOutline(article: any, researchContext: string): Promise<SeoOutline> {
  const forbidden = Array.isArray(article.forbidden) ? article.forbidden : (article.forbidden as any) || []
  const keywords = Array.isArray(article.keywords) ? article.keywords : (article.keywords as any) || []
  const minSections = computeMinSections(Number(article.targetChars || 10000))
  const userKnowledge = await buildUserKnowledgeContext(article.userId)
  const requestText = article.requestText ? clampText(String(article.requestText || ''), 1800) : ''

  const isComparison = String(article.mode || '').toLowerCase() === 'comparison_research'
  const comparisonConfig = (article.comparisonConfig as any) || null
  const desiredCompanies = Math.max(0, Math.min(60, Number(comparisonConfig?.count || 0)))
  const comparisonCandidates = Array.isArray(article.comparisonCandidates) ? (article.comparisonCandidates as any[]) : []
  const referenceInputs = Array.isArray(article.referenceInputs) ? (article.referenceInputs as any[]) : []
  const coverageNote = comparisonCoverageNote(article)

  const comparisonBlock = isComparison
    ? [
        'Comparison article mode: ENABLED (research-based / factual).',
        'CRITICAL FACTUALITY RULES (絶対):',
        '- 架空のサービス名・架空の機能・架空の料金は絶対に書かない',
        '- 必ず「実在するサービス」のみを扱う（候補リスト外の追加は禁止）',
        '- 公式サイト・一次情報を前提に調査した内容のみを記載する',
        '- 不明な情報は推測しない（「公式に明記なし」「要問い合わせ」「非公開」と明示）',
        '',
        'Required structure (must appear in outline):',
        '- 導入（比較が必要な理由/失敗例）',
        `- 比較対象サービス一覧（表：サービス名/特徴/料金/向いている人/公式URL）※候補が不足する場合は不足注記を入れ、調査できた範囲（M社）で比較する`,
        '- 各サービス詳細（できること/できないこと/料金/メリデメ/おすすめシーン）',
        `- サービス比較表（横並び：機能/価格帯/特徴/サポートなど）※候補が不足する場合は不足注記を入れ、調査できた範囲（M社）で比較する`,
        '- タイプ別おすすめ（初心者/コスト/高機能/中小/大企業）',
        '- まとめ（選び方/チェックポイント/結論）',
        '',
        `Template type: ${String(comparisonConfig?.template || '')}`,
        `Target companies: ${String(comparisonConfig?.count || '')}`,
        `Region: ${String(comparisonConfig?.region || '')}`,
        comparisonConfig?.exclude?.length ? `Exclude rules: ${(comparisonConfig.exclude as any[]).join(' / ')}` : '',
        comparisonConfig?.tags?.length ? `Priority tags: ${(comparisonConfig.tags as any[]).join(' / ')}` : '',
        `Require official site: ${comparisonConfig?.requireOfficial ? 'YES' : 'NO'}`,
        `Include third-party: ${comparisonConfig?.includeThirdParty ? 'YES' : 'NO'}`,
        '',
        coverageNote ? `Coverage notice (must include in the final article): ${coverageNote}` : '',
        '',
        comparisonCandidates.length
          ? [
              'Final candidate list with details (do not invent new companies beyond this list):',
              '(Use these details for comparison tables and individual explanations)',
              '',
              ...comparisonCandidates.slice(0, desiredCompanies ? Math.min(desiredCompanies, 60) : 60).map((c, i) => {
                const name = String(c?.name || '').trim()
                const u = typeof c?.websiteUrl === 'string' ? c.websiteUrl : ''
                const pricing = c?.pricing ? `料金: ${c.pricing}` : ''
                const features = Array.isArray(c?.features) && c.features.length ? `特徴: ${c.features.join('、')}` : ''
                const desc = c?.description || c?.notes || ''
                const details = [pricing, features, desc].filter(Boolean).join(' / ')
                return `${i + 1}. ${name}${u ? ` (${u})` : ''}${details ? `\n   → ${details}` : ''}`
              }),
            ].join('\n')
          : 'Final candidate list: (empty) — outline should still include a "候補の確定方法" section.',
        '',
        (() => {
          const axes = referenceInputs
            .flatMap((x) => (Array.isArray(x?.template?.axes) ? x.template.axes : []))
            .map((s: any) => String(s || '').trim())
            .filter(Boolean)
          const uniq = Array.from(new Set(axes)).slice(0, 20)
          return uniq.length ? `Extracted axes from references: ${uniq.join(' / ')}` : ''
        })(),
      ]
        .filter(Boolean)
        .join('\n')
    : ''

  // アウトラインを確実に完結させるため、シンプルなスキーマで生成
  // h4は省略可にしてJSON長を削減（後で個別セクション生成時に詳細化できる）
  const prompt = [
    'You are a Japanese SEO + LLMO expert editor.',
    'Goal: produce a COMPLETE, parseable JSON outline for a long-form article.',
    'Do NOT copy text from sources. Only paraphrase insights.',
    '',
    'CRITICAL: Output COMPLETE JSON. Do not truncate.',
    'Output JSON with keys: sections, faq, glossary (all simple arrays).',
    '',
    'Article requirements (Japanese):',
    `- Title: ${article.title}`,
    `- Keywords: ${(keywords as string[]).join(', ')}`,
    article.persona ? `- Persona: ${clampText(article.persona, 800)}` : '',
    article.searchIntent ? `- Search intent: ${clampText(article.searchIntent, 800)}` : '',
    `- Target chars: ${article.targetChars}`,
    `- Tone: ${article.tone}`,
    forbidden.length ? `- Forbidden: ${(forbidden as string[]).join(' / ')}` : '',
    '',
    'LLMO elements toggles:',
    llmoOptionsText(article),
    '',
    researchContext
      ? [
          'RESEARCH USAGE (must follow):',
          '- The article MUST reflect the research below (最新情報/具体例/実例/根拠).',
          '- Ensure the outline includes at least ONE section tagged "最新動向" and at least ONE section tagged "事例" when research exists.',
          '- If the title implies a list/comparison ("おすすめ◯◯選/比較◯◯社/TOP◯◯"), ensure the outline contains sections that produce full tables (no samples).',
          '- Never add fabricated "YYYY年MM月時点" statements unless explicitly present in research or user-provided requestText.',
          '',
        ].join('\n')
      : '',
    researchContext ? clampText(researchContext, 4000) : '',
    comparisonBlock ? `\n=== COMPARISON BRIEF ===\n${clampText(comparisonBlock, 5000)}\n` : '',
    '',
    'Constraints:',
    `- sections: exactly ${minSections} items (H2).`,
    '- Each section: {h2: string, intentTag: string, plannedChars: number (1800-3200), h3: string[], h4: {}}',
    '- Keep h4 empty ({}) to reduce JSON size. Details will be generated per section.',
    '- intentTag: 定義/比較/手順/事例/注意点/FAQ/用語 etc.',
    '- faq: array of 5-10 question strings.',
    '- glossary: array of 5-10 term strings.',
    '',
    'JSON schema (EXACTLY this format):',
    '{"sections":[{"h2":"見出し","intentTag":"定義","plannedChars":2000,"h3":["小見出し1"],"h4":{}}],"faq":["質問1","質問2"],"glossary":["用語1","用語2"]}',
  ]
    .filter(Boolean)
    .join('\n')

  const raw = await geminiGenerateJson<SeoOutline>(
    {
      model: GEMINI_TEXT_MODEL_DEFAULT,
      prompt,
      // 長いアウトラインでも途切れないよう十分なトークン数を確保
      generationConfig: { temperature: 0.3, maxOutputTokens: 32000 },
    },
    'JSON'
  ).catch(async () => {
    // フォールバック: JSONが壊れても止めない（Markdownアウトラインで生成→こちらで解析）
    const mdPrompt = [
      'You are a Japanese SEO editor.',
      'Output ONLY a Markdown outline (no JSON).',
      'Use headings strictly:',
      '- H2: "## ...（意図: xxx）"',
      '- H3: "### ..."',
      '- H4: "#### ..."',
      `Create ${minSections}-28 H2 sections suitable for a ${article.targetChars} char article.`,
      'Do NOT copy from sources.',
      '',
      `Title: ${article.title}`,
      `Keywords: ${(keywords as string[]).join(', ')}`,
      article.persona ? `Persona: ${clampText(article.persona, 1200)}` : '',
      article.searchIntent ? `Search intent: ${clampText(article.searchIntent, 1200)}` : '',
      `Tone: ${article.tone}`,
      forbidden.length ? `Forbidden: ${(forbidden as string[]).join(' / ')}` : '',
      requestText
        ? `\n【一次情報（最優先で反映）】\n以下はユーザーが提供した固有情報です。必ず本文に具体的に反映してください。\n- ここに無い事実（数字/体験/実績/断定）は作らない\n- 具体例・結論・比較の根拠は可能な限りこの一次情報に基づける\n- 文章の“芯”として扱い、薄い一般論で上書きしない\n\n${requestText}\n`
        : '',
      '',
      userKnowledge,
      researchContext,
    ]
      .filter(Boolean)
      .join('\n')

    const md = await geminiGenerateText({
      model: GEMINI_TEXT_MODEL_DEFAULT,
      parts: [{ text: mdPrompt }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4500 },
    })
    return parseOutlineFromMarkdown(md, Number(article.targetChars || 10000))
  })

  // Gemini出力が揺れて faq/glossary が object[] になることがあるため、ここで必ず正規化してからparseする
  const normalized = {
    ...(raw as any),
    internalLinkIdeas: normalizeStringArray((raw as any)?.internalLinkIdeas),
    faq: normalizeStringArray((raw as any)?.faq),
    glossary: normalizeStringArray((raw as any)?.glossary),
  }
  const parsed = SeoOutlineSchema.parse(normalized)
  return ensureMinSections(parsed, Number(article.targetChars || 10000))
}

async function ensureOutlineAndSections(jobId: string) {
  const p = prisma as any
  const job = await p.seoJob.findUnique({
    where: { id: jobId },
    include: { article: true },
  })
  if (!job) throw new Error('job not found')
  const article = job.article

  // すでにアウトラインがあっても、セクションが未作成なら先に作る（/seo/create のプレビュー→編集フロー用）
  const hasSections = await p.seoSection.findFirst({ where: { jobId }, select: { id: true } })
  if (article.outline && hasSections) return

  // 「おすすめ50選」等のタイトルから、比較調査モードを自動適用（standardでサンプル数社になりやすいのを防ぐ）
  await maybeAutoEnableComparisonResearchMode(article, jobId)

  const isComparison = String(article.mode || '').toLowerCase() === 'comparison_research'

  // 比較記事: 候補数が指定より不足していたら、SerpAPIで補完（キーがある場合）
  if (isComparison) {
    await p.seoJob.update({
      where: { id: jobId },
      data: { step: 'cmp_candidates', progress: Math.max(5, Number(job.progress || 0)), status: 'running' },
    })
    const ensured = await ensureComparisonCandidates(article, jobId)
    const cfg = (article?.comparisonConfig as any) || {}
    const desired = Math.max(0, Math.min(60, Number(cfg?.count || 0)))
    // 「おすすめ50選」等、比較数が明示されている場合は “候補0件で比較記事を完成させない”
    if (desired > 0 && ensured.length === 0) {
      await pushResearchEvent(jobId, {
        at: Date.now(),
        kind: 'error',
        title: '比較候補が0件のため、比較記事を生成できません',
        detail:
          'SerpAPI検索/抽出に失敗しました。SEO_SERPAPI_KEYの有効性、検索クエリ（キーワード/タイトル）、または候補の手動追加を確認してください。',
      })
      throw new Error('比較候補が0件のため、比較記事を生成できません（候補収集に失敗）')
    }
    // 不足しても止めない（記事内に不足注記を明示して進行する）
    article.comparisonCandidates = ensured
  }

  // 比較記事は「実在サービスのみ」を担保するため、公式URLがある場合は軽量に自動リサーチ（最大2件）
  // ※ サーバレスのタイムアウトに配慮しつつ、最低限の一次情報を渡して架空要素を抑止する
  try {
    await p.seoJob.update({
      where: { id: jobId },
      data: { step: isComparison ? 'cmp_crawl' : job.step, progress: Math.max(8, Number(job.progress || 0)), status: 'running' },
    })
    await maybeAutoResearchComparison(article, jobId)
  } catch {
    // ignore
  }

  // 比較記事: 第三者情報（比較メディア等）も参考URLに追加（includeThirdPartyがONの場合）
  try {
    await p.seoJob.update({
      where: { id: jobId },
      data: { step: isComparison ? 'cmp_sources' : job.step, progress: Math.max(10, Number(job.progress || 0)), status: 'running' },
    })
    await maybeDiscoverComparisonThirdPartyUrls(article, jobId)
  } catch {
    // ignore
  }

  // 全記事: 参照URLが未入力なら、SerpAPIで参考URLを自動収集（キーがある場合のみ）
  // → 最新情報・事例・ハウツー・料金など多角的に収集
  try {
    await maybeDiscoverReferenceUrls(article, jobId)
  } catch {
    // ignore
  }

  await p.seoJob.update({
    where: { id: jobId },
    data: { status: 'running', step: isComparison ? 'cmp_outline' : 'outline', startedAt: job.startedAt ?? new Date() },
  })
  await p.seoArticle.update({ where: { id: article.id }, data: { status: 'RUNNING' } })

  // 全記事: 参考URLがある場合は、1回のadvanceで最大1件だけ解析してseoReferenceへ保存（タイムアウト対策）
  try {
    await p.seoJob.update({
      where: { id: jobId },
      data: { step: isComparison ? 'cmp_extract' : job.step, progress: Math.max(12, Number(job.progress || 0)), status: 'running' },
    })
    await progressiveResearchFromReferenceUrls(article, { maxUrls: 1, jobId })
  } catch {
    // ignore（ネットワーク不調でも本文生成は継続）
  }

  // 目標文字数（最低3000字）
  const target = Math.max(3000, Number(article.targetChars || 10000))
  let outline: SeoOutline
  let outlineMd: string

  if (article.outline) {
    outlineMd = String(article.outline || '')
    outline = ensureMinSections(parseOutlineFromMarkdown(outlineMd, target), target)
  } else {
    const researchContext = await buildResearchContext(article.id)
    outline = await generateOutline(article, researchContext)
    outlineMd = toOutlineMarkdown(outline)
    await p.seoArticle.update({ where: { id: article.id }, data: { outline: outlineMd } })
  }

  // sections作成
  const plannedTotal = outline.sections.reduce((a, s) => a + (s.plannedChars || 2000), 0)
  const ratio = target / Math.max(1, plannedTotal)

  const createData = outline.sections.map((s, i) => ({
    articleId: article.id,
    jobId: jobId,
    index: i,
    headingPath: `H2: ${s.h2}${s.intentTag ? ` [${s.intentTag}]` : ''}`,
    plannedChars: Math.max(1800, Math.min(3500, Math.round((s.plannedChars || 2200) * ratio))),
    status: 'pending',
  }))

  await p.seoSection.createMany({ data: createData, skipDuplicates: true })

  // 差別化①: 導入文A/B案（ペルソナ別）
  const abPrompt = [
    'You are a Japanese copywriter for SEO intros.',
    'Create two different intro drafts (A/B) for the article.',
    'A: logical and business-like. B: friendly and story-driven.',
    'Each 250-400 Japanese chars. No exaggeration. Avoid generic AI tone.',
    NO_AI_MARKDOWN_RULES,
    '',
    `Title: ${article.title}`,
    `Keywords: ${((article.keywords as any) || []).join(', ')}`,
    article.persona ? `Persona: ${clampText(article.persona, 800)}` : '',
    article.searchIntent ? `Intent: ${clampText(article.searchIntent, 800)}` : '',
    '',
    'Output format (Japanese):',
    'A: ...',
    'B: ...',
  ]
    .filter(Boolean)
    .join('\n')

  let abText = ''
  try {
    abText = await geminiGenerateText({
      model: GEMINI_TEXT_MODEL_DEFAULT,
      parts: [{ text: abPrompt }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 1000 },
    })
  } catch {
    abText = 'A: （生成に失敗しました）\nB: （生成に失敗しました）'
  }
  abText = sanitizeAiMarkdown(abText)
  await p.seoKnowledgeItem.create({
    data: {
      userId: article.userId,
      articleId: article.id,
      type: 'intro_ab',
      title: '導入文案A/B',
      content: abText,
      sourceUrls: article.referenceUrls as any,
    },
  })
}

async function generateSection(jobId: string) {
  const p = prisma as any
  const job = await p.seoJob.findUnique({
    where: { id: jobId },
    include: { article: true, sections: { orderBy: { index: 'asc' } } },
  })
  if (!job) throw new Error('job not found')

  const article = job.article
  const sections = job.sections
  const next = sections.find((s: any) => s.status !== 'reviewed')
  if (!next) return

  const isComparisonEarly = String(article.mode || '').toLowerCase() === 'comparison_research'

  // 比較記事は「実在サービスのみ」を担保するため、公式URLがある場合は軽量に自動リサーチ（最大2件）
  try {
    await p.seoJob.update({
      where: { id: jobId },
      data: { step: isComparisonEarly ? 'cmp_crawl' : job.step, progress: Math.max(15, Number(job.progress || 0)), status: 'running' },
    })
    await maybeAutoResearchComparison(article, jobId)
  } catch {
    // ignore
  }

  // 全記事: 参考URLがある場合は、1回のadvanceで最大1件だけ解析してseoReferenceへ保存（タイムアウト対策）
  try {
    await p.seoJob.update({
      where: { id: jobId },
      data: { step: isComparisonEarly ? 'cmp_extract' : job.step, progress: Math.max(18, Number(job.progress || 0)), status: 'running' },
    })
    await progressiveResearchFromReferenceUrls(article, { maxUrls: 1, jobId })
  } catch {
    // ignore
  }

  const prevSections = sections
    .filter((s: any) => s.index < next.index && s.content)
    .slice(-2)
    .map((s: any) => `# Prev section ${s.index}\n${clampText(s.content || '', 2200)}`)
    .join('\n\n')

  const outline = article.outline || ''
  const researchContext = await buildResearchContext(article.id)
  const forbidden = Array.isArray(article.forbidden) ? article.forbidden : (article.forbidden as any) || []
  const userKnowledge = await buildUserKnowledgeContext(article.userId)
  const requestText = article.requestText ? clampText(String(article.requestText || ''), 1800) : ''
  const targetChars = Math.max(3000, Number(article.targetChars || 10000))
  const isComparison = String(article.mode || '').toLowerCase() === 'comparison_research'
  const comparisonConfig = (article.comparisonConfig as any) || null
  const desiredCompanies = Math.max(0, Math.min(60, Number(comparisonConfig?.count || 0)))
  let comparisonCandidates = Array.isArray(article.comparisonCandidates) ? (article.comparisonCandidates as any[]) : []
  const coverageNote = comparisonCoverageNote(article)

  // 比較記事: セクション生成前にも候補補完を試す（ジョブが途中から再開されても揃うように）
  if (isComparison) {
    await p.seoJob.update({
      where: { id: jobId },
      data: { step: 'cmp_candidates', progress: Math.max(20, Number(job.progress || 0)), status: 'running' },
    })
    const ensured = await ensureComparisonCandidates(article, jobId)
    comparisonCandidates = ensured
  }

  const comparisonStrictPrompt = isComparison
    ? [
        'あなたはSEOに強い「リサーチ特化型のプロ編集者・比較記事専門ライター」です。',
        'これから【実在するサービス同士を比較する記事】を作成してください。',
        '',
        '━━━━━━━━━━━━━━━━━━',
        '■ 絶対ルール（最重要）',
        '━━━━━━━━━━━━━━━━━━',
        '・架空のサービス名・架空の機能・架空の料金は【絶対に使用しない】',
        '・必ず「実在するサービス」のみを扱うこと（候補リスト外の追加は禁止）',
        '・公式サイト・一次情報を前提に調査した内容のみを記載すること',
        '・比較サイト（第三者メディア）から抽出した情報を使う場合は、必ず「比較メディアより抽出」と明記し、出典URLを併記すること',
        '・不明な情報は推測せず、「公式に明記なし」「要問い合わせ」「非公開」と明示すること',
        '・「サンプルとして数社のみ記載」「実際には〜社分を記載します」等の逃げ表現は禁止（必ず候補リストの件数分を出す）',
        '',
        '━━━━━━━━━━━━━━━━━━',
        '■ 比較対象サービス（このリストのみ使用）',
        '━━━━━━━━━━━━━━━━━━',
        coverageNote ? `\n${coverageNote}\n` : '',
        comparisonCandidates.length
          ? comparisonCandidates
              .slice(0, desiredCompanies ? Math.min(desiredCompanies, 60) : 60)
              .map((c, i) => {
                const name = String(c?.name || '').trim()
                const url = normalizeUrlMaybe(c?.websiteUrl)
                const src = normalizeUrlMaybe((c as any)?.sourceUrl)
                const pricing = c?.pricing ? `料金: ${c.pricing}` : ''
                const features = Array.isArray(c?.features) && c.features.length ? `特徴: ${c.features.join('、')}` : ''
                const desc = c?.description || c?.notes || ''
                const details = [pricing, features].filter(Boolean).join(' / ')
                return [
                  `${i + 1}. ${name}${url ? `（公式URL: ${url}）` : '（公式URL: 未設定）'}`,
                  src ? `   → 比較メディア抽出元（出典）: ${src}` : '',
                  details ? `   → ${details}` : '',
                  desc ? `   → 概要: ${desc.slice(0, 80)}` : '',
                ].filter(Boolean).join('\n')
              })
              .join('\n')
          : '（候補が未設定のため、架空のサービスを出さず「候補の集め方」と「比較軸」中心で構成すること）',
        '',
        '━━━━━━━━━━━━━━━━━━',
        '■ 比較対象ジャンル（参考）',
        '━━━━━━━━━━━━━━━━━━',
        `- ジャンル: ${String(comparisonConfig?.template || '') || '（未指定）'}`,
        Array.isArray(comparisonConfig?.tags) && comparisonConfig.tags.length
          ? `- 優先タグ: ${comparisonConfig.tags.join(' / ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : ''

  const prompt = [
    'You are a Japanese SEO + LLMO expert writer.',
    'Write ONE section only in Japanese. Markdown output.',
    'Do NOT copy from sources; paraphrase ideas and add originality (experience, tradeoffs, examples, failure cases).',
    'Avoid generic filler. Be specific and practical.',
    NO_AI_MARKDOWN_RULES,
    '',
    `Article title: ${article.title}`,
    `Tone: ${article.tone}`,
    comparisonStrictPrompt ? `\n=== 比較記事（実在サービスのみ）ブリーフ ===\n${clampText(comparisonStrictPrompt, 6000)}\n` : '',
    forbidden.length ? `Forbidden: ${(forbidden as string[]).join(' / ')}` : '',
    requestText
      ? `\n【一次情報（最優先で反映）】\n以下はユーザーが提供した固有情報です。必ず本文に具体的に反映してください。\n- ここに無い事実（数字/体験/実績/断定）は作らない\n- 具体例・結論・比較の根拠は可能な限りこの一次情報に基づける\n- 文章の“芯”として扱い、薄い一般論で上書きしない\n\n${requestText}\n`
      : '',
    '',
    userKnowledge,
    'Outline (for consistency):',
    clampText(outline, 2500),
    '',
    prevSections ? `Recent context:\n${prevSections}` : '',
    '',
    `Write section index ${next.index} with plannedChars ~${next.plannedChars}.`,
    `Section headingPath: ${next.headingPath || ''}`,
    '',
    'Rules:',
    '- Start with "## " heading (H2) that matches the outline.',
    '- Use H3/H4 as needed.',
    '- If you include a checklist, use numbered lists or normal bullet lists (NO checkboxes).',
    researchContext
      ? [
          '- RESEARCH is available at the end of this prompt. You MUST reflect it in this section.',
          '- When you use a concrete fact/number/example from RESEARCH, add an in-text source like: （出典: https://example.com/） right after the sentence.',
          '- Include at least 2 cited concrete points in this section if RESEARCH exists (more is better).',
          '- Do NOT write placeholder strings like "（他サービス名）", "URL未定", "調査中". If unknown, write "公式に明記なし/要問い合わせ/非公開".',
          '- Do NOT claim "YYYY年MM月時点" unless that exact date exists in RESEARCH or requestText.',
        ].join('\n')
      : '',
    isComparison
      ? [
          '- Comparison mode: NEVER invent services/features/prices.',
          '- When writing about a service: include official URL (if known) and clearly label unknown fields as "公式に明記なし/要問い合わせ/非公開".',
          '- Prefer facts from RESEARCH blocks (official sources). If not present, do not assert.',
          (() => {
            const h = String(next.headingPath || '')
            const mustCoverAll =
              /比較対象|サービス一覧|比較表|ランキング|おすすめ|料金比較|機能比較|タイプ別おすすめ/.test(h)
            const desired = desiredCompanies
            const actual = uniqCandidatesByName(comparisonCandidates).length
            if (!mustCoverAll) return ''
            return [
              desired
                ? `- IMPORTANT: This section MUST cover ALL available companies (${actual}社). (original target: ${desired}社)`
                : `- IMPORTANT: This section MUST cover ALL available companies (${actual}社).`,
              '- Include at least ONE markdown table that contains ALL available companies.',
              '- Do NOT label tables as "例" or write disclaimers like "上記の表はあくまで例です". Output the real table.',
              '- If the table becomes too wide, split into multiple tables, but still include all companies across them.',
              '- For unknown fields, write "公式に明記なし/要問い合わせ/非公開" instead of guessing.',
            ].join('\n')
          })(),
        ].join('\n')
      : '',
    targetChars <= 6500
      ? '- For short articles: proactively use markdown tables when it improves scanability (comparison, criteria, checklist, summary). Include at least ONE markdown table in this section if it naturally fits the heading.'
      : '',
    '- Include concrete steps / decision criteria / examples where appropriate.',
    '- Avoid repeating earlier sections.',
    '',
    researchContext,
  ]
    .filter(Boolean)
    .join('\n')

  const raw = await geminiGenerateText({
    model: GEMINI_TEXT_MODEL_DEFAULT,
    parts: [{ text: prompt }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 6000 },
  })

  // 整合性チェック（簡易）
  const checkPrompt = [
    'You are a Japanese editor. Check the section for:',
    '- contradictions with outline/context',
    '- redundancy with previous sections',
    '- missing details vs the heading',
    'Then rewrite the section to fix issues.',
    'Output STRICT JSON only.',
    NO_AI_MARKDOWN_RULES,
    '',
    'JSON schema:',
    '{ "issues": ["..."], "rewritten": "markdown" }',
    '',
    'Outline:',
    clampText(outline, 2200),
    '',
    prevSections ? `Recent context:\n${prevSections}` : '',
    '',
    'Section draft:',
    clampText(raw, 6000),
  ]
    .filter(Boolean)
    .join('\n')

  let issues: string[] = []
  let rewritten = raw
  try {
    const out = await geminiGenerateJson<{ issues: string[]; rewritten: string }>(
      {
        model: GEMINI_TEXT_MODEL_DEFAULT,
        prompt: checkPrompt,
        generationConfig: { temperature: 0.3, maxOutputTokens: 6500 },
      },
      'JSON'
    )
    issues = Array.isArray(out.issues) ? out.issues : []
    rewritten = typeof out.rewritten === 'string' && out.rewritten.trim() ? out.rewritten : raw
  } catch {
    // ignore
  }
  rewritten = sanitizeAiMarkdown(rewritten)

  // 文字数が明らかに不足する場合は、1回だけ追記で増量（50,000字達成のため）
  try {
    const currentLen = mdCharCount(rewritten)
    const goal = Math.max(1200, Number(next.plannedChars || 2200))
    if (currentLen < goal * 0.75) {
      const expandPrompt = [
        'You are a Japanese SEO writer.',
        'Expand the following section while keeping structure and tone.',
        'Do NOT repeat the same sentences. Add concrete examples, checklists, pitfalls, and decision criteria.',
        'Keep it consistent with the heading and outline.',
        'Return Markdown only.',
        NO_AI_MARKDOWN_RULES,
        '',
        `Target additional chars: ~${Math.max(600, Math.round(goal - currentLen))}`,
        '',
        'Section (current):',
        clampText(rewritten, 9000),
      ].join('\n')
      const expanded = await geminiGenerateText({
        model: GEMINI_TEXT_MODEL_DEFAULT,
        parts: [{ text: expandPrompt }],
        generationConfig: { temperature: 0.55, maxOutputTokens: 6500 },
      })
      rewritten = expanded && expanded.trim() ? sanitizeAiMarkdown(expanded) : rewritten
    }
  } catch {
    // ignore
  }

  await p.seoSection.update({
    where: { id: next.id },
    data: {
      prompt,
      content: normalizeH2Heading(rewritten, next.headingPath || `section_${next.index}`),
      consistency: issues.length ? `ISSUES:\n- ${issues.join('\n- ')}` : null,
      status: 'reviewed',
    },
  })

  const doneCount = sections.filter((s: any) => s.status === 'reviewed').length + 1
  const total = sections.length
  const progress = Math.min(75, Math.round((doneCount / Math.max(1, total)) * 70) + 15)

  await p.seoJob.update({
    where: { id: jobId },
    data: { cursor: next.index + 1, step: 'sections', status: 'running', progress },
  })
}

async function autoGenerateBanner(args: { article: any; finalMarkdown?: string }) {
  const article = args.article
  await ensureSeoStorage()

  const title = String(article.title || '').trim()
  
  // 記事本文を整形（マークダウンから不要要素を除去）
  const articleText = String(args.finalMarkdown || article.outline || '')
    .replace(/!\[[^\]]*?\]\([^)]+\)/g, '') // 画像を除去
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // リンクをテキストに変換
    .replace(/`{3}[\s\S]*?`{3}/g, '') // コードブロックを除去
    .replace(/^#{1,6}\s+/gm, '') // 見出し記号を除去
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 5000)

  // ジャンルを推定
  const genre = guessArticleGenreJa([title, articleText].join(' '))

  // 新しいプロンプトでバナー生成
  const prompt = buildArticleBannerPrompt({
    title,
    articleText,
    bannerSize: '1200x628（16:9、SNS/広告向け）',
    genre,
  })

  // Geminiで画像生成
  const result = await geminiGenerateImagePng({
    prompt,
    aspectRatio: '16:9',
    imageSize: '2K',
    model: GEMINI_IMAGE_MODEL_DEFAULT,
  })

  if (!result?.dataBase64) {
    throw new Error('バナー画像の生成に失敗しました')
  }

  const filename = `seo_${article.id}_${Date.now()}_banner.png`
  const saved = await saveBase64ToFile({ base64: result.dataBase64, filename, subdir: 'images' })

  // DBに保存
  const rec = await (prisma as any).seoImage.create({
    data: {
      articleId: article.id,
      kind: 'BANNER',
      title: '記事バナー',
      description: `記事「${title}」のバナー画像\nジャンル: ${genre}`,
      prompt: prompt,
      filePath: saved.relativePath,
      mimeType: 'image/png',
    },
  })
  return rec
}

async function autoGenerateDiagram(article: any, args: { title: string; description: string }) {
  await ensureSeoStorage()
  const prompt = [
    'You are a professional info-graphic designer.',
    'Goal: Create a clear, high-contrast, vector-style diagram or illustration for a business article.',
    'CRITICAL: NO TEXT at all (no Japanese, no English, no numbers). Symbols and icons only.',
    'Style: Flat design, minimal, clean, professional.',
    'Elements: Use arrows, flowchart boxes, or relationship diagrams but WITHOUT characters inside.',
    'Colors: Monochrome with Bunridge blue (#2563EB) as the key accent.',
    '',
    `Article title: ${article.title}`,
    `Diagram concept: ${args.title}`,
    `Description: ${args.description}`,
    '',
    'Output: a clean 1:1 square diagram illustration.',
  ].join('\n')

  const img = await geminiGenerateImagePng({
    prompt,
    aspectRatio: '1:1',
    imageSize: '2K',
    model: GEMINI_IMAGE_MODEL_DEFAULT,
  })

  const filename = `seo_${article.id}_${Date.now()}_diagram.png`
  const saved = await saveBase64ToFile({ base64: img.dataBase64, filename, subdir: 'images' })
  const rec = await (prisma as any).seoImage.create({
    data: {
      articleId: article.id,
      kind: 'DIAGRAM',
      title: args.title,
      description: args.description,
      prompt,
      filePath: saved.relativePath,
      mimeType: img.mimeType || 'image/png',
    },
  })
  return rec
}

async function generateLlmoBlocks(article: any, merged: string): Promise<string> {
  const on = (k: string) => ((article.llmoOptions as any) || {})?.[k] !== false
  const userKnowledge = await buildUserKnowledgeContext(article.userId)
  const requestText = article.requestText ? clampText(String(article.requestText || ''), 1800) : ''
  const prompt = [
    'You are a Japanese SEO + LLMO editor.',
    'Generate helpful additional blocks for the article in Markdown.',
    'Do NOT copy from sources.',
    'Output ONLY Markdown (no JSON).',
    NO_AI_MARKDOWN_RULES,
    '',
    `Title: ${article.title}`,
    `Tone: ${article.tone}`,
    `Keywords: ${((article.keywords as any) || []).join(', ')}`,
    `Target chars: ${article.targetChars}`,
    requestText
      ? `\n【一次情報（最優先で反映）】\n以下はユーザーが提供した固有情報です。必ず本文に具体的に反映してください。\n- ここに無い事実（数字/体験/実績/断定）は作らない\n- 具体例・結論・比較の根拠は可能な限りこの一次情報に基づける\n- 文章の“芯”として扱い、薄い一般論で上書きしない\n\n${requestText}\n`
      : '',
    '',
    userKnowledge,
    `Include blocks (ON/OFF):`,
    `- TL;DR: ${on('tldr') ? 'ON' : 'OFF'}`,
    `- 結論ファースト＋根拠: ${on('conclusionFirst') ? 'ON' : 'OFF'}`,
    `- FAQ: ${on('faq') ? 'ON' : 'OFF'}`,
    `- 用語集: ${on('glossary') ? 'ON' : 'OFF'}`,
    `- 比較表: ${on('comparison') ? 'ON' : 'OFF'}`,
    `- 引用・根拠（言い換え）: ${on('quotes') ? 'ON' : 'OFF'}`,
    `- 実務テンプレ: ${on('templates') ? 'ON' : 'OFF'}`,
    `- 反論に答える: ${on('objections') ? 'ON' : 'OFF'}`,
    '',
    'Rules:',
    '- If OFF, omit the section entirely.',
    '- Keep each block concise but useful.',
    '- Use headings starting from "##".',
    '- For FAQ: Use plain "Q:" / "A:" lines (no bold markers).',
    '- For glossary: markdown table is OK.',
    '- For comparison: include at least one markdown table when ON.',
    '',
    'Context (truncated):',
    clampText(merged, 9000),
  ].join('\n')

  try {
    const out = await geminiGenerateText({
      model: GEMINI_TEXT_MODEL_DEFAULT,
      parts: [{ text: prompt }],
      generationConfig: { temperature: 0.45, maxOutputTokens: 2200 },
    })
    return out?.trim() ? sanitizeAiMarkdown(out.trim()) : ''
  } catch {
    return ''
  }
}

async function integrate(jobId: string) {
  const p = prisma as any
  const job = await p.seoJob.findUnique({
    where: { id: jobId },
    include: {
      article: { include: { memo: true } },
      sections: { orderBy: { index: 'asc' } },
    },
  })
  if (!job) throw new Error('job not found')
  const article = job.article
  const isComparison = String(article.mode || '').toLowerCase() === 'comparison_research'
  const sections = job.sections
  const memo = article.memo?.content

  // 全てのセクションが生成済み（reviewed）であることを確認（記事が途中で終わるのを防ぐ）
  const incompleteSections = sections.filter((s: any) => s.status !== 'reviewed' || !s.content || !s.content.trim())
  if (incompleteSections.length > 0) {
    const missingIndices = incompleteSections.map((s: any) => s.index).join(', ')
    throw new Error(
      `統合前に全てのセクションを生成する必要があります。未生成セクション: ${missingIndices} (全${sections.length}セクション中${incompleteSections.length}件未完成)`
    )
  }

  // reviewed かつ content が存在するセクションのみを統合（記事が途中で終わるのを防ぐ）
  const mergedSections = sections
    .filter((s: any) => s.status === 'reviewed' && s.content && s.content.trim())
    .map((s: any) => normalizeH2Heading(s.content || '', s.headingPath || `section_${s.index}`))
    .filter(Boolean)
    .join('\n\n')

  // セクションが1つも統合されない場合はエラー
  if (!mergedSections || !mergedSections.trim()) {
    throw new Error('統合するセクションがありません。全てのセクションが生成済みであることを確認してください。')
  }

  // まずは“セクション結合”で文字数を担保（ここで短くしない）
  const parts: string[] = [`# ${article.title}`]
  // 既にバナーがあるなら先頭に差し込む（ない場合は後で生成）
  const existingBanner = await p.seoImage.findFirst({
    where: { articleId: article.id, kind: 'BANNER' },
    orderBy: { createdAt: 'desc' },
  })
  if (existingBanner?.id) {
    parts.push(`![記事バナー](/api/seo/images/${existingBanner.id})`)
  }

  // 比較記事: 企業数が不足している場合は、冒頭に明示（止めずに生成を継続）
  const coverageNote = comparisonCoverageNote(article)
  if (coverageNote) {
    parts.push('> ' + coverageNote)
  }

  // 短い記事ほど、冒頭に表を置く（読者のスキャン性を最大化）
  const topTables = await generateTopTables(article, mergedSections)
  if (topTables) parts.push(topTables)

  // LLMOの追加ブロック（短くてもOK、品質補助＆文字数補助）
  const llmoBlocks = await generateLlmoBlocks(article, mergedSections)
  if (llmoBlocks) parts.push(llmoBlocks)

  if (memo) {
    parts.push('<!-- リライト用メモ（次回改善用） -->')
    parts.push(`<!-- ${clampText(memo, 1200)} -->`)
  }

  parts.push('## 本文')
  parts.push(mergedSections)

  // 引用元（参考URL）を記事末尾に明示（実在サービス・一次情報の担保）
  try {
    const refs = await p.seoReference.findMany({
      where: { articleId: article.id },
      orderBy: { createdAt: 'asc' },
      select: { url: true, title: true },
    })
    const urls = Array.isArray(article.referenceUrls) ? (article.referenceUrls as any[]) : []
    const fromInput = urls.map((u: any) => normalizeUrlMaybe(u)).filter(Boolean)
    const mergedUrls = Array.from(
      new Set([
        ...refs.map((r: any) => String(r.url || '').trim()).filter(Boolean),
        ...fromInput,
      ])
    ).slice(0, 25)
    if (mergedUrls.length) {
      parts.push('')
      parts.push('## 参考文献（引用元）')
      parts.push('※ 本文は引用元の内容をそのまま転載せず、要点を言い換えて整理しています。')
      for (const u of mergedUrls) parts.push(`- ${u}`)
    }
  } catch {
    // ignore
  }

  // 目標文字数に足りない場合は、追補セクションを自動生成して埋める（最大5回）
  // ただし、目標が小さい場合（10,000字未満）は追補を控えめに
  const target = Math.max(3000, Number(article.targetChars || 10000))
  const maxExtraIterations = target < 10000 ? 2 : 5
  for (let i = 0; i < maxExtraIterations; i++) {
    const cur = mdCharCount(parts.join('\n\n'))
    if (cur >= target * 0.90) break // 90%以上あればOK（小さい記事向けに緩和）
    const need = Math.round(target * 0.95 - cur)
    const addPrompt = [
      'You are a Japanese SEO writer.',
      'Write an additional section to improve completeness and meet the target length.',
      'Do NOT copy from sources; add originality (experience, tradeoffs, failure cases, checklists).',
      'Return Markdown only and start with "## ".',
      '',
      `Article title: ${article.title}`,
      `Keywords: ${((article.keywords as any) || []).join(', ')}`,
      `Tone: ${article.tone}`,
      memo ? `User notes (preferences/constraints):\n${clampText(memo, 900)}` : '',
      '',
      `Target chars for this additional section: ~${Math.min(3500, Math.max(600, need))}`,
      '',
      'Context (truncated):',
      clampText(parts.join('\n\n'), 9000),
    ]
      .filter(Boolean)
      .join('\n')
    try {
      const extra = await geminiGenerateText({
        model: GEMINI_TEXT_MODEL_DEFAULT,
        parts: [{ text: addPrompt }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 6500 },
      })
      if (extra && extra.trim()) parts.push(extra.trim())
    } catch {
      break
    }
  }

  // 記事が途中で終わらないよう、必ず「まとめ」セクションを追加
  const hasSummary = parts.some((p) => /^##\s+(まとめ|結論|まとめと今後のアクション)/i.test(p))
  if (!hasSummary) {
    try {
      const summaryPrompt = [
        'You are a Japanese SEO writer.',
        'Write a concise summary section (まとめ) that concludes the article.',
        'The summary should:',
        '- Recap the main points discussed in the article',
        '- Provide actionable next steps or recommendations',
        '- End with an encouraging message for the reader',
        'Return Markdown only. Start with "## まとめ".',
        NO_AI_MARKDOWN_RULES,
        '',
        `Article title: ${article.title}`,
        `Keywords: ${((article.keywords as any) || []).join(', ')}`,
        `Tone: ${article.tone}`,
        '',
        'Article content (truncated):',
        clampText(parts.join('\n\n'), 12000),
      ]
        .filter(Boolean)
        .join('\n')

      const summary = await geminiGenerateText({
        model: GEMINI_TEXT_MODEL_DEFAULT,
        parts: [{ text: summaryPrompt }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2000 },
      })
      if (summary && summary.trim()) {
        parts.push('')
        parts.push(sanitizeAiMarkdown(summary.trim()))
      } else {
        // フォールバック: シンプルなまとめを追加
        parts.push('')
        parts.push('## まとめ')
        parts.push('')
        parts.push(
          `本記事では、${article.title}について解説しました。記事の内容を参考に、ぜひ実践してみてください。`
        )
      }
    } catch (summaryErr: any) {
      // エラー時もフォールバックでまとめを追加（記事が途中で終わるのを防ぐ）
      console.warn('[seo integrate] summary generation failed:', summaryErr?.message)
      parts.push('')
      parts.push('## まとめ')
      parts.push('')
      parts.push(
        `本記事では、${article.title}について解説しました。記事の内容を参考に、ぜひ実践してみてください。`
      )
    }
  }

  let finalMarkdown = parts.join('\n\n')

  // 文字数制御（方針: 上限は緩め / 下限は厳しめ）
  // - 上限: 目標の2倍程度までは許容（例: 5000字→1万字でもOK）
  // - 下限: 目標を大きく下回る短文（例: 3000字→1000字）を絶対に作らない
  const maxAllowed = Math.round(target * 2.0)
  const minAllowed = Math.round(target * 0.85)

  // 上限を大幅に超えたら、AI短縮は使わず段落単位で安全にトリム（短くなりすぎ事故を防ぐ）
  try {
    const cur = mdCharCount(finalMarkdown)
    if (cur > maxAllowed) {
      await pushResearchEvent(jobId, {
        at: Date.now(),
        kind: 'warn',
        title: '文字数が上限を超過したため、段落単位で調整します',
        detail: `${cur.toLocaleString()}字 → 上限${maxAllowed.toLocaleString()}字付近へ`,
      })
      finalMarkdown = truncateMarkdownByParagraph(finalMarkdown, Math.round(maxAllowed * 1.02))
    }
  } catch {
    // ignore
  }

  // もし短すぎる場合は、統合の最終段で追加セクションを生成して底上げする（最大3回）
  try {
    for (let i = 0; i < 3; i++) {
      const cur = mdCharCount(finalMarkdown)
      if (cur >= minAllowed) break
      const need = Math.round(minAllowed - cur)
      await pushResearchEvent(jobId, {
        at: Date.now(),
        kind: 'warn',
        title: '本文が短すぎるため追記で補います',
        detail: `${cur.toLocaleString()}字 → 最低${minAllowed.toLocaleString()}字へ（+${need.toLocaleString()}字目安）`,
      })

      const addPrompt = [
        'You are a Japanese SEO writer.',
        'Write ONE additional section to improve completeness.',
        'Do NOT copy from sources; add originality (experience, tradeoffs, failure cases, checklists).',
        'Return Markdown only and start with "## ".',
        '',
        `Article title: ${article.title}`,
        `Keywords: ${((article.keywords as any) || []).join(', ')}`,
        `Tone: ${article.tone}`,
        memo ? `User notes (preferences/constraints):\n${clampText(memo, 900)}` : '',
        '',
        `Target chars for this additional section: ~${Math.min(3000, Math.max(700, need))}`,
        '',
        'Context (truncated):',
        clampText(finalMarkdown, 9000),
      ]
        .filter(Boolean)
        .join('\n')

      try {
        const extra = await geminiGenerateText({
          model: GEMINI_TEXT_MODEL_DEFAULT,
          parts: [{ text: addPrompt }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 4500 },
        })
        if (extra && extra.trim()) finalMarkdown = `${finalMarkdown.trim()}\n\n${extra.trim()}`
      } catch {
        break
      }
    }
  } catch {
    // ignore
  }

  // 比較記事: 候補0件で本文を完成させない（「比較になってない」記事を防ぐ）
  if (isComparison) {
    const cfg0 = (article?.comparisonConfig as any) || {}
    const desired0 = Math.max(0, Math.min(60, Number(cfg0?.count || 0)))
    const candidates0 = uniqCandidatesByName(
      Array.isArray(article?.comparisonCandidates) ? (article.comparisonCandidates as any[]) : []
    )
    // 比較記事は「比較対象0社」で完成させない（テーブル/強み弱みが成立しない）
    if (candidates0.length === 0) {
      await pushResearchEvent(jobId, {
        at: Date.now(),
        kind: 'error',
        title: '比較候補が0件のため、記事を完成できません',
        detail:
          '候補が取得できない状態で比較記事を完成させると、サービス名が入らず「比較になってない」記事になります。SerpAPI設定/検索クエリ/候補手動追加を確認してください。',
      })
      throw new Error('比較候補が0件のため、比較記事を完成できません')
    }
  }

  // 比較記事で「（ツール名）」等のテンプレが混ざった場合は、そのまま公開しない（実在名に矯正）
  if (isComparison && containsPlaceholderNames(finalMarkdown)) {
    const cfg = (article?.comparisonConfig as any) || {}
    const desired = Math.max(0, Math.min(60, Number(cfg?.count || 0)))
    // 候補が空なら、まず自動収集を試みる（SerpAPIがある前提）
    try {
      await ensureComparisonCandidates(article, jobId)
    } catch {
      // ignore
    }
    const candidates = uniqCandidatesByName(
      Array.isArray(article?.comparisonCandidates) ? (article.comparisonCandidates as any[]) : []
    )
    const candidateText = candidates.length
      ? candidates
          .slice(0, desired ? Math.min(desired, 60) : 60)
          .map((c, i) => `${i + 1}. ${String(c?.name || '').trim()}${c?.websiteUrl ? ` (${c.websiteUrl})` : ''}`)
          .join('\n')
      : '(empty)'

    await pushResearchEvent(jobId, {
      at: Date.now(),
      kind: 'warn',
      title: '本文にテンプレ（仮のサービス名）が混在していたため修正中…',
      detail: candidates.length ? `候補: ${candidates.slice(0, 8).map((c) => c.name).join(' / ')}` : '候補が空です',
    })

    const fixPrompt = [
      'You are a Japanese editor specialized in factual comparison articles.',
      'Task: remove placeholder/dummy service names and ensure only REAL service names are used.',
      '',
      'CRITICAL RULES:',
      '- Do NOT invent any new service/company names.',
      '- Use ONLY the services listed in the candidate list below.',
      '- If the candidate list is empty, remove all placeholder names and rewrite the text so it stays truthful and general (no specific names).',
      '- Remove patterns like: （ツール名）, （サービス名）, サービスA, 会社A, XXX, 〇〇, etc.',
      '',
      'Candidate list (ONLY allowed proper nouns):',
      candidateText,
      '',
      'Return: FULL MARKDOWN of the corrected article (no JSON).',
      '',
      'Original markdown:',
      clampText(finalMarkdown, 14000),
    ]
      .filter(Boolean)
      .join('\n')

    try {
      const fixed = await geminiGenerateText({
        model: GEMINI_TEXT_MODEL_DEFAULT,
        parts: [{ text: fixPrompt }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 22000 },
      })
      if (fixed && fixed.trim() && !containsPlaceholderNames(fixed)) {
        finalMarkdown = sanitizeAiMarkdown(fixed.trim())
      }
    } catch {
      // 失敗しても本文完成は優先（ただしテンプレが残る可能性があるので、次の工程で気づけるようログに残す）
      await pushResearchEvent(jobId, {
        at: Date.now(),
        kind: 'error',
        title: 'テンプレ除去の自動修正に失敗しました',
        detail: '候補が不足している可能性があります。比較候補の入力/SerpAPI設定を確認してください。',
      })
    }
  }

  // 比較記事: 「表が空（ヘッダーだけ）」で出てしまう事故を最終段で防ぐ（候補から自動補完）
  // 例: 「RPOサービス比較表（例）」のようにヘッダーだけ出て本文が空になることがある
  if (isComparison) {
    try {
      const cfg = (article?.comparisonConfig as any) || {}
      const desired = Math.max(0, Math.min(60, Number(cfg?.count || 0)))
      const candidates = uniqCandidatesByName(
        Array.isArray(article?.comparisonCandidates) ? (article.comparisonCandidates as any[]) : []
      )
      const maxRows = desired || candidates.length
      if (candidates.length) {
        finalMarkdown = fillEmptyServiceTables(finalMarkdown, candidates, maxRows)
        // 仕様: 強み/弱みの比較表は必ず本文内に含める
        finalMarkdown = ensureProsConsTable(finalMarkdown, candidates, maxRows)
      }
    } catch {
      // ignore
    }
  }

  await p.seoArticle.update({
    where: { id: article.id },
    data: { finalMarkdown, status: 'DONE' },
  })

  if (isComparison) {
    // 校正・表現調整を比較記事の明示ステップとして表示（実処理は統合の後段で自然に効く）
    await p.seoJob.update({ where: { id: jobId }, data: { step: 'cmp_polish', progress: 90, status: 'running' } })
  }

  // 自動で素材生成（バナーは必須 / 図解は有料のみ）: 失敗しても本文完成は優先する
  try {
    // autoBundleが明示OFFなら、バナー/図解とも作らない（ユーザー意思を尊重）
    if (article.autoBundle !== false) {
      // バナーは一覧サムネに必須なので、プランに関係なく“必ず”生成
      const alreadyBanner = await p.seoImage.findFirst({
        where: { articleId: article.id, kind: 'BANNER' },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })
      const banner = alreadyBanner?.id ? alreadyBanner : await autoGenerateBanner({ article, finalMarkdown })

      // 生成したバナーを本文先頭に差し込む（既に入っていれば何もしない）
      try {
        if (banner?.id && !finalMarkdown.includes(`/api/seo/images/${banner.id}`)) {
          const lines = String(finalMarkdown || '').replace(/\r\n/g, '\n').split('\n')
          const out: string[] = []
          let i = 0
          out.push(lines[i] || `# ${article.title}`)
          i++
          // 先頭の空行を維持
          while (i < lines.length && !lines[i].trim()) {
            out.push(lines[i])
            i++
          }
          out.push(`![記事バナー](/api/seo/images/${banner.id})`)
          out.push('')
          out.push(...lines.slice(i))
          await p.seoArticle.update({
            where: { id: article.id },
            data: { finalMarkdown: out.join('\n') },
          })
        }
      } catch {
        // ignore
      }

      // 図解は有料のみ（従来通り）
      const canUseImages = await canUseSeoImagesForArticle(article)
      if (canUseImages) {
        await p.seoJob.update({ where: { id: jobId }, data: { step: 'media', progress: 92, status: 'running' } })

        // 1. 本文から図解を提案させる
        const headings = finalMarkdown.match(/^#{1,3}\s+.+$/gm) || []
        const suggestPrompt = `
あなたは記事のビジュアル設計者です。
以下の記事内容を分析して、読者の理解を助ける図解（DIAGRAM）を2つ提案してください。

タイトル: ${article.title}
見出し: ${headings.slice(0, 15).join(' / ')}
本文抜粋: ${finalMarkdown.slice(0, 3000)}

出力形式（JSONのみ）:
{"diagrams": [{"title": "図解タイトル", "description": "図解の内容説明（Geminiが画像生成できるよう詳細に）"}]}
        `

        try {
          const suggestion = await geminiGenerateJson<{ diagrams: { title: string; description: string }[] }>(
            { prompt: suggestPrompt, model: GEMINI_TEXT_MODEL_DEFAULT },
            'JSON'
          )

          if (suggestion.diagrams?.length) {
            for (const d of suggestion.diagrams.slice(0, 2)) {
              await autoGenerateDiagram(article, d)
              // レート制限回避
              await new Promise((r) => setTimeout(r, 1000))
            }
          }
        } catch (e) {
          console.warn('Diagram auto-suggestion failed, using defaults', e)
          // フォールバック: 固定のアイデア
          const diagramIdeas = [
            { title: 'プロセスの流れ', description: '課題から解決、そして成果に至るまでのステップバイステップのフロー図' },
            { title: '比較と選択', description: '複数の選択肢や要素を対比させ、最適なものを選ぶための比較図' },
          ]
          for (const d of diagramIdeas) {
            await autoGenerateDiagram(article, d)
          }
        }
      }
    }
  } catch (e) {
    console.error('Asset generation failed', e)
  }

  // 差別化②: 内部リンク提案（記事本文から抽出して提案）
  const internalLinkPrompt = [
    'You are a Japanese SEO strategist.',
    'From the article, propose internal links that would strengthen topical authority.',
    'Output 8-15 items. Each item: {anchor, suggestedTargetType, rationale}.',
    'Do NOT invent existing pages. Use "targetType" like "サービス紹介", "料金", "比較", "事例", "FAQ", "用語集".',
    'Output as bullet list in Japanese (not JSON).',
    '',
    clampText(finalMarkdown, 8000),
  ].join('\n')

  let internalLinks = ''
  try {
    internalLinks = await geminiGenerateText({
      model: GEMINI_TEXT_MODEL_DEFAULT,
      parts: [{ text: internalLinkPrompt }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
    })
  } catch {
    internalLinks = '（生成に失敗しました）'
  }
  await p.seoKnowledgeItem.create({
    data: {
      userId: article.userId,
      articleId: article.id,
      type: 'internal_link',
      title: '内部リンク提案',
      content: internalLinks,
      sourceUrls: article.referenceUrls as any,
    },
  })

  // 差別化③: SNS要約 + CTA案
  const snsPrompt = [
    'You are a Japanese social media editor.',
    'Create: (1) X(Twitter) post (<=140 chars), (2) LinkedIn style post (~400 chars), (3) CTA paragraph for the article end (80-140 chars).',
    'Avoid clickbait. Keep specific and helpful.',
    '',
    `Title: ${article.title}`,
    clampText(finalMarkdown, 5000),
  ].join('\n')

  let sns = ''
  try {
    sns = await geminiGenerateText({
      model: GEMINI_TEXT_MODEL_DEFAULT,
      parts: [{ text: snsPrompt }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
    })
  } catch {
    sns = '（生成に失敗しました）'
  }
  await p.seoKnowledgeItem.create({
    data: {
      userId: article.userId,
      articleId: article.id,
      type: 'sns',
      title: 'SNS要約 & CTA案',
      content: sns,
      sourceUrls: article.referenceUrls as any,
    },
  })

  await p.seoJob.update({
    where: { id: jobId },
    data: { status: 'done', step: 'done', progress: 100, finishedAt: new Date() },
  })
}

export async function researchAndStore(
  articleId: string,
  opts?: { maxUrls?: number; jobId?: string }
): Promise<{ stored: number }> {
  const p = prisma as any
  const article = await p.seoArticle.findUnique({ where: { id: articleId } })
  if (!article) throw new Error('article not found')

  const urls = (article.referenceUrls as any) as string[] | null
  const list = Array.isArray(urls) ? urls : []
  const maxUrls = typeof opts?.maxUrls === 'number' && opts.maxUrls > 0 ? opts.maxUrls : list.length
  const targets = list.slice(0, maxUrls)
  let stored = 0

  for (const url of targets) {
    try {
      await pushResearchEvent(opts?.jobId, {
        at: Date.now(),
        kind: 'fetch',
        title: 'ページを取得中…',
        url,
        detail: shortHost(url) || url,
      })
      const extracted = await fetchAndExtract(url)
      await pushResearchEvent(opts?.jobId, {
        at: Date.now(),
        kind: 'summarize',
        title: '要点を抽出中…',
        url,
        detail: extracted.title ? extracted.title.slice(0, 80) : shortHost(url),
      })
      const summarizePrompt = [
        'You are a Japanese SEO analyst.',
        'Summarize and analyze this page WITHOUT copying sentences.',
        'Output STRICT JSON only.',
        '',
        'JSON schema:',
        '{ "summary":"...", "insights": { "claims":[], "structure":[], "faq":[], "internalLinks":[] } }',
        '',
        `URL: ${url}`,
        extracted.title ? `TITLE: ${extracted.title}` : '',
        'HEADINGS:',
        extracted.headings.slice(0, 20).join(' / '),
        '',
        'BODY (truncated):',
        clampText(extracted.text, 12000),
      ]
        .filter(Boolean)
        .join('\n')

      const out = await geminiGenerateJson<{
        summary: string
        insights: { claims: string[]; structure: string[]; faq: string[]; internalLinks: string[] }
      }>({
        model: GEMINI_TEXT_MODEL_DEFAULT,
        prompt: summarizePrompt,
        generationConfig: { temperature: 0.3, maxOutputTokens: 1800 },
      })

      await p.seoReference.upsert({
        where: { articleId_url: { articleId, url } },
        create: {
          articleId,
          url,
          title: extracted.title,
          fetchedAt: new Date(),
          extractedText: extracted.text,
          headings: extracted.headings as any,
          summary: out.summary,
          insights: out.insights as any,
        },
        update: {
          title: extracted.title,
          fetchedAt: new Date(),
          extractedText: extracted.text,
          headings: extracted.headings as any,
          summary: out.summary,
          insights: out.insights as any,
        },
      })

      // ナレッジにも残す
      await p.seoKnowledgeItem.create({
        data: {
          userId: article.userId,
          articleId,
          type: 'insight',
          title: `参考URL要点: ${extracted.title || url}`,
          content: `${out.summary}\n\n主張:\n- ${(out.insights?.claims || []).join('\n- ')}`,
          sourceUrls: [url] as any,
        },
      })

      stored++
      await pushResearchEvent(opts?.jobId, {
        at: Date.now(),
        kind: 'store',
        title: '参考情報を保存しました',
        url,
        detail: extracted.title ? extracted.title.slice(0, 80) : shortHost(url),
      })
    } catch (e) {
      // 失敗しても他URLを継続
      console.warn(`[seo research] failed url=${url} at ${nowIso()}`)
      await pushResearchEvent(opts?.jobId, {
        at: Date.now(),
        kind: 'warn',
        title: '取得に失敗（スキップ）',
        url,
        detail: shortHost(url) || url,
      })
    }
  }

  return { stored }
}

export async function advanceSeoJob(jobId: string): Promise<{ jobId: string }> {
  const p = prisma as any
  const job = await p.seoJob.findUnique({
    where: { id: jobId },
    include: { article: true, sections: true },
  })
  if (!job) throw new Error('job not found')
  if (job.status === 'done') return { jobId }
  if (job.status === 'paused' || job.status === 'cancelled') return { jobId }

  try {
    await ensureOutlineAndSections(jobId)

    // 全てのセクションが生成されるまで繰り返し実行（記事が途中で終わるのを防ぐ）
    let maxIterations = 50 // 無限ループ防止
    let iteration = 0
    while (iteration < maxIterations) {
      const currentJob = await p.seoJob.findUnique({
        where: { id: jobId },
        include: { sections: true },
      })
      if (!currentJob) throw new Error('job not found')

      const remaining = (currentJob.sections || []).filter(
        (s: any) => s.status !== 'reviewed' || !s.content || !s.content.trim()
      )

      if (remaining.length === 0) {
        // 全てのセクションが生成済み
        break
      }

      // 未生成のセクションを1つ生成
      try {
        await generateSection(jobId)
      } catch (sectionErr: any) {
        // セクション生成エラーでも、次のセクションを試みる（ただし、連続エラーは避ける）
        console.error(`[seo generateSection] failed for job ${jobId}:`, sectionErr?.message)
        // エラーが続く場合は、残りのセクションをスキップして統合に進む（部分的な記事でも完成させる）
        if (iteration > 5 && remaining.length > 0) {
          await pushResearchEvent(jobId, {
            at: Date.now(),
            kind: 'warn',
            title: '一部セクションの生成に失敗しましたが、統合を続行します',
            detail: `未生成セクション: ${remaining.map((s: any) => s.index).join(', ')}`,
          })
          break
        }
      }

      iteration++
    }

    // 最終チェック: 全てのセクションが生成済みか確認
    const finalCheck = await p.seoJob.findUnique({
      where: { id: jobId },
      include: { sections: true },
    })
    const stillRemaining = (finalCheck?.sections || []).filter(
      (s: any) => s.status !== 'reviewed' || !s.content || !s.content.trim()
    )

    if (stillRemaining.length > 0) {
      // 未生成セクションがあっても、統合を試みる（部分的な記事でも完成させる）
      await pushResearchEvent(jobId, {
        at: Date.now(),
        kind: 'warn',
        title: '一部セクションが未生成ですが、統合を続行します',
        detail: `未生成セクション: ${stillRemaining.map((s: any) => s.index).join(', ')}`,
      })
    }

    await p.seoJob.update({ where: { id: jobId }, data: { step: 'integrate', progress: 85, status: 'running' } })
    await integrate(jobId)
    return { jobId }
  } catch (e: any) {
    await p.seoJob.update({
      where: { id: jobId },
      data: { status: 'error', error: e?.message || 'unknown error' },
    })
    await p.seoArticle.update({
      where: { id: job.articleId },
      data: { status: 'ERROR' },
    })
    throw e
  }
}

/**
 * パイプライン全体を可能な限り進める
 * サーバーレスのタイムアウトに配慮し、一定時間を過ぎたら中断して現状を返す
 */
export async function runPipelineUntilTimeout(jobId: string, timeoutMs = 25000): Promise<{ jobId: string; status: string; step: string }> {
  const start = Date.now()
  let currentJob: any = null

  while (Date.now() - start < timeoutMs) {
    try {
      await advanceSeoJob(jobId)
      
      currentJob = await (prisma as any).seoJob.findUnique({
        where: { id: jobId },
        select: { status: true, step: true }
      })

      if (currentJob.status === 'done' || currentJob.status === 'error') {
        break
      }
    } catch (e) {
      console.error('[runPipelineUntilTimeout] error:', e)
      break
    }
  }

  if (!currentJob) {
    currentJob = await (prisma as any).seoJob.findUnique({
      where: { id: jobId },
      select: { status: true, step: true }
    })
  }

  return { jobId, status: currentJob.status, step: currentJob.step }
}

