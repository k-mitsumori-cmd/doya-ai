import { prisma } from '@/lib/prisma'
import { geminiGenerateJson, geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { fetchAndExtract } from '@seo/lib/extract'
import { SeoCreateArticleInput, SeoOutline, SeoOutlineSchema } from '@seo/lib/types'

function nowIso() {
  return new Date().toISOString()
}

function clampText(s: string, max = 12000): string {
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max)}\n...(truncated)` : s
}

function toOutlineMarkdown(outline: SeoOutline): string {
  const lines: string[] = []
  lines.push('# アウトライン')
  for (const [i, sec] of outline.sections.entries()) {
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
  const refs = await prisma.seoReference.findMany({
    where: { articleId },
    orderBy: { createdAt: 'asc' },
  })
  if (!refs.length) return ''

  const blocks = refs.map((r) => {
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

async function generateOutline(article: any, researchContext: string): Promise<SeoOutline> {
  const forbidden = Array.isArray(article.forbidden) ? article.forbidden : (article.forbidden as any) || []
  const keywords = Array.isArray(article.keywords) ? article.keywords : (article.keywords as any) || []

  const prompt = [
    'You are a Japanese SEO + LLMO expert editor.',
    'Goal: produce an outline that can scale to 50,000-60,000 Japanese chars without breaking.',
    'Do NOT copy text from sources. Only paraphrase insights.',
    'Output JSON with keys: sections, internalLinkIdeas, faq, glossary, diagramIdeas.',
    '',
    'Article requirements (Japanese):',
    `- Title: ${article.title}`,
    `- Keywords: ${(keywords as string[]).join(', ')}`,
    article.persona ? `- Persona: ${clampText(article.persona, 1200)}` : '',
    article.searchIntent ? `- Search intent: ${clampText(article.searchIntent, 1200)}` : '',
    `- Target chars: ${article.targetChars}`,
    `- Tone: ${article.tone}`,
    forbidden.length ? `- Forbidden: ${(forbidden as string[]).join(' / ')}` : '',
    '',
    'LLMO elements toggles:',
    llmoOptionsText(article),
    '',
    researchContext,
    '',
    'Constraints:',
    '- sections: 12-28 items (H2). Each plannedChars 1500-3000 (except intro/conclusion).',
    '- Add intentTag per section (e.g., 定義/比較/手順/事例/注意点/FAQ/用語).',
    '- Include E-E-A-T reinforcement sections (experience, decision tradeoffs, failure cases).',
    '- Include at least one: comparison table, checklist, step-by-step template.',
    '- Ensure headings are consistent and non-overlapping.',
    '',
    'JSON schema example:',
    '{ "sections":[{"h2":"...", "intentTag":"...", "plannedChars":2000, "h3":["..."], "h4":{"H3 title":["..."]}}], "internalLinkIdeas":["..."], "faq":["..."], "glossary":["..."], "diagramIdeas":[{"title":"...", "description":"...", "insertionHint":"..."}] }',
  ]
    .filter(Boolean)
    .join('\n')

  const raw = await geminiGenerateJson<SeoOutline>(
    {
      model: GEMINI_TEXT_MODEL_DEFAULT,
      prompt,
      generationConfig: { temperature: 0.3, maxOutputTokens: 6000 },
    },
    'JSON'
  )
  return SeoOutlineSchema.parse(raw)
}

async function ensureOutlineAndSections(jobId: string) {
  const job = await prisma.seoJob.findUnique({
    where: { id: jobId },
    include: { article: true },
  })
  if (!job) throw new Error('job not found')
  const article = job.article

  if (article.outline) return

  await prisma.seoJob.update({
    where: { id: jobId },
    data: { status: 'running', step: 'outline', startedAt: job.startedAt ?? new Date() },
  })
  await prisma.seoArticle.update({ where: { id: article.id }, data: { status: 'RUNNING' } })

  const researchContext = await buildResearchContext(article.id)
  const outline = await generateOutline(article, researchContext)
  const outlineMd = toOutlineMarkdown(outline)

  await prisma.seoArticle.update({
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
    plannedChars: Math.max(1200, Math.min(3200, Math.round((s.plannedChars || 2000) * ratio))),
    status: 'pending',
  }))

  await prisma.seoSection.createMany({ data: createData, skipDuplicates: true })

  // 差別化①: 導入文A/B案（ペルソナ別）
  const abPrompt = [
    'You are a Japanese copywriter for SEO intros.',
    'Create two different intro drafts (A/B) for the article.',
    'A: logical and business-like. B: friendly and story-driven.',
    'Each 250-400 Japanese chars. No exaggeration. Avoid generic AI tone.',
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
  await prisma.seoKnowledgeItem.create({
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
  const job = await prisma.seoJob.findUnique({
    where: { id: jobId },
    include: { article: true, sections: { orderBy: { index: 'asc' } } },
  })
  if (!job) throw new Error('job not found')

  const article = job.article
  const sections = job.sections
  const next = sections.find((s) => s.status !== 'reviewed')
  if (!next) return

  const prevSections = sections
    .filter((s) => s.index < next.index && s.content)
    .slice(-2)
    .map((s) => `# Prev section ${s.index}\n${clampText(s.content || '', 2200)}`)
    .join('\n\n')

  const outline = article.outline || ''
  const researchContext = await buildResearchContext(article.id)
  const forbidden = Array.isArray(article.forbidden) ? article.forbidden : (article.forbidden as any) || []

  const prompt = [
    'You are a Japanese SEO + LLMO expert writer.',
    'Write ONE section only in Japanese. Markdown output.',
    'Do NOT copy from sources; paraphrase ideas and add originality (experience, tradeoffs, examples, failure cases).',
    'Avoid "AIっぽい" generic filler. Be specific and practical.',
    '',
    `Article title: ${article.title}`,
    `Tone: ${article.tone}`,
    forbidden.length ? `Forbidden: ${(forbidden as string[]).join(' / ')}` : '',
    '',
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
    '- Include: concrete checklist/steps/examples where appropriate.',
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

  await prisma.seoSection.update({
    where: { id: next.id },
    data: {
      prompt,
      content: rewritten,
      consistency: issues.length ? `ISSUES:\n- ${issues.join('\n- ')}` : null,
      status: 'reviewed',
    },
  })

  const doneCount = sections.filter((s) => s.status === 'reviewed').length + 1
  const total = sections.length
  const progress = Math.min(75, Math.round((doneCount / Math.max(1, total)) * 70) + 15)

  await prisma.seoJob.update({
    where: { id: jobId },
    data: { cursor: next.index + 1, step: 'sections', status: 'running', progress },
  })
}

