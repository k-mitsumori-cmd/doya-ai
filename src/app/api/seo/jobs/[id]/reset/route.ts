import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

// ジョブが error / 途中失敗した場合でも、ユーザーがワンクリックでやり直せるようにする
export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const id = ctx.params.id

    const job = await (prisma as any).seoJob.findUnique({
      where: { id },
      include: { article: true },
    })
    if (!job) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })

    // 生成結果を作り直すため、アウトライン/最終稿/セクションをクリア
    await (prisma as any).seoSection.deleteMany({ where: { jobId: id } })

    await (prisma as any).seoArticle.update({
      where: { id: job.articleId },
      data: {
        status: 'RUNNING',
        outline: null,
        finalMarkdown: null,
      },
    })

    const resetJob = await (prisma as any).seoJob.update({
      where: { id },
      data: {
        status: 'queued',
        step: 'init',
        progress: 0,
        cursor: 0,
        error: null,
        startedAt: null,
        finishedAt: null,
      },
    })

    return NextResponse.json({ success: true, job: resetJob })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}


