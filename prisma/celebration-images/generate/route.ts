import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'

/**
 * 完了時の画像を大量生成して保存するAPI
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { count = 20 } = body // デフォルト20枚生成

    const categories = [
      { category: 'thanks', prompts: [
        'ありがとうございました、感謝の気持ちを表現した、温かみのあるイラスト、日本のデザイン、優しい色合い、ハートや花のモチーフ',
        'お疲れ様でした、達成感を表現した、明るいイラスト、日本のデザイン、ポップな色合い、星や花火のモチーフ',
        'ご協力ありがとうございます、感謝を表現した、和風のイラスト、日本のデザイン、落ち着いた色合い、桜や紅葉のモチーフ',
        'ありがとうございました、成功を祝福する、カラフルなイラスト、日本のデザイン、グラデーション、花や蝶のモチーフ',
        'お疲れ様でした、完成を祝う、楽しいイラスト、日本のデザイン、明るい色合い、風船やリボンのモチーフ',
      ]},
      { category: 'completion', prompts: [
        '記事作成完了、達成感を表現した、明るいイラスト、日本のデザイン、ポップな色合い、チェックマークや星のモチーフ',
        '完成おめでとうございます、成功を祝う、カラフルなイラスト、日本のデザイン、グラデーション、花火や風船のモチーフ',
        '記事が完成しました、喜びを表現した、温かみのあるイラスト、日本のデザイン、優しい色合い、ハートや花のモチーフ',
        'お疲れ様でした、達成を祝う、明るいイラスト、日本のデザイン、ポップな色合い、星やリボンのモチーフ',
        '完成です、成功を表現した、カラフルなイラスト、日本のデザイン、グラデーション、花や蝶のモチーフ',
      ]},
      { category: 'article', prompts: [
        '記事ができました、達成感を表現した、明るいイラスト、日本のデザイン、ポップな色合い、本やペンのモチーフ',
        '記事作成完了、成功を祝う、カラフルなイラスト、日本のデザイン、グラデーション、紙やインクのモチーフ',
        '記事が完成しました、喜びを表現した、温かみのあるイラスト、日本のデザイン、優しい色合い、本や星のモチーフ',
        '記事作成お疲れ様でした、達成を祝う、明るいイラスト、日本のデザイン、ポップな色合い、ペンやチェックマークのモチーフ',
        '記事ができました、成功を表現した、カラフルなイラスト、日本のデザイン、グラデーション、本や花のモチーフ',
      ]},
    ]

    const generated: any[] = []
    let generatedCount = 0

    for (const cat of categories) {
      for (const prompt of cat.prompts) {
        if (generatedCount >= count) break

        try {
          const result = await geminiGenerateImagePng({
            prompt,
            aspectRatio: '16:9',
            imageSize: '2K',
            model: GEMINI_IMAGE_MODEL_DEFAULT,
          })

          const saved = await prisma.swipeCelebrationImage.create({
            data: {
              category: cat.category,
              prompt,
              imageBase64: result.dataBase64,
              mimeType: result.mimeType,
              width: 1920,
              height: 1080,
            },
          })

          generated.push({ id: saved.id, category: saved.category })
          generatedCount++

          // レート制限対策: 少し待機
          await new Promise(resolve => setTimeout(resolve, 2000))
        } catch (e: any) {
          console.error(`[celebration-image] Failed to generate for category ${cat.category}:`, e.message)
        }
      }
      if (generatedCount >= count) break
    }

    return NextResponse.json({
      success: true,
      generated: generated.length,
      images: generated,
    })
  } catch (error: any) {
    console.error('[celebration-images/generate] error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
