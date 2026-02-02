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

    // 質問カテゴリに応じたビジネスライクな画像プロンプト（テキストなし）
    // - 記事作成・コンテンツマーケティング・SEOの文脈を反映
    // - ビジネスプロフェッショナルな雰囲気（ノートPC、キーボード、チャート、データなど）
    // - 画像内文字/ロゴ/透かし/写真/花や植物モチーフを避ける
    // - フラットなベクター/イラストスタイルで統一
    // - Gemini 3.0 Nano Banana Proで生成（テキストを含めないように明示的に指定）
    const categoryPrompts: Record<string, string[]> = {
      '記事の種類': [
        'ビジネスライクなフラットベクター、ノートPCと記事ドキュメントのアイコン、プロフェッショナル、テキストなし',
        'コンテンツ作成を表現、キーボードとメモ帳のベクターアイコン、ビジネス風、テキストなし',
        '記事カードが重なったモチーフ、フラットベクター、ビジネスUI風、テキストなし',
        '比較記事を表現、天秤とチャートのアイコン、フラットベクター、ビジネス風、テキストなし',
        'HowTo記事を表現、チェックリストと手順矢印のアイコン、フラット、テキストなし',
        '解説記事を表現、本と解説のアイコン、フラットベクター、ビジネス風、テキストなし',
        '事例記事を表現、グラフ上昇と成功バッジのアイコン、フラット、テキストなし',
      ],
      '記事タイプ': [
        'ビジネスライクなフラットベクター、ノートPCと記事ドキュメントのアイコン、プロフェッショナル、テキストなし',
        'コンテンツ作成を表現、キーボードとメモ帳のベクターアイコン、ビジネス風、テキストなし',
        '記事カードが重なったモチーフ、フラットベクター、ビジネスUI風、テキストなし',
        '比較記事を表現、天秤とチャートのアイコン、フラットベクター、ビジネス風、テキストなし',
        'HowTo記事を表現、チェックリストと手順矢印のアイコン、フラット、テキストなし',
        '解説記事を表現、本と解説のアイコン、フラットベクター、ビジネス風、テキストなし',
        '事例記事を表現、グラフ上昇と成功バッジのアイコン、フラット、テキストなし',
      ],
      '記事の方向性': [
        'コンテンツマーケティングの方向性、ターゲットとコンテンツを結ぶ矢印、フラットベクター、ビジネス風、テキストなし',
        'SEO最適化の方向性、ターゲットキーワードへの矢印とグラフ、フラット、テキストなし',
        '記事作成のゴール、完了バッジと成功チャート、ビジネスアイコン、テキストなし',
        'ビジネス戦略の方向性、コンパスとデータチャート、フラットベクター、テキストなし',
        'コンテンツ戦略、フローチャートと矢印、ビジネスUI風、テキストなし',
        'マーケティング目標、ターゲットと指標のアイコン、フラット、テキストなし',
      ],
      'キーワード': [
        'SEOキーワードを表現、検索バーと複数のタグ、フラットベクター、ビジネス風、テキストなし',
        'キーワードマップ、中央から広がるタグのアイコン、ビジネスUI風、テキストなし',
        '検索キーワード、虫眼鏡とハッシュタグ、フラットベクター、テキストなし',
        'SEOキーワード分析、データチャートとタグ、ビジネスアイコン、テキストなし',
        'キーワードリサーチ、検索と分析グラフのアイコン、フラット、テキストなし',
        '関連キーワード、タグのネットワーク図、ビジネス風、テキストなし',
      ],
      '関連キーワード': [
        'SEOキーワードを表現、検索バーと複数のタグ、フラットベクター、ビジネス風、テキストなし',
        'キーワードマップ、中央から広がるタグのアイコン、ビジネスUI風、テキストなし',
        '検索キーワード、虫眼鏡とハッシュタグ、フラットベクター、テキストなし',
        'SEOキーワード分析、データチャートとタグ、ビジネスアイコン、テキストなし',
        'キーワードリサーチ、検索と分析グラフのアイコン、フラット、テキストなし',
        '関連キーワード、タグのネットワーク図、ビジネス風、テキストなし',
      ],
      'ターゲット読者': [
        'ビジネス読者層、3-4人のビジネスシルエット（多様性）、フラットベクター、プロフェッショナル、テキストなし',
        'ペルソナカード、ユーザープロファイルとターゲット、ビジネスアイコン、テキストなし',
        'ターゲット読者、ビジネスパーソンのシルエットと記事のアイコン、フラット、テキストなし',
        '読者層分析、グラフとユーザーアイコン、ビジネス風、テキストなし',
        'オーディエンス、ビジネス会議のシルエット、フラットベクター、テキストなし',
      ],
      'ターゲット': [
        'ビジネス読者層、3-4人のビジネスシルエット（多様性）、フラットベクター、プロフェッショナル、テキストなし',
        'ペルソナカード、ユーザープロファイルとターゲット、ビジネスアイコン、テキストなし',
        'ターゲット読者、ビジネスパーソンのシルエットと記事のアイコン、フラット、テキストなし',
        '読者層分析、グラフとユーザーアイコン、ビジネス風、テキストなし',
        'オーディエンス、ビジネス会議のシルエット、フラットベクター、テキストなし',
      ],
      '記事の長さ': [
        '文字数・ワードカウントを表現、メーターと数字表示のアイコン（数字は見えない抽象表現）、フラットベクター、ビジネス風、テキストなし',
        '進捗バー、記事の完成度ゲージ、ビジネスUI風、テキストなし',
        'ページ数、複数ページのドキュメントアイコン、フラットベクター、テキストなし',
        '文字数カウント、キーボードとワードメーター、ビジネスアイコン、テキストなし',
        '記事の長さ、ドキュメントの厚みを示すアイコン、フラット、テキストなし',
      ],
      '確認': [
        '完了確認、チェックマークと完了バッジ、フラットベクター、ビジネス風、テキストなし',
        '承認スタンプ、OKサインと承認印、ビジネスアイコン、テキストなし',
        '確定・承認、盾とチェックマーク、フラット、テキストなし',
        'ビジネス承認、契約スタンプ風のアイコン、テキストなし',
        '確認完了、チェックリストと完了バッジ、ビジネスUI風、テキストなし',
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
