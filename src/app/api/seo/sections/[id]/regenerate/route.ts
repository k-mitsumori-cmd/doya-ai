import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const id = ctx.params.id
    const section = await prisma.seoSection.findUnique({ where: { id } })
    if (!section) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })

    await prisma.seoSection.update({
      where: { id },
      data: {
        status: 'pending',
        content: null,
        consistency: null,
        error: null,
      },
    })

    // もしジョブがエラーで止まっていたら、再開できるようにqueuedへ戻す（error文は残す）
    if (section.jobId) {
      const job = await prisma.seoJob.findUnique({ where: { id: section.jobId } })
      if (job?.status === 'error') {
        await prisma.seoJob.update({
          where: { id: job.id },
          data: { status: 'queued', step: 'sections' },
        })
        await prisma.seoArticle.update({
          where: { id: section.articleId },
          data: { status: 'RUNNING' },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}


