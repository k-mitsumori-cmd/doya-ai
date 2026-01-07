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

  console.log(`[LP-SITE] 画像生成開始: ${sections.length}セクション`)

  for (const section of sections) {
    if (!section.image_required) {
      console.log(`[LP-SITE] 画像不要: ${section.section_id}`)
      images.push({
        section_id: section.section_id,
      })
      continue
    }

    try {
      console.log(`[LP-SITE] セクション画像生成中: ${section.section_id}`)
      // PC/SP別に必ず別々の画像を生成（リサイズではなく再生成）
      const sectionImage = await generateSectionImagePair(section, productInfo)
      images.push(sectionImage)
      console.log(`[LP-SITE] セクション画像生成完了: ${section.section_id}`)
    } catch (error: any) {
      console.error(`[LP-SITE] セクション画像生成失敗: ${section.section_id}`, error)
      // エラーが発生しても、空の画像エントリを追加して続行
      images.push({
        section_id: section.section_id,
        image_pc: undefined,
        image_sp: undefined,
      })
    }
  }

  console.log(`[LP-SITE] 画像生成完了: ${images.length}画像`)
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
    console.log(`[LP-SITE] PC画像生成開始: ${section.section_id}`)
    const pcPrompt = generateImagePrompt(section, productInfo, 'pc')
    console.log(`[LP-SITE] PCプロンプト長: ${pcPrompt.length}文字`)
    const pcResult = await geminiGenerateImagePng({
      prompt: pcPrompt,
      aspectRatio: '16:9', // PC用は横長
      imageSize: '2K',
    })
    imagePc = `data:${pcResult.mimeType};base64,${pcResult.dataBase64}`
    console.log(`[LP-SITE] PC画像生成成功: ${section.section_id}, サイズ: ${pcResult.dataBase64.length}文字`)
  } catch (error: any) {
    console.error(`[LP-SITE] PC画像生成エラー (${section.section_id}):`, error)
    console.error(`[LP-SITE] エラー詳細:`, error.message, error.stack)
    // エラーを再スローして、呼び出し元で処理できるようにする
    throw new Error(`PC画像生成に失敗しました (${section.section_id}): ${error.message}`)
  }

  // SP用画像生成（縦長）- 必ず別プロンプトで再生成
  let imageSp: string | undefined
  try {
    console.log(`[LP-SITE] SP画像生成開始: ${section.section_id}`)
    const spPrompt = generateImagePrompt(section, productInfo, 'sp')
    console.log(`[LP-SITE] SPプロンプト長: ${spPrompt.length}文字`)
    const spResult = await geminiGenerateImagePng({
      prompt: spPrompt,
      aspectRatio: '9:16', // SP用は縦長
      imageSize: '2K',
    })
    imageSp = `data:${spResult.mimeType};base64,${spResult.dataBase64}`
    console.log(`[LP-SITE] SP画像生成成功: ${section.section_id}, サイズ: ${spResult.dataBase64.length}文字`)
  } catch (error: any) {
    console.error(`[LP-SITE] SP画像生成エラー (${section.section_id}):`, error)
    console.error(`[LP-SITE] エラー詳細:`, error.message, error.stack)
    // エラーを再スローして、呼び出し元で処理できるようにする
    throw new Error(`SP画像生成に失敗しました (${section.section_id}): ${error.message}`)
  }

  return {
    section_id: section.section_id,
    image_pc: imagePc,
    image_sp: imageSp,
  }
}

/**
 * 共通前提プロンプト
 * 完全なLPセクションとして、テキストも含めて生成
 * rdlp.jp/lp-archive/ のデザインパターンを参考
 */
