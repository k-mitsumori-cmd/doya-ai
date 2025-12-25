import { NextResponse } from 'next/server'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const id = ctx.params.id
    const job = await (prisma as any).seoJob.findUnique({ where: { id }, select: { id: true, status: true, articleId: true } })
    if (!job) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    if (job.status === 'done') return NextResponse.json({ success: true, job })

    const updated = await (prisma as any).seoJob.update({
      where: { id },
      data: { status: 'cancelled', error: 'cancelled by user', finishedAt: new Date() },
    })
    await (prisma as any).seoArticle.update({
      where: { id: job.articleId },
      data: { status: 'ERROR' },
    })

    return NextResponse.json({ success: true, job: updated })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}


