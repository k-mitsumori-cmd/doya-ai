import { publicSeoJob } from '@seo/lib/job-response'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { getSeoArticleOwner } from '@/lib/seoArticleOwner'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const owner = await getSeoArticleOwner(_req)
    if (!owner) return NextResponse.json({ success: false, error: 'ログインまたはゲスト認証が必要です' }, { status: 401 })
    await ensureSeoSchema()
    const id = (await ctx.params).id
    const job = await prisma.seoJob.findFirst({
      where: { id, article: owner },
      include: {
        article: true,
        sections: { orderBy: { index: 'asc' } },
      },
    })
    if (!job) {
      console.log('[seo job get] job not found in DB', { jobId: id })
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    }
    // リサーチ実況用：直近の要約/抽出結果（SeoReference）を返す
    // NOTE: extractedTextは巨大なので返さない
    let references: any[] = []
    try {
      references = await (prisma as any).seoReference.findMany({
        where: { articleId: job.articleId },
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: {
          url: true,
          title: true,
          summary: true,
          headings: true,
          insights: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    } catch {
      references = []
    }

    const jobWithRefs = { ...job, references }
    return NextResponse.json({ success: true, job: publicSeoJob(jobWithRefs) })
  } catch (e: any) {
    const msg = e?.message || '不明なエラー'
    console.error('[seo job get] failed', { msg })
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    )
  }
}
