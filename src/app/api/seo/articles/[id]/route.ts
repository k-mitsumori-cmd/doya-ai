import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const id = ctx.params.id
    const article = await (prisma as any).seoArticle.findUnique({
      where: { id },
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
    return NextResponse.json({ success: true, article })
  } catch (e: any) {
    const msg = e?.message || '不明なエラー'
    console.error('[seo article get] failed', { articleId: ctx.params.id, msg })
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    )
  }
}
