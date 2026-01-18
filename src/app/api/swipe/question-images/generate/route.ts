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
    // - 添付のような「フラットでポップ、ワクワクする」方向に寄せる
    // - 画像内文字/ロゴ/透かし/写真/花や植物モチーフを避ける
    // - Gemini 3.0 Nano Banana Proで生成（テキストを含めないように明示的に指定）
    const categoryPrompts: Record<string, string[]> = {
      '記事の種類': [
        'ポップでワクワクするフラットベクター、シンプルなカード/ドキュメントのアイコン、日本のアプリUI風、鮮やかな配色、やわらかい影、テキストなし',
        'フラットなベクターアイコン、記事カードが重なったモチーフ、丸み、グラデーション背景、テキストなし',
        '可愛いマスコット風の小さなキャラクター+記事カードアイコン、フラット、ポップ、テキストなし',
      ],
      '記事の方向性': [
        'フラットベクターアイコン、コンパスと矢印、ワクワクする配色、丸み、グラデーション、テキストなし',
        'フラットなベクター、道しるべ/分岐のアイコン、ポップ、テキストなし',
        'シンプルなベクターアイコン、ターゲットに向かう矢印と星のモチーフ、テキストなし',
      ],
      'キーワード': [
        'フラットベクターアイコン、虫眼鏡+タグ、ポップ、テキストなし',
        'フラットなベクター、検索アイコンと複数のタグ、鮮やかな配色、テキストなし',
        'アイコン風、キーワードの束（タグが並ぶ）モチーフ、丸み、テキストなし',
      ],
      'ターゲット読者': [
        'フラットベクター、3人のシルエット（コミュニティ）アイコン、ポップ、テキストなし',
        'フラットなベクターアイコン、ユーザー/ペルソナのモチーフ、鮮やかな配色、テキストなし',
        'マスコット風キャラが指差しするユーザーアイコン、フラット、テキストなし',
      ],
      '記事の長さ': [
        'フラットベクターアイコン、進捗バー/ゲージ、ポップ、テキストなし',
        'フラットなベクター、メーターと上向き矢印、鮮やか、テキストなし',
        'シンプルなアイコン、チェックが増えていくリスト、ポップ、テキストなし',
      ],
      '確認': [
        'フラットベクターアイコン、チェックマークのバッジ、ポップ、テキストなし',
        'フラットなベクター、OKサイン/承認スタンプのモチーフ、鮮やかな配色、テキストなし',
        'シンプルなベクター、盾+チェック（安心/確定）、テキストなし',
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
            prompt:
              `${prompt}\n` +
              `重要: 画像内にテキスト/文字/数字/ロゴ/透かしを含めないでください。\n` +
              `重要: 写真風・実写風にしないでください（フラットなベクター/イラストのみ）。\n` +
              `重要: 花・植物モチーフは使わないでください。\n` +
              `背景は明るいグラデーション、被写体は中央、余白多め、見切れなし。`,
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
