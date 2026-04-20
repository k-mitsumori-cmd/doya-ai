import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * 質問用の画像をランダムに取得するAPI
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category') || '確認'
    const count = parseInt(searchParams.get('count') || '1', 10)

    // 指定カテゴリの画像をランダムに取得
    const images = await prisma.swipeQuestionImage.findMany({
      where: { category },
      take: count * 3, // 余裕を持って取得
      orderBy: { createdAt: 'desc' },
    })

    // ランダムに選択
    const shuffled = images.sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, count)

    // 画像がない場合は空を返す
    if (selected.length === 0) {
      return NextResponse.json({
        success: true,
        images: [],
      })
    }

    return NextResponse.json({
      success: true,
      images: selected.map(img => ({
        id: img.id,
        category: img.category,
        imageBase64: img.imageBase64,
        mimeType: img.mimeType,
      })),
    })
  } catch (error: any) {
    console.error('[question-images] error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
