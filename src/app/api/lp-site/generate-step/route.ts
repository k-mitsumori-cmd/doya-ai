// ============================================
// ドヤサイト LP生成API（段階的実行）
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { extractProductInfoFromUrl, structureProductInfo } from '@/lib/lp-site/product-understanding'
import { generateLpStructure } from '@/lib/lp-site/structure-generation'
import { generateWireframes } from '@/lib/lp-site/wireframe-generation'
import { LpSection } from '@/lib/lp-site/types'
import { generateSectionImages } from '@/lib/lp-site/image-generation'
import { researchCompetitors } from '@/lib/lp-site/competitor-research'
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

      // 競合調査を並行実行（非同期で実行し、結果は後で取得可能にする）
      const competitorResearch = researchCompetitors(productInfo).catch((error) => {
        console.error('[LP-SITE] 競合調査エラー:', error)
        return { competitors: [], summary: '競合調査を完了できませんでした' }
      })

      return NextResponse.json({
        success: true,
        step: 'product-understanding',
        product_info: productInfo,
        competitor_research: await competitorResearch,
      })
    }

    // Step 1.5: 競合調査フェーズ（独立して実行可能）
    if (step === 'competitor-research') {
      if (!product_info) {
        return NextResponse.json({ error: 'product_infoが必要です' }, { status: 400 })
      }
      const competitorResearch = await researchCompetitors(product_info as ProductInfo)
      return NextResponse.json({
        success: true,
        step: 'competitor-research',
        competitor_research: competitorResearch,
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

    // Step 3: ワイヤーフレーム生成フェーズ（バックグラウンドジョブ方式）
    if (step === 'wireframe-generation') {
      if (!product_info || !sections) {
        return NextResponse.json({ error: 'product_infoとsectionsが必要です' }, { status: 400 })
      }

      // バックグラウンドジョブ方式: ワイヤーフレーム生成を開始して即座にレスポンスを返す
      // これにより、Vercelのタイムアウト（300秒）を回避できる
      const { createWireframeJob, updateWireframeJob } = await import('@/lib/lp-site/wireframe-job-storage')
      const jobId = createWireframeJob()
      
      console.log(`[LP-SITE] ワイヤーフレーム生成ジョブを作成: ${jobId}`)

      // バックグラウンドで処理を開始（非同期）
      // 注意: この処理は即座に完了し、実際のワイヤーフレーム生成はバックグラウンドで実行される
      processWireframeGenerationInBackground({
        jobId,
        sections,
        productInfo: product_info as ProductInfo,
      }).catch((error: any) => {
        console.error('[LP-SITE] バックグラウンドワイヤーフレーム生成エラー:', error)
        updateWireframeJob(jobId, {
          status: 'ERROR',
          error: error.message || 'Unknown error',
        })
      })

      // 即座にレスポンスを返す（処理はバックグラウンドで継続）
      return NextResponse.json({
        success: true,
        step: 'wireframe-generation',
        jobId,
        status: 'PROCESSING',
        message: 'ワイヤーフレーム生成を開始しました。バックグラウンドで処理が続行されます。',
        pollingRequired: true,
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

// バックグラウンドでワイヤーフレーム生成を実行
async function processWireframeGenerationInBackground({
  jobId,
  sections,
  productInfo,
}: {
  jobId: string
  sections: LpSection[]
  productInfo: ProductInfo
}) {
  try {
    console.log(`[LP-SITE] バックグラウンドワイヤーフレーム生成を開始: ${jobId}`)
    
    const { updateWireframeJob } = await import('@/lib/lp-site/wireframe-job-storage')
    
    // ワイヤーフレームを生成
    const wireframes = await generateWireframes(sections, productInfo)
    
    // データベースに保存
    updateWireframeJob(jobId, {
      status: 'COMPLETED',
      wireframes,
    })
    
    console.log(`[LP-SITE] バックグラウンドワイヤーフレーム生成完了: ${jobId}`)
  } catch (error: any) {
    console.error(`[LP-SITE] バックグラウンドワイヤーフレーム生成エラー: ${jobId}`, error)
    
    const { updateWireframeJob } = await import('@/lib/lp-site/wireframe-job-storage')
    
    // エラーを記録
    updateWireframeJob(jobId, {
      status: 'ERROR',
      error: error.message || 'Unknown error',
    })
    
    throw error
  }
}




