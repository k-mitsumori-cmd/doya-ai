// ============================================
// ドヤサイト セクション再生成API
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { geminiGenerateImagePng } from '@seo/lib/gemini'
import { LpSection, ProductInfo } from '@/lib/lp-site/types'
import { generateSectionImagePair } from '@/lib/lp-site/image-generation'

export const maxDuration = 120 // 2分

function generateImagePrompt(section: LpSection, productInfo: ProductInfo): string {
  const toneDescription = {
    trust: '信頼感のある、落ち着いた、プロフェッショナルな',
    pop: 'ポップで明るい、カラフルな、親しみやすい',
    luxury: '高級感のある、洗練された、上質な',
    simple: 'シンプルでクリーンな、ミニマルな',
  }[productInfo.tone]

  return `LP（ランディングページ）用のセクション画像を生成してください。

セクション情報:
- セクションタイプ: ${section.section_type}
- 目的: ${section.purpose}
- 見出し: ${section.headline}
- サブ見出し: ${section.sub_headline || ''}

商品情報:
- 商品名: ${productInfo.product_name}
- ターゲット: ${productInfo.target}
- トーン: ${toneDescription}

画像要件:
- LP用途の画像（テキストを載せやすい構図）
- トーン: ${toneDescription}
- 抽象/UI/写真風を自動判断して最適なスタイルを選択
- テキストオーバーレイを想定した余白を確保
- 商品・サービスに関連するビジュアル要素を含める

高品質で、LPセクションとして使用できる画像を生成してください。`
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    const body = await request.json()
    const {
      section,
      product_info,
      regenerate_type, // 'image_pc' | 'image_sp' | 'both'
    } = body

    if (!section || !product_info) {
      return NextResponse.json(
        { error: 'sectionとproduct_infoは必須です' },
        { status: 400 }
      )
    }

    const sectionData = section as LpSection
    const productInfo = product_info as ProductInfo

    // 再生成タイプに応じて処理
    let imagePc: string | undefined
    let imageSp: string | undefined

    if (regenerate_type === 'both') {
      // 両方再生成
      const result = await generateSectionImagePair(sectionData, productInfo)
      imagePc = result.image_pc
      imageSp = result.image_sp
    } else if (regenerate_type === 'image_pc') {
      // PC画像のみ再生成
      const imagePrompt = generateImagePrompt(sectionData, productInfo)
      try {
        const pcResult = await geminiGenerateImagePng({
          prompt: imagePrompt + '\n\nアスペクト比: 16:9（横長）',
          aspectRatio: '16:9',
          imageSize: '2K',
        })
        imagePc = `data:${pcResult.mimeType};base64,${pcResult.dataBase64}`
      } catch (error) {
        console.error(`PC画像再生成エラー:`, error)
        throw error
      }
    } else if (regenerate_type === 'image_sp') {
      // SP画像のみ再生成
      const imagePrompt = generateImagePrompt(sectionData, productInfo)
      try {
        const spResult = await geminiGenerateImagePng({
          prompt: imagePrompt + '\n\nアスペクト比: 9:16（縦長）',
          aspectRatio: '9:16',
          imageSize: '2K',
        })
        imageSp = `data:${spResult.mimeType};base64,${spResult.dataBase64}`
      } catch (error) {
        console.error(`SP画像再生成エラー:`, error)
        throw error
      }
    }

    return NextResponse.json({
      success: true,
      result: {
        section_id: sectionData.section_id,
        image_pc: imagePc,
        image_sp: imageSp,
      },
    })
  } catch (error: any) {
    console.error('[LP-SITE] Regenerate error:', error)
    return NextResponse.json(
      {
        error: '再生成に失敗しました',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

