// ============================================
// ドヤサイト セクション再生成API
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { geminiGenerateImagePng } from '@seo/lib/gemini'
import { LpSection, ProductInfo } from '@/lib/lp-site/types'
import { generateSectionImagePair, generateImagePrompt } from '@/lib/lp-site/image-generation'

export const maxDuration = 120 // 2分

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
      // 両方再生成（セクション位置情報なしで再生成）
      const result = await generateSectionImagePair(sectionData, productInfo)
      imagePc = result.image_pc
      imageSp = result.image_sp
    } else if (regenerate_type === 'image_pc') {
      // PC画像のみ再生成
      const imagePrompt = generateImagePrompt(sectionData, productInfo, 'pc')
      try {
        const pcResult = await geminiGenerateImagePng({
          prompt: imagePrompt,
          aspectRatio: '16:9',
          imageSize: '2K',
        })
        imagePc = `data:${pcResult.mimeType};base64,${pcResult.dataBase64}`
      } catch (error) {
        console.error(`[LP-SITE] PC画像再生成エラー:`, error)
        throw error
      }
    } else if (regenerate_type === 'image_sp') {
      // SP画像のみ再生成
      const imagePrompt = generateImagePrompt(sectionData, productInfo, 'sp')
      try {
        const spResult = await geminiGenerateImagePng({
          prompt: imagePrompt,
          aspectRatio: '9:16',
          imageSize: '2K',
        })
        imageSp = `data:${spResult.mimeType};base64,${spResult.dataBase64}`
      } catch (error) {
        console.error(`[LP-SITE] SP画像再生成エラー:`, error)
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

