// POST /api/shanai/interviews/[id]/article — 確認済みの事実から記事を生成（新しい版を作る。利用枠を1回使う）
// PUT  { articleId, title, lead, catchphrase, blocks } — 編集内容の保存
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShanaiUserId, json, notFound, quotaExceeded, unauthorized } from '@/lib/shanai/access'
import { draftArticle } from '@/lib/shanai/article-service'
import { articleDto } from '@/lib/shanai/dto'
import { sanitizeBlocks } from '@/lib/shanai/generate'
import { clip, isCuid } from '@/lib/shanai/types'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const userId = await getShanaiUserId()
  if (!userId) return unauthorized()
  if (!isCuid(id)) return notFound()
  const result = await draftArticle(userId, id)
  if (result.ok) return json({ success: true, article: result.article })
  if (result.reason === 'quota') return quotaExceeded(result.quota)
  if (result.reason === 'not_found') return notFound()
  return json({ error: result.message }, result.reason === 'not_enough_facts' ? 400 : 500)
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
