// ============================================
// Step 4: 画像生成フェーズ（Gemini Pro 3）
// セクション単位で個別生成（PC/SP別）
// ============================================

import { geminiGenerateImagePng } from '@seo/lib/gemini'
import { LpSection, SectionImage, ProductInfo } from './types'

/**
 * セクション画像を生成
 * 各セクションごとにPC/SP別の画像を個別生成
 */
export async function generateSectionImages(
  sections: LpSection[],
  productInfo: ProductInfo
): Promise<SectionImage[]> {
  const images: SectionImage[] = []

  for (const section of sections) {
    if (!section.image_required) {
      images.push({
        section_id: section.section_id,
      })
      continue
    }

    // PC/SP別に必ず別々の画像を生成（リサイズではなく再生成）
    const sectionImage = await generateSectionImagePair(section, productInfo)
    images.push(sectionImage)
  }

  return images
}

/**
 * セクションのPC/SP画像ペアを生成
 * 必ず別々の画像を生成（リサイズ禁止）
 */
export async function generateSectionImagePair(
  section: LpSection,
  productInfo: ProductInfo
): Promise<SectionImage> {
  // PC用画像生成（横長）
  let imagePc: string | undefined
  try {
    const pcPrompt = generateImagePrompt(section, productInfo, 'pc')
    const pcResult = await geminiGenerateImagePng({
      prompt: pcPrompt,
      aspectRatio: '16:9', // PC用は横長
      imageSize: '2K',
    })
    imagePc = `data:${pcResult.mimeType};base64,${pcResult.dataBase64}`
  } catch (error) {
    console.error(`PC画像生成エラー (${section.section_id}):`, error)
  }

  // SP用画像生成（縦長）- 必ず別プロンプトで再生成
  let imageSp: string | undefined
  try {
    const spPrompt = generateImagePrompt(section, productInfo, 'sp')
    const spResult = await geminiGenerateImagePng({
      prompt: spPrompt,
      aspectRatio: '9:16', // SP用は縦長
      imageSize: '2K',
    })
    imageSp = `data:${spResult.mimeType};base64,${spResult.dataBase64}`
  } catch (error) {
    console.error(`SP画像生成エラー (${section.section_id}):`, error)
  }

  return {
    section_id: section.section_id,
    image_pc: imagePc,
    image_sp: imageSp,
  }
}

/**
 * 共通前提プロンプト
 * LPの一部分として生成することを強く意識させる
 */
function getCommonBasePrompt(): string {
  return `You are generating a PARTIAL SECTION of a landing page image.
This is NOT a complete landing page image.
This is ONE SECTION that will be vertically connected with other sections to form a complete landing page.

CRITICAL REQUIREMENTS:
- This image will be placed in a vertical scrolling landing page
- Other sections will be placed above and below this section
- The image must seamlessly connect with adjacent sections when combined
- Vertical layout optimized for scrolling
- Plenty of empty space for text overlay (headlines, descriptions, CTAs)
- Clean, commercial, high-quality Japanese landing page style
- NO embedded text in the image (text will be overlaid separately)
- Focus on visual storytelling that supports text content
- This is a PARTIAL image - it should feel like part of a larger whole
- Leave generous margins at top and bottom for section transitions
- The composition should work when stacked vertically with other sections`
}

/**
 * セクションタイプ別の詳細プロンプトを生成
 */
function generateImagePrompt(
  section: LpSection,
  productInfo: ProductInfo,
  device: 'pc' | 'sp'
): string {
  const commonBase = getCommonBasePrompt()
  const toneDescription = getToneDescription(productInfo.tone)
  const sectionSpecific = getSectionSpecificPrompt(section, productInfo, device)

  return `${commonBase}

${sectionSpecific}

Product Information:
- Product name: ${productInfo.product_name}
- Target audience: ${productInfo.target}
- Tone: ${toneDescription}
- LP type: ${productInfo.lp_type}

Device-specific requirements:
- ${device === 'pc' ? 'PC version: Wide horizontal layout (16:9), suitable for desktop viewing' : 'Mobile version: Tall vertical layout (9:16), optimized for smartphone scrolling'}
- Recompose layout specifically for ${device === 'pc' ? 'desktop' : 'mobile'} - do NOT just resize
- ${device === 'pc' ? 'Horizontal flow, more elements can be side-by-side' : 'Vertical flow, single column composition'}

Remember:
- This is ONE section of a larger landing page
- Text will be overlaid later, so leave space
- Generate a unique composition for ${device === 'pc' ? 'PC' : 'mobile'}, not a resized version`
}

