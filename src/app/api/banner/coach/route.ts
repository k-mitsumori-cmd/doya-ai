import { NextRequest, NextResponse } from 'next/server'
import { 
  analyzeBannerQuality, 
  generateCopyVariations, 
  getIndustryBenchmark,
  predictABTestResults,
  suggestColorPalette,
  type BannerScore,
  type CopyVariations,
  type IndustryBenchmark,
  type ABTestPrediction,
  type ColorPalette,
} from '@/lib/banner-coach'

// ========================================
// バナーコーチAPI
// ========================================
// POST /api/banner/coach
// AIによるバナー品質分析・改善提案

export interface BannerCoachRequest {
  action: 'analyze' | 'copy' | 'benchmark' | 'abtest' | 'color' | 'full'
  keyword: string
  category: string
  useCase?: string
  targetAudience?: string
  mood?: string
}

export interface BannerCoachResponse {
  success: boolean
  data?: {
    score?: BannerScore
    copyVariations?: CopyVariations
    benchmark?: IndustryBenchmark
    abTestPrediction?: ABTestPrediction
    colorPalette?: ColorPalette
  }
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<BannerCoachResponse>> {
  try {
    const body: BannerCoachRequest = await request.json()
    const { action, keyword, category, useCase = 'sns_ad', targetAudience, mood = 'professional' } = body

    if (!keyword || !category) {
      return NextResponse.json({
        success: false,
        error: 'キーワードとカテゴリは必須です',
      }, { status: 400 })
    }

    const data: BannerCoachResponse['data'] = {}

    // アクションに応じて処理
    switch (action) {
      case 'analyze':
        data.score = await analyzeBannerQuality(keyword, category, useCase, targetAudience)
        break

      case 'copy':
        data.copyVariations = await generateCopyVariations(keyword, category, useCase)
        break

      case 'benchmark':
        const benchmark = getIndustryBenchmark(category)
        if (benchmark) {
          data.benchmark = benchmark
        }
        break

      case 'abtest':
        data.abTestPrediction = predictABTestResults(category, ['benefit', 'urgency', 'trust'])
        break

      case 'color':
        data.colorPalette = suggestColorPalette(category, mood)
        break

      case 'full':
        // フル分析（すべての機能を実行）
        const [score, copyVariations] = await Promise.all([
          analyzeBannerQuality(keyword, category, useCase, targetAudience),
          generateCopyVariations(keyword, category, useCase),
        ])
        data.score = score
        data.copyVariations = copyVariations
        data.benchmark = getIndustryBenchmark(category) || undefined
        data.abTestPrediction = predictABTestResults(category, ['benefit', 'urgency', 'trust'])
        data.colorPalette = suggestColorPalette(category, mood)
        break

      default:
        return NextResponse.json({
          success: false,
          error: '無効なアクションです',
        }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data,
    })

  } catch (error: any) {
    console.error('Banner coach error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'バナーコーチの処理中にエラーが発生しました',
    }, { status: 500 })
  }
}

