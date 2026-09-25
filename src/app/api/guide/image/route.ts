import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-guard'
import { generateBanners } from '@/lib/nanobanner'

export const runtime = 'nodejs'
export const maxDuration = 120

const BodySchema = z.object({
  featureName: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
})

export async function POST(req: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const { featureName, description } = BodySchema.parse(await req.json())

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

    if (result.error || !result.banners?.[0]) {
      console.error('[guide image] generation failed', result.error || 'empty image')
      return NextResponse.json({ error: 'ガイド画像を生成できませんでした。時間をおいて再試行してください。' }, { status: 502 })
    }

    // 最初の一枚をガイド画像として返す
    return NextResponse.json({ imageUrl: result.banners[0] })
  } catch (error: any) {
    if (error?.name === 'ZodError' || error instanceof SyntaxError) {
      return NextResponse.json({ error: '入力形式が正しくありません' }, { status: 400 })
    }
    console.error('Guide image generation error:', error)
    return NextResponse.json({ error: 'ガイド画像を生成できませんでした。時間をおいて再試行してください。' }, { status: 500 })
  }
}

