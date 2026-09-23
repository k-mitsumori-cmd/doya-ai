import { publicSeoJob } from '@seo/lib/job-response'
import { getSeoArticleOwner } from '@/lib/seoArticleOwner'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

// ジョブが error / 途中失敗した場合でも、ユーザーがワンクリックでやり直せるようにする
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const owner = await getSeoArticleOwner(_req)
    if (!owner) return NextResponse.json({ success: false, error: 'ログインまたはゲスト認証が必要です' }, { status: 401 })
    await ensureSeoSchema()
    const p = await ctx.params
    const id = p.id

    const job = await (prisma as any).seoJob.findFirst({
      where: { id, article: owner },
      include: { article: true },
    })
    if (!job) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    if (job.supersededAt) return NextResponse.json({ success: false, code: 'JOB_SUPERSEDED', error: 'このジョブは新しい生成に置き換えられました。記事画面から最新の生成状況を確認してください。' }, { status: 409 })

    const resetJob = await prisma.$transaction(async (tx) => {
      await tx.seoArticle.update({
        where: { id: job.articleId, ...owner },
        data: { status: 'RUNNING', outline: null, finalMarkdown: null },
      })
      await tx.seoSection.deleteMany({ where: { jobId: id } })
      return tx.seoJob.update({
        where: { id, article: owner, updatedAt: job.updatedAt, supersededAt: null },
        data: { executionToken: null, executionExpiresAt: null, status: 'queued', step: 'init', progress: 0, cursor: 0, error: null, startedAt: null, finishedAt: null },
      })
    })

    return NextResponse.json({ success: true, job: publicSeoJob(resetJob) })
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ success: false, error: 'ジョブの状態またはアクセス権が変わりました。再読み込みしてください。' }, { status: 409 })
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}


