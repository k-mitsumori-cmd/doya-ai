import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SeoCreateArticleInputSchema } from '@seo/lib/types'

export async function GET() {
  const articles = await prisma.seoArticle.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      jobs: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })
  return NextResponse.json({ success: true, articles })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = SeoCreateArticleInputSchema.parse(body)

    const article = await prisma.seoArticle.create({
      data: {
        status: 'DRAFT',
        title: input.title,
        keywords: input.keywords as any,
        persona: input.persona || null,
        searchIntent: input.searchIntent || null,
        targetChars: input.targetChars,
        tone: input.tone,
        forbidden: input.forbidden as any,
        referenceUrls: input.referenceUrls as any,
        llmoOptions: (input.llmoOptions ?? undefined) as any,
      },
    })

    const job = await prisma.seoJob.create({
      data: { articleId: article.id, status: 'queued', step: 'init', progress: 0 },
    })

    return NextResponse.json({ success: true, articleId: article.id, jobId: job.id })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 400 }
    )
  }
}


