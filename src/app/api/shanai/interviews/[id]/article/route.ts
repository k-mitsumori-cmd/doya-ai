// POST /api/shanai/interviews/[id]/article — 確認済みの事実から記事を生成（新しい版を作る。利用枠を1回使う）
// PUT  { articleId, title, lead, catchphrase, blocks } — 編集内容の保存
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShanaiUserId, json, notFound, ownInterview, quotaExceeded, releaseArticle, reserveArticle, unauthorized } from '@/lib/shanai/access'
import { articleDto } from '@/lib/shanai/dto'
import { generateArticle, sanitizeBlocks } from '@/lib/shanai/generate'
import { clip, isCuid, type ShanaiPurpose, type ShanaiTone } from '@/lib/shanai/types'
import { recordServiceUsage } from '@/lib/service-usage'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const userId = await getShanaiUserId()
  if (!userId) return unauthorized()
  if (!isCuid(id)) return notFound()
  const interview = await prisma.shanaiInterview.findFirst({
    where: ownInterview(userId, id),
    include: { facts: { where: { approved: true }, orderBy: { sortOrder: 'asc' } } },
  })
  if (!interview) return notFound()
  const personFacts = interview.facts.filter((f) => f.sourceType !== 'company')
  if (personFacts.length < 5) return json({ error: '記事にするには、確認済みの事実が5件以上必要です。先に事実を抽出・確認してください。' }, 400)

  // ⚠️ 枠の確保は LLM 呼び出しの前。失敗したら行を消して枠を戻す
  const reserved = await reserveArticle(userId, id)
  if (!reserved.ok) return quotaExceeded(reserved.quota)

  try {
    const company = await prisma.shanaiCompany.findUnique({ where: { userId }, include: { sources: { select: { id: true, label: true, url: true } } } })
    const serviceIds = new Set((interview.serviceSourceIds as unknown as string[]) || [])
    const serviceNames = (company?.sources || []).filter((s) => serviceIds.has(s.id)).map((s) => s.label || new URL(s.url).hostname)

    const article = await generateArticle({
      companyName: company?.name || '',
      intervieweeName: interview.intervieweeName,
      department: interview.department,
      position: interview.position,
      joinYear: interview.joinYear,
      purpose: interview.purpose as ShanaiPurpose,
      tone: interview.tone as ShanaiTone,
      roleInService: interview.roleInService,
      serviceNames,
      facts: interview.facts.map((f) => ({ id: f.id, sourceType: f.sourceType, category: f.category, statement: f.statement, quote: f.quote })),
    })

    const saved = await prisma.shanaiArticle.update({
      where: { id: reserved.articleId },
      data: { title: article.title, lead: article.lead, catchphrase: article.catchphrase, blocks: article.blocks as any, model: 'default' },
    })
    await prisma.shanaiInterview.update({ where: { id }, data: { status: 'DONE' } })
    void recordServiceUsage({
      userId,
      serviceId: 'shanai',
      action: '社内インタビュー記事を生成',
      summary: article.title,
      metadata: { version: reserved.version, blocks: article.blocks.length, unsupported: article.blocks.filter((b) => b.unsupported).length },
    })
    return json({ success: true, article: articleDto(saved) })
  } catch (e) {
    console.error('[shanai/article][POST] failed', (e as Error)?.name)
    await releaseArticle(reserved.articleId).catch(() => {})
    return json({ error: '記事の生成に失敗しました。利用回数は消費していません。時間をおいてもう一度お試しください。' }, 500)
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    if (!isCuid(id)) return notFound()
    const body = await req.json().catch(() => ({}))
    if (!isCuid(body.articleId)) return json({ error: '記事が指定されていません。' }, 400)
    const article = await prisma.shanaiArticle.findFirst({ where: { id: body.articleId, interviewId: id, userId } })
    if (!article) return notFound()
    const facts = await prisma.shanaiFact.findMany({ where: { interviewId: id }, select: { id: true } })
    const blocks = sanitizeBlocks(body.blocks, new Set(facts.map((f) => f.id)))
    const saved = await prisma.shanaiArticle.update({
      where: { id: article.id },
      data: {
        title: clip(body.title, 120) || article.title,
        lead: clip(body.lead, 2000),
        catchphrase: clip(body.catchphrase, 40),
        blocks: blocks as any,
      },
    })
    return json({ success: true, article: articleDto(saved) })
  } catch (e) {
    console.error('[shanai/article][PUT] failed', (e as Error)?.name)
    return json({ error: '記事の保存に失敗しました。' }, 500)
  }
}
