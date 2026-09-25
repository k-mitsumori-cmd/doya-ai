import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSeoArticleOwner } from '@/lib/seoArticleOwner'

// PUT: セクションの内容を直接編集
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const params = await ctx.params
    const id = params.id
    const owner = await getSeoArticleOwner(req)
    if (!owner) return NextResponse.json({ success: false, error: 'ログインまたはゲスト認証が必要です' }, { status: 401 })
    const { content } = await req.json()
    if (typeof content !== 'string') return NextResponse.json({ success: false, error: '本文が不正です' }, { status: 400 })

    const section = await prisma.seoSection.findFirst({ where: { id, article: { is: owner } } })
    if (!section) {
      return NextResponse.json({ success: false, error: 'セクションが見つかりません' }, { status: 404 })
    }

    const updated = await prisma.seoSection.updateMany({
      where: { id, article: { is: owner } },
      data: {
        content: content || '',
        status: 'reviewed',
      },
    })
    if (updated.count !== 1) return NextResponse.json({ success: false, error: 'セクションが見つかりません' }, { status: 404 })

    // 記事の finalMarkdown も更新が必要な場合はここで行う
    // ただし、複雑になるため一旦スキップ（記事側で再統合を走らせる想定）

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[seo sections/[id]/route.ts] failed', e)
    return NextResponse.json({ success: false, error: 'セクションを保存できませんでした。時間をおいて再試行してください。' }, { status: 500 })
  }
}