async function integrate(jobId: string) {
  const job = await prisma.seoJob.findUnique({
    where: { id: jobId },
    include: {
      article: { include: { memo: true } },
      sections: { orderBy: { index: 'asc' } },
    },
  })
  if (!job) throw new Error('job not found')
  const article = job.article
  const sections = job.sections
  const memo = article.memo?.content

  const merged = sections
    .map((s) => s.content || '')
    .filter(Boolean)
    .join('\n\n')

  const prompt = [
    'You are a Japanese chief editor for SEO + LLMO long-form articles.',
    'Integrate sections into ONE coherent Markdown article.',
    'Do NOT copy from sources. Keep originality.',
    'Unify tone and remove redundancy.',
    '',
    `Title: ${article.title}`,
    `Tone: ${article.tone}`,
    `Target chars: ${article.targetChars}`,
    memo ? `User memo about "AIっぽさ":\n${clampText(memo, 1200)}` : '',
    '',
    'LLMO elements toggles:',
    llmoOptionsText(article),
    '',
    'When ON, include these parts:',
    '- TL;DR at top (bullets)',
    '- conclusion first + reasons',
    '- FAQ (Q/A)',
    '- glossary',
    '- comparison table (markdown table)',
    '- "引用・根拠" section: paraphrased insights (no direct quotes)',
    '- practical templates: checklist, steps, copy-ready examples',
    '- "反論に答える" section',
    '',
    'Input sections (draft):',
    clampText(merged, 15000),
  ]
    .filter(Boolean)
    .join('\n')

  const finalMarkdown = await geminiGenerateText({
    model: GEMINI_TEXT_MODEL_DEFAULT,
    parts: [{ text: prompt }],
    generationConfig: { temperature: 0.35, maxOutputTokens: 8000 },
  })

  await prisma.seoArticle.update({
    where: { id: article.id },
    data: { finalMarkdown, status: 'DONE' },
  })

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
  await prisma.seoKnowledgeItem.create({
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
  await prisma.seoKnowledgeItem.create({
    data: {
      userId: article.userId,
      articleId: article.id,
      type: 'sns',
      title: 'SNS要約 & CTA案',
      content: sns,
      sourceUrls: article.referenceUrls as any,
    },
  })

  await prisma.seoJob.update({
    where: { id: jobId },
    data: { status: 'done', step: 'done', progress: 100, finishedAt: new Date() },
  })
}

export async function researchAndStore(articleId: string): Promise<{ stored: number }> {
  const article = await prisma.seoArticle.findUnique({ where: { id: articleId } })
  if (!article) throw new Error('article not found')

  const urls = (article.referenceUrls as any) as string[] | null
  const list = Array.isArray(urls) ? urls : []
  let stored = 0

  for (const url of list) {
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

      await prisma.seoReference.upsert({
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
      await prisma.seoKnowledgeItem.create({
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
  const job = await prisma.seoJob.findUnique({
    where: { id: jobId },
    include: { article: true, sections: true },
  })
  if (!job) throw new Error('job not found')
  if (job.status === 'done') return { jobId }

  try {
    await ensureOutlineAndSections(jobId)

    const afterOutline = await prisma.seoJob.findUnique({
      where: { id: jobId },
      include: { sections: true },
    })
    const remaining = (afterOutline?.sections || []).some((s) => s.status !== 'reviewed')

    if (remaining) {
      await generateSection(jobId)
      return { jobId }
    }

    await prisma.seoJob.update({ where: { id: jobId }, data: { step: 'integrate', progress: 85 } })
    await integrate(jobId)
    return { jobId }
  } catch (e: any) {
    await prisma.seoJob.update({
      where: { id: jobId },
      data: { status: 'error', error: e?.message || 'unknown error' },
    })
    await prisma.seoArticle.update({
      where: { id: job.articleId },
      data: { status: 'ERROR' },
    })
    throw e
  }
}


