import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id
  const article = await prisma.seoArticle.findUnique({
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
}


