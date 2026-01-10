import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { getGuestIdFromRequest } from '@/lib/seoAccess'
import { z } from 'zod'
import { advanceSeoJob } from '@seo/lib/pipeline'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  autoStart: z.boolean().optional(),
  resetSections: z.boolean().optional(),
})

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const params = 'then' in ctx.params ? await ctx.params : ctx.params
  const id = params.id
  
  try {
    await ensureSeoSchema()
    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    const userId = String(user?.id || '').trim()
    const guestId = !userId ? getGuestIdFromRequest(req) : null
    
    // 記事の存在確認と所有者チェック
    const article = await (prisma as any).seoArticle.findUnique({
      where: { id },
      include: { jobs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })
    if (!article) {
      return NextResponse.json({ success: false, error: '記事が見つかりません' }, { status: 404 })
    }
    if (userId) {
      if (String(article.userId || '') !== userId) {
        return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 })
      }
    } else {
      if (!guestId || String(article.guestId || '') !== guestId) {
        return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 })
      }
    }
    
    const body = BodySchema.parse(await req.json())
    
    // セクションのリセット
    if (body.resetSections) {
      await (prisma as any).seoSection.deleteMany({
        where: { articleId: id },
      })
      await (prisma as any).seoArticle.update({
        where: { id },
        data: { status: 'DRAFT' },
      })
    }
    
    // ジョブの自動作成または既存ジョブの進行
    let job = article.jobs?.[0]
    if (!job || job.status === 'done' || job.status === 'error') {
      job = await (prisma as any).seoJob.create({
        data: { articleId: id, status: 'queued', step: 'init', progress: 0 },
      })
      await (prisma as any).seoArticle.update({
        where: { id },
        data: { status: 'RUNNING' },
      })
    }
    
    // 自動開始が有効な場合、ジョブを進行
    if (body.autoStart !== false && job.status === 'queued') {
      await advanceSeoJob(job.id)
    }
    
    return NextResponse.json({ success: true, jobId: job.id })
  } catch (e: any) {
    // バリデーションエラーの詳細を返す
    if (e?.name === 'ZodError') {
      const issues = e.issues?.map((issue: any) => ({
        path: issue.path?.join('.') || 'unknown',
        message: issue.message,
        code: issue.code,
      })) || []
      console.error('[seo jobs] validation error', { articleId: id, issues })
      return NextResponse.json(
        { success: false, error: 'バリデーションエラー', details: issues },
        { status: 400 }
      )
    }
    console.error('[seo jobs] failed', { articleId: id, error: e?.message || 'unknown error', stack: e?.stack })
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 500 }
    )
  }
}
