import { prisma } from '@/lib/prisma'
import { geminiGenerateJson, geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'
import { fetchAndExtract } from '@seo/lib/extract'
import { SeoCreateArticleInput, SeoOutline, SeoOutlineSchema } from '@seo/lib/types'
import { ensureSeoStorage, saveBase64ToFile } from '@seo/lib/storage'

function nowIso() {
  return new Date().toISOString()
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

const NO_AI_MARKDOWN_RULES = [
  'Important formatting rules (must follow):',
  '- Do NOT use Markdown emphasis markers: do not output "**", "*", "__", "_".',
  '- Do NOT use checklist notation: do not output "- [ ]" or "- [x]". Use normal bullet/numbered lists instead.',
  '- Do NOT wrap labels like Q/A with bold. Use plain "Q:" / "A:".',
].join('\n')

function normalizeH2Heading(md: string, fallback: string): string {
  const t = (md || '').trim()
  if (!t) return `## ${fallback}\n\n（生成に失敗しました）`
  if (/^##\s+/m.test(t)) return t
  // 先頭がH2でない場合は補う（統合で崩れないように）
  return `## ${fallback}\n\n${t}`
}

function computeMinSections(targetChars: number): number {
  // 1セクションの現実的な安定出力: 2000-3000字
  // 50,000字なら最低でも18セクション程度は必要
  const t = Math.max(10000, Number(targetChars || 10000))
  const min = Math.ceil(t / 2800)
  return Math.max(12, Math.min(28, min))
}

function ensureMinSections(outline: SeoOutline, targetChars: number): SeoOutline {
  const minSections = computeMinSections(targetChars)
  if (outline.sections.length >= minSections) return outline

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
      plannedChars: 2500,
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

  const baseCount = Math.max(12, sections.length || 0)
  const per = Math.max(1800, Math.min(3500, Math.round(Math.max(10000, targetChars) / Math.max(1, baseCount))))
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
  const comparisonCandidates = Array.isArray(article.comparisonCandidates) ? (article.comparisonCandidates as any[]) : []
  const referenceInputs = Array.isArray(article.referenceInputs) ? (article.referenceInputs as any[]) : []

  const comparisonBlock = isComparison
    ? [
        'Comparison article mode: ENABLED (research-based).',
        'You must produce a structure comparable to top-tier Japanese comparison pages:',
        '- clear evaluation axes',
        '- strong table-first scanability',
        '- per-company deep sections (facts + who it fits + cautions)',
        '- explicit scoring/selection criteria',
        '- sources/citations plan (URL list, not copy-paste).',
        '',
        `Template type: ${String(comparisonConfig?.template || '')}`,
        `Target companies: ${String(comparisonConfig?.count || '')}`,
        `Region: ${String(comparisonConfig?.region || '')}`,
        comparisonConfig?.exclude?.length ? `Exclude rules: ${(comparisonConfig.exclude as any[]).join(' / ')}` : '',
        comparisonConfig?.tags?.length ? `Priority tags: ${(comparisonConfig.tags as any[]).join(' / ')}` : '',
        `Require official site: ${comparisonConfig?.requireOfficial ? 'YES' : 'NO'}`,
        `Include third-party: ${comparisonConfig?.includeThirdParty ? 'YES' : 'NO'}`,
        '',
        comparisonCandidates.length
          ? [
              'Final candidate list (do not invent new companies beyond this list):',
              ...comparisonCandidates.slice(0, 60).map((c, i) => {
                const name = String(c?.name || '').trim()
                const u = typeof c?.websiteUrl === 'string' ? c.websiteUrl : ''
                return `${i + 1}. ${name}${u ? ` (${u})` : ''}`
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
      requestText ? `\nUser provided unique info (must respect):\n${requestText}` : '',
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

  if (article.outline) return

  const isComparison = String(article.mode || '').toLowerCase() === 'comparison_research'

  await p.seoJob.update({
    where: { id: jobId },
    data: { status: 'running', step: isComparison ? 'cmp_outline' : 'outline', startedAt: job.startedAt ?? new Date() },
  })
  await p.seoArticle.update({ where: { id: article.id }, data: { status: 'RUNNING' } })

  // NOTE: Vercel等のサーバレス環境では、ここで「複数URLの取得＋要約」を自動実行するとタイムアウトしやすい。
  // デフォルトはOFFにして、必要ならUIから「参考URLを解析」を明示的に実行してもらう。
  // どうしても自動化したい場合は、環境変数でONにする（自己責任）。
  const autoResearch = process.env.SEO_AUTO_RESEARCH_BEFORE_OUTLINE === '1'
  if (autoResearch) {
    const urls = (article.referenceUrls as any) as string[] | null
    if (Array.isArray(urls) && urls.length) {
      const hasRef = await p.seoReference.findFirst({ where: { articleId: article.id }, select: { id: true } })
      if (!hasRef) {
        try {
          // 1回のadvanceでやり切ろうとすると落ちやすいので、ここでは最大1件だけに制限
          await researchAndStore(article.id, { maxUrls: 1 })
        } catch {
          // リサーチ失敗は致命にしない（入力中心でも生成可能）
        }
      }
    }
  }

  const researchContext = await buildResearchContext(article.id)
  const outline = await generateOutline(article, researchContext)
  const outlineMd = toOutlineMarkdown(outline)

  await p.seoArticle.update({
    where: { id: article.id },
    data: { outline: outlineMd },
  })

  // sections作成
  const plannedTotal = outline.sections.reduce((a, s) => a + (s.plannedChars || 2000), 0)
  const target = Math.max(10000, Number(article.targetChars || 10000))
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

  const prompt = [
    'You are a Japanese SEO + LLMO expert writer.',
    'Write ONE section only in Japanese. Markdown output.',
    'Do NOT copy from sources; paraphrase ideas and add originality (experience, tradeoffs, examples, failure cases).',
    'Avoid "AIっぽい" generic filler. Be specific and practical.',
    NO_AI_MARKDOWN_RULES,
    '',
    `Article title: ${article.title}`,
    `Tone: ${article.tone}`,
    forbidden.length ? `Forbidden: ${(forbidden as string[]).join(' / ')}` : '',
    requestText ? `\nUser provided unique info (must respect):\n${requestText}` : '',
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

async function autoGenerateBanner(article: any) {
  await ensureSeoStorage()
  const prompt = [
    'You are a professional graphic designer for high-end business media.',
    'Goal: Create a visually stunning, modern, and clean thumbnail/banner for a Japanese business article.',
    'CRITICAL: NO TEXT at all (no Japanese, no English, no numbers). Text will be added later.',
    'Design elements: Sophisticated abstract shapes, high-quality business metaphors, plenty of negative space.',
    'Mood: Professional, trustworthy, innovative.',
    'Colors: Use Bunridge blue (#2563EB) as the primary accent color.',
    '',
    `Theme: ${article.title}`,
    `Keywords: ${((article.keywords as any) || []).join(', ')}`,
    '',
    'Output: a high-resolution 16:9 banner image.',
  ].join('\n')

  const img = await geminiGenerateImagePng({
    prompt,
    aspectRatio: '16:9',
    imageSize: '2K',
    model: GEMINI_IMAGE_MODEL_DEFAULT,
  })

  const filename = `seo_${article.id}_${Date.now()}_banner.png`
  const saved = await saveBase64ToFile({ base64: img.dataBase64, filename, subdir: 'images' })
  const rec = await (prisma as any).seoImage.create({
    data: {
      articleId: article.id,
      kind: 'BANNER',
      title: '記事アイキャッチ',
      prompt,
      filePath: saved.relativePath,
      mimeType: img.mimeType || 'image/png',
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
    requestText ? `\nUser provided unique info (must respect):\n${requestText}` : '',
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

  const mergedSections = sections
    .map((s: any) => normalizeH2Heading(s.content || '', s.headingPath || `section_${s.index}`))
    .filter(Boolean)
    .join('\n\n')

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

  // LLMOの追加ブロック（短くてもOK、品質補助＆文字数補助）
  const llmoBlocks = await generateLlmoBlocks(article, mergedSections)
  if (llmoBlocks) parts.push(llmoBlocks)

  if (memo) {
    parts.push('<!-- AIっぽさメモ（次回リライト用） -->')
    parts.push(`<!-- ${clampText(memo, 1200)} -->`)
  }

  parts.push('## 本文')
  parts.push(mergedSections)

  // 目標文字数に足りない場合は、追補セクションを自動生成して埋める（最大5回）
  const target = Math.max(10000, Number(article.targetChars || 10000))
  for (let i = 0; i < 5; i++) {
    const cur = mdCharCount(parts.join('\n\n'))
    if (cur >= target * 0.95) break
    const need = Math.round(target * 0.98 - cur)
    const addPrompt = [
      'You are a Japanese SEO writer.',
      'Write an additional section to improve completeness and meet the target length.',
      'Do NOT copy from sources; add originality (experience, tradeoffs, failure cases, checklists).',
      'Return Markdown only and start with "## ".',
      '',
      `Article title: ${article.title}`,
      `Keywords: ${((article.keywords as any) || []).join(', ')}`,
      `Tone: ${article.tone}`,
      memo ? `User memo about AI-likeness:\n${clampText(memo, 900)}` : '',
      '',
      `Target chars for this additional section: ~${Math.min(3500, Math.max(1800, need))}`,
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

  const finalMarkdown = parts.join('\n\n')

  await p.seoArticle.update({
    where: { id: article.id },
    data: { finalMarkdown, status: 'DONE' },
  })

  if (isComparison) {
    // “校正・AI臭低減”を比較記事の明示ステップとして表示（実処理は統合の後段で自然に効く）
    await p.seoJob.update({ where: { id: jobId }, data: { step: 'cmp_polish', progress: 90, status: 'running' } })
  }

  // 自動で素材生成（バナー＋図解）: 失敗しても本文完成は優先する
  try {
    const canUseImages = await canUseSeoImagesForArticle(article)
    if (canUseImages) {
      await p.seoJob.update({ where: { id: jobId }, data: { step: 'media', progress: 92, status: 'running' } })

      // バナー生成
      const alreadyBanner = await p.seoImage.findFirst({
        where: { articleId: article.id, kind: 'BANNER' },
        select: { id: true },
      })
      if (!alreadyBanner) await autoGenerateBanner(article)

      // 図解生成（autoBundleが有効な場合）
      if (article.autoBundle !== false) {
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
  opts?: { maxUrls?: number }
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
      const extracted = await fetchAndExtract(url)
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
        `H2: ${extracted.headings.h2.join(' / ')}`,
        `H3: ${extracted.headings.h3.join(' / ')}`,
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
    } catch (e) {
      // 失敗しても他URLを継続
      console.warn(`[seo research] failed url=${url} at ${nowIso()}`)
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

    const afterOutline = await p.seoJob.findUnique({
      where: { id: jobId },
      include: { sections: true },
    })
    const remaining = (afterOutline?.sections || []).some((s: any) => s.status !== 'reviewed')

    if (remaining) {
      await generateSection(jobId)
      return { jobId }
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


