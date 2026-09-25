import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * 完了時の画像をランダムに取得するAPI
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category') || 'thanks'
    const countRaw = searchParams.get('count') || '1'
    const count = Number(countRaw)
    if (category.length > 100 || !Number.isInteger(count) || count < 1 || count > 10) {
      return NextResponse.json({ error: '画像の取得条件を確認してください。' }, { status: 400 })
    }

    // 指定カテゴリの画像をランダムに取得
    const images = await prisma.swipeCelebrationImage.findMany({
      where: { category },
      take: 100,
      orderBy: { createdAt: 'desc' },
    })

    // ランダムに選択
    const selected = images.length > 0
      ? Array.from({ length: Math.min(count, images.length) }, () => {
          const randomIndex = Math.floor(Math.random() * images.length)
          return images[randomIndex]
        })
      : []

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
    console.error('[celebration-images] error:', error)
    return NextResponse.json(
      { error: '画像の読み込みに失敗しました。' },
      { status: 503 }
    )
  }
}
