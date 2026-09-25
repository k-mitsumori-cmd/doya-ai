import { publicSeoJob } from '@seo/lib/job-response'
import { getSeoArticleOwner } from '@/lib/seoArticleOwner'
import { NextRequest, NextResponse } from 'next/server'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const owner = await getSeoArticleOwner(_req)
    if (!owner) return NextResponse.json({ success: false, error: 'ログインまたはゲスト認証が必要です' }, { status: 401 })
    await ensureSeoSchema()
    const params = await ctx.params
    const id = params.id
    const job = await (prisma as any).seoJob.findFirst({ where: { id, article: owner }, select: { id: true, status: true, supersededAt: true } })
    if (!job) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    if (job.supersededAt) return NextResponse.json({ success: false, code: 'JOB_SUPERSEDED', error: 'このジョブは新しい生成に置き換えられました。記事画面から最新の生成状況を確認してください。' }, { status: 409 })
    if (job.status === 'done') return NextResponse.json({ success: true, job })

    const updated = await (prisma as any).seoJob.update({
      where: { id, article: owner, status: job.status, supersededAt: null },
      data: { status: 'queued', executionToken: null, executionExpiresAt: null },
    })
    return NextResponse.json({ success: true, job: publicSeoJob(updated) })
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ success: false, error: 'ジョブの状態またはアクセス権が変わりました。再読み込みしてください。' }, { status: 409 })
    console.error('[seo jobs/[id]/resume/route.ts] failed', e)
    return NextResponse.json({ success: false, error: 'ジョブを再開できませんでした。時間をおいて再試行してください。' }, { status: 500 })
  }
}