function getCommonBasePrompt(): string {
  return `You are generating a COMPLETE LANDING PAGE SECTION with text included.
This is a functional landing page section that can be used directly as part of an LP.
Reference Japanese LP design patterns from rdlp.jp/lp-archive/ for authentic LP layouts.

CRITICAL REQUIREMENTS:
- Generate a COMPLETE, FUNCTIONAL landing page section with text embedded
- Include headlines, descriptions, and CTAs as actual text in the image
- Professional Japanese landing page design style
- High-quality commercial landing page aesthetic
- Text must be clearly readable and well-designed
- Use appropriate Japanese typography and layout
- This section will be vertically connected with other sections
- Vertical layout optimized for scrolling
- Clean, modern, conversion-optimized design
- Follow proven LP design patterns from successful Japanese landing pages`
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
- Headline: ${section.headline}
- Sub headline: ${section.sub_headline || ''}
- Purpose: ${section.purpose}
- Target audience: ${productInfo.target}
- Tone: ${toneDescription}
- LP type: ${productInfo.lp_type}

TEXT REQUIREMENTS (MUST INCLUDE):
- Embed the headline "${section.headline}" as actual text in the image
- ${section.sub_headline ? `Embed the sub headline "${section.sub_headline}" as actual text` : 'Add supporting text that explains the section purpose'}
- Use clear, readable Japanese typography
- Text should be prominent and well-positioned
- Follow Japanese LP text layout conventions
- Include CTA text if this is a CTA section

Device-specific requirements:
- ${device === 'pc' ? 'PC version: Wide horizontal layout (16:9), desktop-optimized' : 'Mobile version: Tall vertical layout (9:16), mobile-optimized'}
- ${device === 'pc' ? 'Text can be larger, more horizontal layout' : 'Text should be vertically stacked, mobile-friendly size'}
- Recompose layout specifically for ${device === 'pc' ? 'desktop' : 'mobile'} - do NOT just resize

Design Style (Reference rdlp.jp/lp-archive/):
- Professional Japanese landing page design
- Clear visual hierarchy
- Conversion-optimized layout
- Modern, clean aesthetic
- Text and visuals work together harmoniously
- Generate a complete, functional LP section that can be used directly`
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
    return `Section type: First View (Hero Section) - COMPLETE LP SECTION WITH TEXT

Purpose:
- Instantly communicate product value and premium feeling
- Catch attention at first glance
- Include main headline and sub headline as embedded text

Visual requirements:
- Main product or key visual element prominently displayed
- Dynamic visual elements (splash, particles, light, gradients)
- Bright, clean background
- Luxury but approachable impression
- Professional commercial advertising style

Text requirements:
- Embed the main headline "${section.headline}" prominently at the top
- ${section.sub_headline ? `Embed sub headline "${section.sub_headline}" below main headline` : 'Add compelling sub text that explains the value proposition'}
- Use large, bold, readable Japanese typography
- Text should be the focal point along with the visual
- Consider adding a CTA button with text if appropriate

Composition:
- ${device === 'pc' ? 'Headline at top, product/visual in center, CTA at bottom' : 'Headline at top, product/visual in center, CTA at bottom - vertical stack'}
- Bold, impactful composition
- Professional LP hero section layout

Tone: Clean, Premium, Trustworthy, Conversion-focused`
  }

  // 商品特徴・ベネフィット
  if (sectionType.includes('benefit') || sectionType.includes('feature') || sectionType.includes('value')) {
    return `Section type: Benefit Explanation - COMPLETE LP SECTION WITH TEXT

Purpose:
- Explain key benefits visually with embedded text

Visual requirements:
- Abstract representation of benefits (moisture, efficiency, growth, etc.)
- Soft gradients, modern visuals
- Light particles or bubbles
- Product imagery or illustrations

Text requirements:
- Embed headline "${section.headline}" prominently
- ${section.sub_headline ? `Include sub headline "${section.sub_headline}"` : 'Add benefit descriptions as text'}
- List key benefits as text (3-5 points)
- Use clear, readable Japanese typography
- Text should explain the benefits clearly

Composition:
- ${device === 'pc' ? 'Headline at top, benefits listed with visuals, clean layout' : 'Headline at top, benefits vertically stacked with visuals'}
- Clean, spacious, professional layout
- Text and visuals work together

Tone: Scientific but friendly, clean, conversion-focused aesthetic`
  }

  // 成分・仕組み説明
  if (sectionType.includes('ingredient') || sectionType.includes('mechanism') || sectionType.includes('how')) {
    return `Section type: Ingredient / Mechanism - COMPLETE LP SECTION WITH TEXT

Purpose:
- Visualize how the product works with embedded explanations

Visual requirements:
- Diagram-like illustration
- Layers, processes, or interactions
- Simple, easy-to-understand visuals
- Educational but beautiful

Text requirements:
- Embed headline "${section.headline}" at the top
- ${section.sub_headline ? `Include explanation "${section.sub_headline}"` : 'Add clear explanations of how it works'}
- Label key components or steps as text
- Use clear, readable Japanese typography
- Educational text that helps understanding

Composition:
- ${device === 'pc' ? 'Headline at top, diagram in center with labels, explanation below' : 'Headline at top, diagram in center with labels, explanation below - vertical'}
- Professional, informative layout

Style: Semi-flat illustration, informative, conversion-focused`
  }

  // 使用イメージ・人物
  if (sectionType.includes('usage') || sectionType.includes('lifestyle') || sectionType.includes('person')) {
    return `Section type: Usage Image - COMPLETE LP SECTION WITH TEXT

Purpose:
- Show how the product fits into daily life with embedded text

Visual requirements:
- ${productInfo.lp_type === 'ec' ? 'Japanese person using the product naturally' : 'Professional setting or workspace'}
- Natural smile or confident expression
- Clean, bright space
- Soft lighting
- Authentic lifestyle feeling

Text requirements:
- Embed headline "${section.headline}" prominently
- ${section.sub_headline ? `Include description "${section.sub_headline}"` : 'Add text explaining the usage or lifestyle benefit'}
- Use testimonial-style text if appropriate
- Clear, relatable Japanese typography

Constraints:
- No exaggerated expressions
- Realistic lifestyle photo style
- Professional but approachable

Composition:
- ${device === 'pc' ? 'Headline at top, person/visual in center, description text below' : 'Headline at top, person/visual in center, description text below - vertical'}
- Natural, authentic, conversion-focused layout`
  }

  // CTA・商品情報
  if (sectionType.includes('cta') || sectionType.includes('action') || sectionType.includes('pricing')) {
    return `Section type: CTA / Product Info - COMPLETE LP SECTION WITH TEXT

Purpose:
- Encourage purchase or action with clear CTA text

Visual requirements:
- Product clearly visible
- Simple, focused background
- Calm but confident mood
- Focus on the product or action

Text requirements:
- Embed CTA headline "${section.headline}" prominently
- ${section.sub_headline ? `Include sub text "${section.sub_headline}"` : 'Add compelling CTA description'}
- Include CTA button with text (e.g., "今すぐ始める", "無料で試す", "資料をダウンロード")
- ${productInfo.cta ? `Use CTA text: "${productInfo.cta}"` : 'Use appropriate CTA text for the product'}
- Price information if this is pricing section
- Clear, action-oriented typography

Composition:
- ${device === 'pc' ? 'Headline at top, product in center, CTA button prominently at bottom' : 'Headline at top, product in center, large CTA button at bottom'}
- Clean, uncluttered, conversion-focused
- CTA button should be prominent and clickable-looking

Tone: Reliable, Clear, Commercial, Action-oriented`
  }

  // デフォルト（その他のセクション）
  return `Section type: ${section.section_type} - COMPLETE LP SECTION WITH TEXT

Purpose: ${section.purpose}

Visual requirements:
- Clean, commercial, professional style
- Related to the product or service
- Modern LP design aesthetic
- High-quality visuals

Text requirements:
- Embed headline "${section.headline}" prominently
- ${section.sub_headline ? `Include sub text "${section.sub_headline}"` : 'Add supporting text that explains the section'}
- Use clear, readable Japanese typography
- Professional text layout

Composition:
- ${device === 'pc' ? 'Headline at top, visual in center, supporting text below' : 'Headline at top, visual in center, supporting text below - vertical'}
- Clean, conversion-focused layout
- Text and visuals work together harmoniously

Style: Professional Japanese landing page design, conversion-optimized`
}

