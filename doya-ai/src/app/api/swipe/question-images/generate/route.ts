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

    // 質問カテゴリに応じたアイコン風画像プロンプト（テキストなし）
    // Gemini 3.0 Nano Banana Proで生成（テキストを含めないように明示的に指定）
    const categoryPrompts: Record<string, string[]> = {
      '記事の種類': [
        'シンプルなアイコン風イラスト、矢印が曲がりながら進む方向性を示す、日本のデザイン、ポップな色合い、テキストなし、アイコンのみ',
        'アイコン風デザイン、コンパスや方向を示すモチーフ、日本のデザイン、カラフルなグラデーション、テキストなし、アイコンのみ',
        'シンプルなアイコン、星や光のモチーフで方向性を表現、日本のデザイン、優しい色合い、テキストなし、アイコンのみ',
      ],
      '記事の方向性': [
        'アイコン風イラスト、矢印が曲がりながら進む方向性を示す、日本のデザイン、ポップな色合い、テキストなし、アイコンのみ',
        'アイコン風デザイン、コンパスや地図のモチーフ、日本のデザイン、カラフルなグラデーション、テキストなし、アイコンのみ',
        'シンプルなアイコン、星や光のモチーフで方向性を表現、日本のデザイン、優しい色合い、テキストなし、アイコンのみ',
      ],
      'キーワード': [
        'アイコン風イラスト、タグやキーワードを示すシンプルなモチーフ、日本のデザイン、ポップな色合い、テキストなし、アイコンのみ',
        'アイコン風デザイン、検索やキーワードを示すモチーフ、日本のデザイン、カラフルな色合い、テキストなし、アイコンのみ',
        'シンプルなアイコン、キーワードを表現するタグやラベルのモチーフ、日本のデザイン、鮮やかな色合い、テキストなし、アイコンのみ',
      ],
      'ターゲット読者': [
        'アイコン風イラスト、人々のシルエットをシンプルに表現、日本のデザイン、温かみのある色合い、テキストなし、アイコンのみ',
        'アイコン風デザイン、多様性のある人々のシルエット、日本のデザイン、カラフルな色合い、テキストなし、アイコンのみ',
        'シンプルなアイコン、コミュニティを表現する人々のモチーフ、日本のデザイン、ポップな色合い、テキストなし、アイコンのみ',
      ],
      '記事の長さ': [
        'アイコン風イラスト、尺や長さを示すバーやメーター、日本のデザイン、クリーンな色合い、テキストなし、アイコンのみ',
        'アイコン風デザイン、進捗を示すバーやメーターのモチーフ、日本のデザイン、グラデーション、テキストなし、アイコンのみ',
        'シンプルなアイコン、成長や進捗を示すモチーフ、日本のデザイン、ポップな色合い、テキストなし、アイコンのみ',
      ],
      '確認': [
        'アイコン風イラスト、チェックマークや承認を示すシンプルなモチーフ、日本のデザイン、落ち着いた色合い、テキストなし、アイコンのみ',
        'アイコン風デザイン、OKサインや承認のモチーフ、日本のデザイン、ポップな色合い、テキストなし、アイコンのみ',
        'シンプルなアイコン、承認や確認を示すモチーフ、日本のデザイン、カラフルなグラデーション、テキストなし、アイコンのみ',
      ],
    }

    const generated: any[] = []
    let generatedCount = 0

    for (const [category, prompts] of Object.entries(categoryPrompts)) {
      for (const prompt of prompts) {
        if (generatedCount >= count) break

        try {
          // Gemini 3.0 Nano Banana Proで生成（テキストを含めないように明示的に指定）
          const result = await geminiGenerateImagePng({
            prompt: `${prompt} 重要: 画像内にテキストや文字を含めないでください。アイコンやシンボルのみで表現してください。`,
            aspectRatio: '16:9',
            imageSize: '2K',
            model: GEMINI_IMAGE_MODEL_DEFAULT, // nano-banana-pro-preview (Gemini 3.0 Nano Banana Pro)
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
