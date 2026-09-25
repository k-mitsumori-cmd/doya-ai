import { getSeoArticleOwner } from '@/lib/seoArticleOwner'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * バナー候補から1枚を「メイン」に設定するAPI
 * createdAtを現在時刻に更新して最新にする（フロントの bannerImageId ロジックが最新を取得）
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const params = await ctx.params
  const articleId = params.id

  try {
    const owner = await getSeoArticleOwner(req)
    if (!owner) return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    const body = await req.json()
    const imageId = String(body.imageId || '')
    if (!imageId) {
      return NextResponse.json({ success: false, error: 'imageId is required' }, { status: 400 })
    }

    // 対象画像が存在し、この記事のBANNERであることを確認
    const image = await (prisma as any).seoImage.findFirst({
      where: { id: imageId, articleId, kind: 'BANNER', article: owner },
    })
    if (!image) {
      return NextResponse.json({ success: false, error: 'Banner not found' }, { status: 404 })
    }

    // createdAtを現在時刻に更新して「最新」にする
    await (prisma as any).seoImage.update({
      where: { id: imageId, articleId, kind: 'BANNER', article: owner },
      data: { createdAt: new Date() },
    })

    return NextResponse.json({ success: true, selectedId: imageId })
  } catch (e: any) {
    console.error('[select-banner] error:', e?.message)
    return NextResponse.json({ success: false, error: 'バナーを選択できませんでした。時間をおいて再試行してください。' }, { status: 500 })
  }
}
