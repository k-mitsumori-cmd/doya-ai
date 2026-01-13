// ============================================
// Step 3: ワイヤーフレーム生成フェーズ
// ChatGPT APIを使用して高速化（Geminiより5-10倍高速）
// ============================================

import OpenAI from 'openai'
import { LpSection, SectionWireframe, WireframeData } from './types'

// OpenAIクライアントを遅延初期化
let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY環境変数が設定されていません')
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiClient
}

/**
 * ワイヤーフレームを生成（ChatGPT API使用、並列処理で高速化）
 */
export async function generateWireframes(
  sections: LpSection[],
  productInfo: any
): Promise<SectionWireframe[]> {
  // ChatGPTは高速なので、タイムアウトを短く設定
  const SECTION_TIMEOUT = 30000 // 30秒（ChatGPTは通常5-10秒で応答）
  const MAX_RETRIES = 1 // 最大1回まで再試行
  // ChatGPTは高速なので並列処理を有効化
  const USE_PARALLEL = true
  const CONCURRENT_LIMIT = 5 // 同時に5セクションまで処理

  console.log(`[LP-SITE] ワイヤーフレーム生成開始（ChatGPT API、並列処理）: ${sections.length}セクション`)

  // セクションごとのワイヤーフレーム生成関数（リトライ付き）
  const generateWithRetry = async (section: LpSection): Promise<SectionWireframe> => {
    let retryCount = 0
    let lastError: Error | null = null

    while (retryCount <= MAX_RETRIES) {
      try {
        const wireframePromise = generateSectionWireframe(section, productInfo)
        let timeoutId: NodeJS.Timeout | null = null
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('タイムアウト: ワイヤーフレーム生成に時間がかかりすぎています（30秒）'))
          }, SECTION_TIMEOUT)
        })

        const result = await Promise.race([wireframePromise, timeoutPromise])
        
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        
        console.log(`[LP-SITE] ワイヤーフレーム生成完了: ${section.section_id}`)
        return result
      } catch (error: any) {
        console.error(`[LP-SITE] ワイヤーフレーム生成エラー (${section.section_id}, 試行 ${retryCount + 1}):`, error.message)
        lastError = error
        
        retryCount++
        if (retryCount > MAX_RETRIES) {
          // エラーでもデフォルトワイヤーフレームを返す
          console.warn(`[LP-SITE] デフォルトワイヤーフレームを使用: ${section.section_id}`)
          return {
            section_id: section.section_id,
            pc: getDefaultWireframeData('pc'),
            sp: getDefaultWireframeData('sp'),
          }
        } else {
          // 再試行する前に少し待機
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }

    // フォールバック
    return {
      section_id: section.section_id,
      pc: getDefaultWireframeData('pc'),
      sp: getDefaultWireframeData('sp'),
    }
  }

  const wireframes: SectionWireframe[] = []
  
  if (USE_PARALLEL) {
    // 並列処理（バッチ処理）- ChatGPTは高速なので並列処理が効果的
    for (let i = 0; i < sections.length; i += CONCURRENT_LIMIT) {
      const batch = sections.slice(i, i + CONCURRENT_LIMIT)
      console.log(`[LP-SITE] バッチ処理開始: ${i + 1}-${Math.min(i + CONCURRENT_LIMIT, sections.length)}/${sections.length}`)
      
      const batchPromises = batch.map((section) => generateWithRetry(section))
      const batchResults = await Promise.all(batchPromises)
      
      wireframes.push(...batchResults)
    }
  } else {
    // 順次処理
    for (const section of sections) {
      const wireframe = await generateWithRetry(section)
      wireframes.push(wireframe)
    }
  }

  console.log(`[LP-SITE] ワイヤーフレーム生成完了: ${wireframes.length}セクション`)
  return wireframes
}

/**
 * セクション単位でワイヤーフレームを生成（ChatGPT API使用）
 */
async function generateSectionWireframe(
  section: LpSection,
  productInfo: any
): Promise<SectionWireframe> {
  const openai = getOpenAI()
  
  const prompt = `以下のセクション情報を基に、PC版とSP版のワイヤーフレーム構造をJSON形式で生成してください。

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

以下のJSON形式のみを返してください（説明文は不要）:
{
  "pc": {
    "layout_structure": "レイアウト構造の説明",
    "element_placement": {
      "text": ["見出しの配置", "本文の配置"],
      "image": ["画像の配置位置"],
      "cta": ["CTAボタンの配置"]
    },
    "spacing": { "top": 60, "bottom": 60, "left": 40, "right": 40 }
  },
  "sp": {
    "layout_structure": "レイアウト構造の説明",
    "element_placement": {
      "text": ["見出しの配置", "本文の配置"],
      "image": ["画像の配置位置"],
      "cta": ["CTAボタンの配置"]
    },
    "spacing": { "top": 40, "bottom": 40, "left": 20, "right": 20 }
  }
}`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // 高速で安価なモデル
      messages: [
        {
          role: 'system',
          content: 'あなたはLPデザインの専門家です。ワイヤーフレーム構造をJSON形式で生成してください。JSONのみを返し、説明文は含めないでください。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // 一貫性のある出力
      max_tokens: 1000,
      response_format: { type: 'json_object' }, // JSON形式を強制
    })

    const result = response.choices[0]?.message?.content
    console.log(`[LP-SITE] ChatGPT応答受信: ${section.section_id}`)
    
    if (!result) {
      throw new Error('生成結果が空です')
    }

    const parsed = JSON.parse(result)
    return {
      section_id: section.section_id,
      pc: parsed.pc || getDefaultWireframeData('pc'),
      sp: parsed.sp || getDefaultWireframeData('sp'),
    }
  } catch (error: any) {
    console.error('[LP-SITE] ワイヤーフレームパースエラー:', error.message)
    throw error
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




