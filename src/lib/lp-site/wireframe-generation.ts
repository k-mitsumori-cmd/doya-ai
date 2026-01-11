// ============================================
// Step 3: ワイヤーフレーム生成フェーズ
// ============================================

import { generateTextWithGemini } from '@/lib/gemini-text'
import { LpSection, SectionWireframe, WireframeData } from './types'

/**
 * ワイヤーフレームを生成
 */
export async function generateWireframes(
  sections: LpSection[],
  productInfo: any
): Promise<SectionWireframe[]> {
  const wireframes: SectionWireframe[] = []

  for (const section of sections) {
    const wireframe = await generateSectionWireframe(section, productInfo)
    wireframes.push(wireframe)
  }

  return wireframes
}

/**
 * セクション単位でワイヤーフレームを生成
 */
async function generateSectionWireframe(
  section: LpSection,
  productInfo: any
): Promise<SectionWireframe> {
  const prompt = `以下のセクション情報を基に、PC版とSP版のワイヤーフレーム構造を生成してください。

セクション情報:
- ID: ${section.section_id}
- タイプ: ${section.section_type}
- 目的: ${section.purpose}
- 見出し: ${section.headline}
- サブ見出し: ${section.sub_headline || ''}
- テキスト量: ${section.text_volume}文字
- 画像必要: ${section.image_required}

商品情報:
- 商品名: ${productInfo.product_name}
- トーン: ${productInfo.tone}

以下のJSON形式で返してください:
{
  "pc": {
    "layout_structure": "レイアウト構造の説明（例: 2カラム、左にテキスト、右に画像）",
    "element_placement": {
      "text": ["見出しの配置", "本文の配置", "サブ見出しの配置"],
      "image": ["画像の配置位置"],
      "cta": ["CTAボタンの配置"]
    },
    "spacing": {
      "top": 60,
      "bottom": 60,
      "left": 40,
      "right": 40
    }
  },
  "sp": {
    "layout_structure": "レイアウト構造の説明（縦スクロール前提、1カラム）",
    "element_placement": {
      "text": ["見出しの配置", "本文の配置"],
      "image": ["画像の配置位置"],
      "cta": ["CTAボタンの配置（視認性最優先）"]
    },
    "spacing": {
      "top": 40,
      "bottom": 40,
      "left": 20,
      "right": 20
    }
  }
}

PC版は横長レイアウト、SP版は縦スクロール前提の1カラムレイアウトを想定してください。`

  const result = await generateTextWithGemini(prompt, {})
  
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        section_id: section.section_id,
        pc: parsed.pc || getDefaultWireframeData('pc'),
        sp: parsed.sp || getDefaultWireframeData('sp'),
      }
    }
  } catch (error) {
    console.error('ワイヤーフレームパースエラー:', error)
  }

  // フォールバック
  return {
    section_id: section.section_id,
    pc: getDefaultWireframeData('pc'),
    sp: getDefaultWireframeData('sp'),
  }
}

/**
 * デフォルトワイヤーフレームデータ
 */
function getDefaultWireframeData(device: 'pc' | 'sp'): WireframeData {
  if (device === 'pc') {
    return {
      layout_structure: '2カラムレイアウト、左にテキスト、右に画像',
      element_placement: {
        text: ['見出し: 上部中央', '本文: 左カラム', 'サブ見出し: 本文上部'],
        image: ['右カラム'],
        cta: ['下部中央'],
      },
      spacing: {
        top: 60,
        bottom: 60,
        left: 40,
        right: 40,
      },
    }
  } else {
    return {
      layout_structure: '1カラム縦スクロールレイアウト',
      element_placement: {
        text: ['見出し: 上部', '本文: 見出し下'],
        image: ['本文下'],
        cta: ['最下部（固定）'],
      },
      spacing: {
        top: 40,
        bottom: 40,
        left: 20,
        right: 20,
      },
    }
  }
}




