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
  // タイムアウト処理（各セクションに最大150秒）
  // Gemini APIのタイムアウト（120秒）に余裕を持たせて設定
  // Vercelの300秒タイムアウトを考慮し、並列処理で効率化
  const SECTION_TIMEOUT = 150000 // 150秒（Gemini APIの120秒 + 30秒の余裕）
  const MAX_RETRIES = 1 // 最大1回まで再試行
  const CONCURRENT_LIMIT = 3 // 同時実行数を3に制限（Gemini APIのレート制限を考慮）

  // セクションごとのワイヤーフレーム生成関数（リトライ付き）
  const generateWithRetry = async (section: LpSection): Promise<SectionWireframe> => {
    let retryCount = 0
    let lastError: Error | null = null

    while (retryCount <= MAX_RETRIES) {
      try {
        const wireframePromise = generateSectionWireframe(section, productInfo)
        let timeoutId: NodeJS.Timeout | null = null
        let promiseResolved = false
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            if (!promiseResolved) {
              promiseResolved = true
              reject(new Error('タイムアウト: ワイヤーフレーム生成に時間がかかりすぎています（150秒）'))
            }
          }, SECTION_TIMEOUT)
        })

        try {
          const result = await Promise.race([wireframePromise, timeoutPromise])
          
          promiseResolved = true
          if (timeoutId) {
            clearTimeout(timeoutId)
          }
          
          console.log(`[LP-SITE] ワイヤーフレーム生成完了: ${section.section_id}`)
          return result
        } catch (raceError: any) {
          if (raceError.message && raceError.message.includes('タイムアウト')) {
            console.warn(`[LP-SITE] タイムアウトが発火しましたが、wireframePromiseの完了を待機中: ${section.section_id}`)
            
            // 最大5秒待って、wireframePromiseの結果を確認
            try {
              const result = await Promise.race([
                wireframePromise,
                new Promise<never>((_, reject) => 
                  setTimeout(() => reject(new Error('追加タイムアウト')), 5000)
                )
              ])
              
              promiseResolved = true
              if (timeoutId) {
                clearTimeout(timeoutId)
              }
              console.log(`[LP-SITE] ワイヤーフレーム生成完了（タイムアウト後に成功）: ${section.section_id}`)
              return result
            } catch (waitError: any) {
              promiseResolved = true
              if (timeoutId) {
                clearTimeout(timeoutId)
              }
              throw raceError
            }
          } else {
            promiseResolved = true
            if (timeoutId) {
              clearTimeout(timeoutId)
            }
            throw raceError
          }
        }
      } catch (error: any) {
        console.error(`[LP-SITE] ワイヤーフレーム生成エラー (${section.section_id}, 試行 ${retryCount + 1}):`, error)
        lastError = error
        
        retryCount++
        if (retryCount > MAX_RETRIES) {
          throw new Error(`ワイヤーフレーム生成に失敗しました (${section.section_id}): ${error.message || '不明なエラー'}`)
        } else {
          // 再試行する前に少し待機
          await new Promise(resolve => setTimeout(resolve, 3000))
        }
      }
    }

    throw lastError || new Error(`ワイヤーフレーム生成に失敗しました (${section.section_id})`)
  }

  // 並列処理（同時実行数を制限）
  const wireframes: SectionWireframe[] = []
  const results: (SectionWireframe | Error)[] = new Array(sections.length)
  
  // バッチ処理：CONCURRENT_LIMIT個ずつ処理
  for (let i = 0; i < sections.length; i += CONCURRENT_LIMIT) {
    const batch = sections.slice(i, i + CONCURRENT_LIMIT)
    const batchPromises = batch.map((section, batchIndex) => 
      generateWithRetry(section)
        .then(result => ({ index: i + batchIndex, result }))
        .catch(error => ({ index: i + batchIndex, error }))
    )
    
    const batchResults = await Promise.all(batchPromises)
    
    // 結果をインデックス順に保存
    for (const { index, result, error } of batchResults) {
      if (error) {
        results[index] = error as Error
      } else {
        results[index] = result as SectionWireframe
      }
    }
  }

  // 結果を順番に整理（エラーがあればスロー）
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result instanceof Error) {
      throw result
    }
    wireframes.push(result as SectionWireframe)
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




