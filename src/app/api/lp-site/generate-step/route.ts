// ============================================
// ドヤサイト LP生成API（段階的実行）
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { extractProductInfoFromUrl, structureProductInfo } from '@/lib/lp-site/product-understanding'
import { generateLpStructure } from '@/lib/lp-site/structure-generation'
import { generateWireframes } from '@/lib/lp-site/wireframe-generation'
import { generateSectionImages } from '@/lib/lp-site/image-generation'
import { LpGenerationRequest, ProductInfo } from '@/lib/lp-site/types'

export const maxDuration = 300 // 5分

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()
    const { step, request_data, product_info, sections } = body

    // Step 1: 商品理解フェーズ
    if (step === 'product-understanding') {
      const { input_type, url, form_data, lp_type, tone } = request_data as LpGenerationRequest
      
      let productInfo: ProductInfo
      if (input_type === 'url' && url) {
        const extracted = await extractProductInfoFromUrl(url)
        productInfo = await structureProductInfo(extracted, lp_type, tone)
      } else if (input_type === 'form' && form_data) {
        const partialInfo: Partial<ProductInfo> = {
          product_name: form_data.product_name,
          target: form_data.target,
          problem: form_data.problem,
          solution: form_data.product_summary,
          differentiation: form_data.strength,
          cta: form_data.cta,
        }
        productInfo = await structureProductInfo(partialInfo, lp_type, tone)
      } else {
        throw new Error('無効なリクエストです')
      }

      return NextResponse.json({
        success: true,
        step: 'product-understanding',
        product_info: productInfo,
      })
    }

    // Step 2: LP構成生成フェーズ
    if (step === 'structure-generation') {
      if (!product_info) {
        return NextResponse.json({ error: 'product_infoが必要です' }, { status: 400 })
      }
      const sections = await generateLpStructure(product_info as ProductInfo)
      return NextResponse.json({
        success: true,
        step: 'structure-generation',
        sections,
      })
    }

    // Step 3: ワイヤーフレーム生成フェーズ
    if (step === 'wireframe-generation') {
      if (!product_info || !sections) {
        return NextResponse.json({ error: 'product_infoとsectionsが必要です' }, { status: 400 })
      }
      const wireframes = await generateWireframes(sections, product_info as ProductInfo)
      return NextResponse.json({
        success: true,
        step: 'wireframe-generation',
        wireframes,
      })
    }

    // Step 4: 画像生成フェーズ
    if (step === 'image-generation') {
      if (!product_info || !sections) {
        return NextResponse.json({ error: 'product_infoとsectionsが必要です' }, { status: 400 })
      }
      const images = await generateSectionImages(sections, product_info as ProductInfo)
      return NextResponse.json({
        success: true,
        step: 'image-generation',
        images,
      })
    }

    return NextResponse.json({ error: '無効なステップです' }, { status: 400 })
  } catch (error: any) {
    console.error('[LP-SITE] Step generation error:', error)
    return NextResponse.json(
      {
        error: '生成に失敗しました',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

