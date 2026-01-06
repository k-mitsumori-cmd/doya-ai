// ============================================
// ドヤサイト メインパイプライン
// ============================================

import { LpGenerationRequest, LpGenerationResult, ProductInfo } from './types'
import { extractProductInfoFromUrl, structureProductInfo } from './product-understanding'
import { generateLpStructure } from './structure-generation'
import { generateWireframes } from './wireframe-generation'
import { generateSectionImages } from './image-generation'

/**
 * LP生成パイプライン全体を実行
 */
export async function generateLp(request: LpGenerationRequest): Promise<LpGenerationResult> {
  // Step 1: 商品理解フェーズ
  let productInfo: ProductInfo
  if (request.input_type === 'url' && request.url) {
    const extracted = await extractProductInfoFromUrl(request.url)
    productInfo = await structureProductInfo(extracted, request.lp_type, request.tone)
  } else if (request.input_type === 'form' && request.form_data) {
    const formData = request.form_data
    const partialInfo: Partial<ProductInfo> = {
      product_name: formData.product_name,
      target: formData.target,
      problem: formData.problem,
      solution: formData.product_summary,
      differentiation: formData.strength,
      cta: formData.cta,
    }
    productInfo = await structureProductInfo(partialInfo, request.lp_type, request.tone)
  } else {
    throw new Error('無効なリクエストです')
  }

  // Step 2: LP構成生成フェーズ
  const sections = await generateLpStructure(productInfo)

  // Step 3: ワイヤーフレーム生成フェーズ
  const wireframes = await generateWireframes(sections, productInfo)

  // Step 4: 画像生成フェーズ
  const images = await generateSectionImages(sections, productInfo)

  // Step 5: アセット整理
  const structureJson = JSON.stringify({
    product_info: productInfo,
    sections,
    wireframes,
    images: images.map(img => ({
      section_id: img.section_id,
      has_pc: !!img.image_pc,
      has_sp: !!img.image_sp,
    })),
  }, null, 2)

  return {
    product_info: productInfo,
    sections,
    wireframes,
    images,
    structure_json: structureJson,
  }
}