/**
 * トーン説明を取得
 */
function getToneDescription(tone: string): string {
  const descriptions: Record<string, string> = {
    trust: 'Trustworthy, calm, professional, reliable',
    pop: 'Pop, bright, colorful, friendly, energetic',
    luxury: 'Luxury, refined, premium, sophisticated',
    simple: 'Simple, clean, minimal, uncluttered',
  }
  return descriptions[tone] || 'clean and professional'
}

/**
 * セクションタイプ別の詳細プロンプト
 */
function getSectionSpecificPrompt(
  section: LpSection,
  productInfo: ProductInfo,
  device: 'pc' | 'sp'
): string {
  const sectionType = section.section_type.toLowerCase()

  // ファーストビュー（FV）
  if (sectionType.includes('hero') || sectionType.includes('first') || sectionType.includes('fv')) {
    return `Section type: First View (Hero Section)

Purpose:
- Instantly communicate product value and premium feeling
- Catch attention at first glance

Visual requirements:
- Main product bottle/object centered or slightly offset
- Dynamic visual elements (splash, particles, light)
- Bright, clean background
- Luxury but gentle impression
- Commercial advertising style

Composition:
- ${device === 'pc' ? 'Upper area reserved for headline text, center or lower area for product' : 'Top area for headline, center for product, bottom for CTA'}
- No small details, bold composition
- Generous empty space for text overlay

Tone: Clean, Premium, Trustworthy`
  }

  // 商品特徴・ベネフィット
  if (sectionType.includes('benefit') || sectionType.includes('feature') || sectionType.includes('value')) {
    return `Section type: Benefit Explanation

Purpose:
- Explain key benefits visually

Visual requirements:
- Abstract representation of benefits (moisture, efficiency, growth, etc.)
- Soft gradients
- Light particles or bubbles
- No people unless necessary

Composition:
- ${device === 'pc' ? 'Left or right empty area for text, visual flow from top to bottom' : 'Top area for text, visual elements below'}
- Clean, spacious layout

Tone: Scientific but friendly, clean aesthetic`
  }

  // 成分・仕組み説明
  if (sectionType.includes('ingredient') || sectionType.includes('mechanism') || sectionType.includes('how')) {
    return `Section type: Ingredient / Mechanism

Purpose:
- Visualize how the product works

Visual requirements:
- Diagram-like illustration
- Layers, processes, or interactions
- Simple, easy-to-understand visuals
- Educational but beautiful

Composition:
- Center illustration
- Space around for explanation text
- ${device === 'pc' ? 'Horizontal flow possible' : 'Vertical flow'}

Style: Semi-flat illustration, informative`
  }

  // 使用イメージ・人物
  if (sectionType.includes('usage') || sectionType.includes('lifestyle') || sectionType.includes('person')) {
    return `Section type: Usage Image

Purpose:
- Show how the product fits into daily life

Visual requirements:
- ${productInfo.lp_type === 'ec' ? 'Japanese person using the product' : 'Professional setting or workspace'}
- Natural smile or confident expression
- Clean, bright space
- Soft lighting

Constraints:
- No exaggerated expressions
- Realistic lifestyle photo style
- Professional but approachable

Composition:
- ${device === 'pc' ? 'Person on one side, empty space on the other for text' : 'Person centered or top, text space below'}
- Natural, authentic feeling`
  }

  // CTA・商品情報
  if (sectionType.includes('cta') || sectionType.includes('action') || sectionType.includes('pricing')) {
    return `Section type: CTA / Product Info

Purpose:
- Encourage purchase or action

Visual requirements:
- Product clearly visible
- Simple background
- Calm but confident mood
- Focus on the product or action

Composition:
- Product centered
- ${device === 'pc' ? 'Space above or below for buttons and text' : 'Space above for headline, below for CTA button'}
- Clean, uncluttered

Tone: Reliable, Clear, Commercial`
  }

  // デフォルト（その他のセクション）
  return `Section type: ${section.section_type}

Purpose: ${section.purpose}

Visual requirements:
- Clean, commercial style
- Related to the product or service
- Spacious layout for text overlay
- Professional quality

Composition:
- ${device === 'pc' ? 'Horizontal layout with text space' : 'Vertical layout with text space'}
- Focus on visual storytelling`
}

