import { NextRequest, NextResponse } from 'next/server'
import { generateBanners } from '@/lib/nanobanner'

export async function POST(req: NextRequest) {
  try {
    const { featureName, description } = await req.json()

    if (!featureName) {
      return NextResponse.json({ error: 'featureName is required' }, { status: 400 })
    }

    // nanobannerを使用してガイド画像を生成
    // ガイド画像なので、purposeを 'display' にし、業種を 'it' に設定
    const result = await generateBanners(
      'it', 
      featureName, 
      '1200x630', 
      {
        purpose: 'display',
        imageDescription: description || `${featureName}機能の使い方を説明するクリーンなIT系バナー`,
      }
    )

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // 最初の一枚をガイド画像として返す
    return NextResponse.json({ imageUrl: result.banners[0] })
  } catch (error: any) {
    console.error('Guide image generation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}


