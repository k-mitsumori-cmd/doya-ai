// ============================================
// Step 4: 画像生成フェーズ（Gemini Pro 3）
// ============================================

import { geminiGenerateImagePng } from '@seo/lib/gemini'
import { LpSection, SectionImage, ProductInfo } from './types'

/**
 * セクション画像を生成
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

    const sectionImage = await generateSectionImagePair(section, productInfo)
    images.push(sectionImage)
  }

  return images
}

/**
 * セクションのPC/SP画像ペアを生成
 */
export async function generateSectionImagePair(
  section: LpSection,
  productInfo: ProductInfo
): Promise<SectionImage> {
  const imagePrompt = generateImagePrompt(section, productInfo)

  // PC用画像生成
  let imagePc: string | undefined
  try {
    const pcResult = await geminiGenerateImagePng({
      prompt: imagePrompt + '\n\nアスペクト比: 16:9（横長）',
      aspectRatio: '16:9',
      imageSize: '2K',
    })
    imagePc = `data:${pcResult.mimeType};base64,${pcResult.dataBase64}`
  } catch (error) {
    console.error(`PC画像生成エラー (${section.section_id}):`, error)
  }

  // SP用画像生成
  let imageSp: string | undefined
  try {
    const spResult = await geminiGenerateImagePng({
      prompt: imagePrompt + '\n\nアスペクト比: 9:16（縦長）',
      aspectRatio: '9:16',
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
 * 画像生成用プロンプトを生成
 */
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

