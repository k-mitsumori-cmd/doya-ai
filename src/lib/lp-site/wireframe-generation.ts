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

  // タイムアウト処理（各セクションに最大30秒）
  const SECTION_TIMEOUT = 30000 // 30秒
  const MAX_RETRIES = 2 // 最大2回まで再試行

  for (const section of sections) {
    let retryCount = 0
    let wireframe: SectionWireframe | null = null

    while (retryCount <= MAX_RETRIES && !wireframe) {
      try {
        // タイムアウト付きでワイヤーフレーム生成を実行
        const wireframePromise = generateSectionWireframe(section, productInfo)
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('タイムアウト: ワイヤーフレーム生成に時間がかかりすぎています')), SECTION_TIMEOUT)
        })

        wireframe = await Promise.race([wireframePromise, timeoutPromise])
        wireframes.push(wireframe)
        console.log(`[LP-SITE] ワイヤーフレーム生成完了: ${section.section_id}`)
      } catch (error: any) {
        console.error(`[LP-SITE] ワイヤーフレーム生成エラー (${section.section_id}, 試行 ${retryCount + 1}):`, error)
        
        retryCount++
        if (retryCount > MAX_RETRIES) {
          // 最大再試行回数に達した場合は、デフォルトのワイヤーフレームを使用
          console.warn(`[LP-SITE] ワイヤーフレーム生成失敗、デフォルトを使用: ${section.section_id}`)
          wireframe = {
            section_id: section.section_id,
            pc: getDefaultWireframeData('pc'),
            sp: getDefaultWireframeData('sp'),
          }
          wireframes.push(wireframe)
        } else {
          // 再試行する前に少し待機
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
    }
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

  try {
    const result = await generateTextWithGemini(prompt, {})
    
    if (!result || typeof result !== 'string') {
      throw new Error('生成結果が無効です')
    }

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
    console.error('[LP-SITE] ワイヤーフレームパースエラー:', error)
    // エラーが発生した場合は再スローして、呼び出し側で再試行できるようにする
    throw error
  }

  // JSONが見つからなかった場合のフォールバック
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




