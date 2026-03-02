import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { geminiGenerateImagePng, GEMINI_IMAGE_MODEL_DEFAULT } from '@seo/lib/gemini'

/**
 * 質問用の画像を生成して保存するAPI
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { count = 30 } = body // デフォルト30枚生成

    // 質問カテゴリに応じた画像プロンプト
    const categoryPrompts: Record<string, string[]> = {
      '記事の方向性': [
        '記事の方向性を表現した、明るく前向きなイラスト、日本のデザイン、ポップな色合い、矢印や道のモチーフ',
        '記事の方向性を表現した、カラフルなイラスト、日本のデザイン、グラデーション、コンパスや地図のモチーフ',
        '記事の方向性を表現した、温かみのあるイラスト、日本のデザイン、優しい色合い、星や光のモチーフ',
      ],
      '記事タイプ': [
        '記事タイプを表現した、多様性のあるイラスト、日本のデザイン、ポップな色合い、本や文書のモチーフ',
        '記事タイプを表現した、カラフルなイラスト、日本のデザイン、グラデーション、様々なアイコンのモチーフ',
        '記事タイプを表現した、明るいイラスト、日本のデザイン、鮮やかな色合い、タグやカテゴリのモチーフ',
      ],
      'ターゲット読者': [
        'ターゲット読者を表現した、親しみやすいイラスト、日本のデザイン、温かみのある色合い、人々のシルエットのモチーフ',
        'ターゲット読者を表現した、多様性のあるイラスト、日本のデザイン、カラフルな色合い、様々な人のモチーフ',
        'ターゲット読者を表現した、明るいイラスト、日本のデザイン、ポップな色合い、コミュニティのモチーフ',
      ],
      '記事の長さ': [
        '記事の長さを表現した、シンプルで分かりやすいイラスト、日本のデザイン、クリーンな色合い、尺や長さのモチーフ',
        '記事の長さを表現した、カラフルなイラスト、日本のデザイン、グラデーション、バーやメーターのモチーフ',
        '記事の長さを表現した、明るいイラスト、日本のデザイン、ポップな色合い、進捗や成長のモチーフ',
      ],
      '確認': [
        '確認を表現した、信頼感のあるイラスト、日本のデザイン、落ち着いた色合い、チェックマークや承認のモチーフ',
        '確認を表現した、明るいイラスト、日本のデザイン、ポップな色合い、OKサインや承認のモチーフ',
        '確認を表現した、カラフルなイラスト、日本のデザイン、グラデーション、承認や確認のモチーフ',
      ],
    }

    const generated: any[] = []
    let generatedCount = 0

    for (const [category, prompts] of Object.entries(categoryPrompts)) {
      for (const prompt of prompts) {
        if (generatedCount >= count) break

        try {
          const result = await geminiGenerateImagePng({
            prompt,
            aspectRatio: '16:9',
            imageSize: '2K',
            model: GEMINI_IMAGE_MODEL_DEFAULT,
          })

          const saved = await prisma.swipeQuestionImage.create({
            data: {
              category,
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
          console.error(`[question-image] Failed to generate for category ${category}:`, e.message)
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
    console.error('[question-images/generate] error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
