import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * 完了時の画像をランダムに取得するAPI
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category') || 'thanks'
    const count = parseInt(searchParams.get('count') || '1', 10)

    // 指定カテゴリの画像をランダムに取得
    const images = await prisma.swipeCelebrationImage.findMany({
      where: { category },
      take: count * 3, // 余裕を持って取得
      orderBy: { createdAt: 'desc' },
    })

    // ランダムに選択
    const shuffled = images.sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, count)

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
    console.error('[celebration-images] error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
