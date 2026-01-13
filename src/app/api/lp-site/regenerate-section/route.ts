// ============================================
// ドヤサイト セクション再生成API
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateSingleBanner } from '@/lib/nanobanner'
import { LpSection, ProductInfo } from '@/lib/lp-site/types'
import { generateSectionImagePair, generateImagePrompt } from '@/lib/lp-site/image-generation'

export const maxDuration = 180 // 3分（画像生成には時間がかかるため延長）

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
      try {
        console.log(`[LP-SITE] 両方の画像再生成開始: ${sectionData.section_id}`)
        const result = await generateSectionImagePair(sectionData, productInfo)
        imagePc = result.image_pc
        imageSp = result.image_sp
        
        // PC/SPの少なくともどちらかが生成されているか確認
        if (!imagePc && !imageSp) {
          throw new Error('PC/SP両方の画像が生成されませんでした')
        }
        
        console.log(`[LP-SITE] 両方の画像再生成成功: ${sectionData.section_id} (PC: ${!!imagePc}, SP: ${!!imageSp})`)
      } catch (error: any) {
        console.error(`[LP-SITE] 両方の画像再生成エラー (${sectionData.section_id}):`, error)
        throw new Error(`画像再生成に失敗しました: ${error.message || '不明なエラー'}`)
      }
    } else if (regenerate_type === 'image_pc') {
      // PC画像のみ再生成
      const imagePrompt = generateImagePrompt(sectionData, productInfo, 'pc')
      console.log(`[LP-SITE] PC画像再生成開始: ${sectionData.section_id}`)
      try {
        const pcResult = await generateSingleBanner(imagePrompt, '1920x1080', {})
        imagePc = pcResult.image
        console.log(`[LP-SITE] PC画像再生成成功: ${sectionData.section_id}, モデル ${pcResult.model}`)
      } catch (error) {
        console.error(`[LP-SITE] PC画像再生成エラー (${sectionData.section_id}):`, error)
        throw error
      }
    } else if (regenerate_type === 'image_sp') {
      // SP画像のみ再生成
      const imagePrompt = generateImagePrompt(sectionData, productInfo, 'sp')
      console.log(`[LP-SITE] SP画像再生成開始: ${sectionData.section_id}`)
      try {
        const spResult = await generateSingleBanner(imagePrompt, '1080x1920', {})
        imageSp = spResult.image
        console.log(`[LP-SITE] SP画像再生成成功: ${sectionData.section_id}, モデル ${spResult.model}`)
      } catch (error) {
        console.error(`[LP-SITE] SP画像再生成エラー (${sectionData.section_id}):`, error)
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

