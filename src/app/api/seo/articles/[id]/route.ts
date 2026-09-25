import { publicSeoJob } from '@seo/lib/job-response'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { getSeoArticleOwner } from '@/lib/seoArticleOwner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const id = params.id
  
  try {
    const owner = await getSeoArticleOwner(_req)
    if (!owner) return NextResponse.json({ success: false, error: 'ログインまたはゲスト認証が必要です' }, { status: 401 })
    await ensureSeoSchema()
    const article = await prisma.seoArticle.findFirst({
      where: { id, ...owner },
      include: {
        jobs: { orderBy: { createdAt: 'desc' } },
        sections: { orderBy: { index: 'asc' } },
        references: { orderBy: { createdAt: 'asc' } },
        audits: { orderBy: { createdAt: 'desc' }, take: 3 },
        memo: true,
        images: { orderBy: { createdAt: 'desc' } },
        linkChecks: { orderBy: { checkedAt: 'desc' }, take: 200 },
        knowledgeItems: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    })
    if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    // 比較記事の場合は候補数も含める
    const comparisonCandidates = Array.isArray(article.comparisonCandidates) ? article.comparisonCandidates : []
    const comparisonConfig = article.comparisonConfig || null
    const comparisonCount = comparisonCandidates.length

    return NextResponse.json({
      success: true,
      article: {
        ...article,
        jobs: (article.jobs || []).map(publicSeoJob),
        comparisonCount,
        comparisonCandidates,
        comparisonConfig,
      },
    })
  } catch (e: any) {
    const msg = e?.message || '不明なエラー'
    console.error('[seo article get] failed', { articleId: id, msg, error: e })
    return NextResponse.json(
      { success: false, error: '記事の操作に失敗しました。時間をおいて再試行してください。' },
      { status: 500 }
    )
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const id = params.id

  try {
    const owner = await getSeoArticleOwner(_req)
    if (!owner) return NextResponse.json({ success: false, error: 'ログインまたはゲスト認証が必要です' }, { status: 401 })
    await ensureSeoSchema()
    await prisma.$transaction(async (tx) => {
      // Lock the owned parent before deleting children; a concurrent claim must serialize here.
      await tx.seoArticle.update({ where: { id, ...owner }, data: { updatedAt: new Date() }, select: { id: true } })
      await tx.seoJob.deleteMany({ where: { articleId: id } })
      await tx.seoSection.deleteMany({ where: { articleId: id } })
      await tx.seoReference.deleteMany({ where: { articleId: id } })
      await tx.seoAuditReport.deleteMany({ where: { articleId: id } })
      await tx.seoUserMemo.deleteMany({ where: { articleId: id } })
      await tx.seoImage.deleteMany({ where: { articleId: id } })
      await tx.seoLinkCheckResult.deleteMany({ where: { articleId: id } })
      await tx.seoKnowledgeItem.deleteMany({ where: { articleId: id } })
      await tx.seoArticle.delete({ where: { id, ...owner } })
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ success: false, error: '記事が見つかりません' }, { status: 404 })
    const msg = e?.message || '不明なエラー'
    console.error('[seo article delete] failed', { articleId: id, msg, error: e })
    return NextResponse.json(
      { success: false, error: '記事の操作に失敗しました。時間をおいて再試行してください。' },
      { status: 500 }
    )
  }
}
