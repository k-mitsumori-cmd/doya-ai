import { prisma } from '@/lib/prisma'
import { geminiGenerateJson, geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'

function clampText(s: string, max = 14000): string {
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max)}\n...(truncated)` : s
}

export async function runSeoAudit(articleId: string): Promise<{ auditId: string }> {
  const article = await prisma.seoArticle.findUnique({
    where: { id: articleId },
    include: { references: true, memo: true },
  })
  if (!article) throw new Error('article not found')
  if (!article.finalMarkdown) throw new Error('finalMarkdown がありません（先に統合を完了してください）')

  const prompt = [
    'You are a strict Japanese SEO/LLMO quality auditor.',
    'Audit the article and point out concrete improvements.',
    'Output STRICT JSON only.',
    '',
    'JSON schema:',
    '{ "overallScore": 0-100, "issues": [{"category":"SEO|LLMO|E-E-A-T|論理|重複|具体例|検索意図|表現","severity":"high|mid|low","detail":"...","fix":"..."}], "missing": ["..."], "quickWins": ["..."] }',
    '',
    `Title: ${article.title}`,
    `Tone: ${article.tone}`,
    `Target chars: ${article.targetChars}`,
    article.memo?.content ? `User memo about "AIっぽさ":\n${clampText(article.memo.content, 1500)}` : '',
    '',
    'Article:',
    clampText(article.finalMarkdown, 15000),
  ]
    .filter(Boolean)
    .join('\n')

  const report = await geminiGenerateJson<any>({
    model: GEMINI_TEXT_MODEL_DEFAULT,
    prompt,
    generationConfig: { temperature: 0.2, maxOutputTokens: 2500 },
  })

  const audit = await prisma.seoAuditReport.create({
    data: {
      articleId,
      report: JSON.stringify(report, null, 2),
    },
  })

  return { auditId: audit.id }
}

export async function autoFixFromAudit(articleId: string, auditId?: string): Promise<void> {
  const article = await prisma.seoArticle.findUnique({
    where: { id: articleId },
    include: { memo: true, audits: { orderBy: { createdAt: 'desc' }, take: 1 } },
  })
  if (!article) throw new Error('article not found')
  if (!article.finalMarkdown) throw new Error('finalMarkdown がありません')

  const audit = auditId
    ? await prisma.seoAuditReport.findUnique({ where: { id: auditId } })
    : article.audits?.[0]
  if (!audit) throw new Error('audit がありません')

  const prompt = [
    'You are a Japanese chief editor.',
    'Rewrite the article to address audit issues while keeping meaning and structure.',
    'Remove redundancy, add concrete examples, add E-E-A-T and practical steps.',
    'Do NOT copy from sources.',
    '',
    article.memo?.content ? `User memo about "AIっぽさ":\n${clampText(article.memo.content, 1600)}` : '',
    '',
    'Audit report (JSON):',
    clampText(audit.report, 4000),
    '',
    'Original article:',
    clampText(article.finalMarkdown, 15000),
  ]
    .filter(Boolean)
    .join('\n')

  const rewritten = await geminiGenerateText({
    model: GEMINI_TEXT_MODEL_DEFAULT,
    parts: [{ text: prompt }],
    generationConfig: { temperature: 0.35, maxOutputTokens: 8000 },
  })

  await prisma.seoArticle.update({
    where: { id: articleId },
    data: { finalMarkdown: rewritten },
  })
}


