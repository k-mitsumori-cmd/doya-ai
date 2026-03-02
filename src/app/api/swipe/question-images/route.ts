import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const FALLBACK_IMAGES = [
  '/banner-samples/cat-marketing.png',
  '/banner-samples/cat-it.png',
  '/banner-samples/cat-education.png',
  '/banner-samples/cat-finance.png',
  '/banner-samples/cat-ec.png',
  '/banner-samples/cat-other.png',
  '/banner-samples/purpose-display.png',
  '/banner-samples/purpose-lp_hero.png',
  '/banner-samples/purpose-sns_ad.png',
] as const

function hashString(input: string) {
  // simple deterministic hash (no crypto) for stable image selection
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function pickFallbackUrls(category: string, count: number) {
  const key = String(category || '').toLowerCase()
  const pool: string[] = []

  if (key.includes('seo') || key.includes('検索') || key.includes('競合')) pool.push('/banner-samples/cat-it.png')
  if (key.includes('読者') || key.includes('ターゲット') || key.includes('ペルソナ')) pool.push('/banner-samples/cat-marketing.png')
  if (key.includes('料金') || key.includes('価格') || key.includes('プラン')) pool.push('/banner-samples/cat-finance.png')
  if (key.includes('記事') || key.includes('構成') || key.includes('見出し')) pool.push('/banner-samples/purpose-lp_hero.png')

  if (pool.length === 0) pool.push(...FALLBACK_IMAGES)

  const start = hashString(category) % pool.length
  const out: string[] = []
  for (let i = 0; i < Math.max(1, count); i++) {
    out.push(pool[(start + i) % pool.length])
  }
  return out
}

/**
 * 質問用の画像をランダムに取得するAPI
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category') || '確認'
    const count = parseInt(searchParams.get('count') || '1', 10)

    // 指定カテゴリの画像をランダムに取得（キャッシュを有効活用）
    let images = await prisma.swipeQuestionImage.findMany({
      where: { category },
      take: 100, // より多くの候補から選択
      orderBy: { createdAt: 'desc' },
    })

    // カテゴリに画像がない場合、デフォルトカテゴリ（'確認'）から取得を試みる
    if (images.length === 0 && category !== '確認') {
      images = await prisma.swipeQuestionImage.findMany({
        where: { category: '確認' },
        take: 100,
        orderBy: { createdAt: 'desc' },
      })
    }

    // それでも画像がない場合、全カテゴリから取得
    if (images.length === 0) {
      images = await prisma.swipeQuestionImage.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
      })
    }

    // ランダムに選択（より効率的な方法）
    const selected = images.length > 0
      ? Array.from({ length: Math.min(count, images.length) }, () => {
          const randomIndex = Math.floor(Math.random() * images.length)
          return images[randomIndex]
        })
      : []

    // DBに画像がない場合は空を返す（既存の画像は使わない）
    if (selected.length === 0) {
      console.warn(`[question-images] No images found for category: ${category}`)
      return NextResponse.json({
        success: true,
        images: [], // フォールバック画像は使わない
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
