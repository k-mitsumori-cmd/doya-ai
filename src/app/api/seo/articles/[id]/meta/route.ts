import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { generateSeoMeta } from '@seo/lib/meta'

export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const id = ctx.params.id
    const article = await (prisma as any).seoArticle.findUnique({ where: { id } })
    if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })

    const meta = await generateSeoMeta({
      title: article.title,
      keywords: (article.keywords || []) as string[],
      markdown: article.finalMarkdown || article.outline || '',
    })

    const item = await (prisma as any).seoKnowledgeItem.create({
      data: {
        userId: article.userId,
        articleId: article.id,
        type: 'meta',
        title: 'メタ情報（title/description/slug/OG）',
        content: JSON.stringify(meta, null, 2),
        sourceUrls: article.referenceUrls as any,
      },
    })

    return NextResponse.json({ success: true, meta, itemId: item.id })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}



