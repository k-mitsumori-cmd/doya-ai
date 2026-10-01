import { publicSeoJob } from '@seo/lib/job-response'
import { getSeoGenerationOwner } from '@/lib/seoArticleOwner'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

// ジョブが error / 途中失敗した場合でも、ユーザーがワンクリックでやり直せるようにする
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const owner = await getSeoGenerationOwner(_req)
    if (!owner) return NextResponse.json({ success: false, code: 'LOGIN_REQUIRED', error: 'この生成操作にはログインしてください。' }, { status: 401 })
    await ensureSeoSchema()
    const p = await ctx.params
    const id = p.id

    const job = await (prisma as any).seoJob.findFirst({
      where: { id, article: owner },
      include: { article: true },
    })
    if (!job) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    if (job.supersededAt) return NextResponse.json({ success: false, code: 'JOB_SUPERSEDED', error: 'このジョブは新しい生成に置き換えられました。記事画面から最新の生成状況を確認してください。' }, { status: 409 })
    if (job.status !== 'error') return NextResponse.json({ success: false, code: 'JOB_NOT_FAILED', error: '失敗したジョブだけやり直せます。記事を再生成する場合は記事画面から操作してください。' }, { status: 409 })

    const resetJob = await prisma.$transaction(async (tx) => {
      await tx.seoArticle.update({
        where: { id: job.articleId, ...owner },
        data: { status: 'RUNNING', outline: null, finalMarkdown: null },
      })
      await tx.seoSection.deleteMany({ where: { jobId: id } })
      return tx.seoJob.update({
        where: { id, article: owner, updatedAt: job.updatedAt, status: 'error', supersededAt: null },
        data: { executionToken: null, executionExpiresAt: null, status: 'queued', step: 'init', progress: 0, cursor: 0, error: null, startedAt: null, finishedAt: null },
      })
    })

    return NextResponse.json({ success: true, job: publicSeoJob(resetJob) })
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ success: false, error: 'ジョブの状態またはアクセス権が変わりました。再読み込みしてください。' }, { status: 409 })
    console.error('[seo jobs/[id]/reset/route.ts] failed')
    return NextResponse.json({ success: false, error: 'ジョブをやり直せませんでした。時間をおいて再試行してください。' }, { status: 500 })
  }
}
