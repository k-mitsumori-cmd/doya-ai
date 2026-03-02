import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PUT: セクションの内容を直接編集
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const params = 'then' in ctx.params ? await ctx.params : ctx.params
    const id = params.id
    const { content } = await req.json()

    const section = await prisma.seoSection.findUnique({ where: { id } })
    if (!section) {
      return NextResponse.json({ success: false, error: 'セクションが見つかりません' }, { status: 404 })
    }

    await prisma.seoSection.update({
      where: { id },
      data: {
        content: content || '',
        status: 'reviewed',
      },
    })

    // 記事の finalMarkdown も更新が必要な場合はここで行う
    // ただし、複雑になるため一旦スキップ（記事側で再統合を走らせる想定）

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}

