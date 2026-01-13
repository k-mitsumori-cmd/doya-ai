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
  // タイムアウト処理（各セクションに最大90秒）
  // Gemini APIのタイムアウト（120秒）より短く設定し、Vercelの300秒タイムアウトを回避
  // 実際の処理時間は30-60秒程度なので、90秒で十分
  const SECTION_TIMEOUT = 90000 // 90秒（実際の処理時間30-60秒 + 余裕）
  const MAX_RETRIES = 1 // 最大1回まで再試行
  // 以前は順次処理で動作していたため、並列処理ではなく順次処理に戻す
  // これにより、Vercelの300秒タイムアウトを確実に回避できる
  const USE_PARALLEL = false // 順次処理に戻す（以前の動作を再現）
  const CONCURRENT_LIMIT = 2 // 並列処理を使用する場合の同時実行数

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
              reject(new Error('タイムアウト: ワイヤーフレーム生成に時間がかかりすぎています（90秒）'))
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

  // 以前の実装に戻す：順次処理（並列処理はタイムアウトの原因となる可能性がある）
  // 部分的に成功した場合でも続行できるようにする
  const wireframes: SectionWireframe[] = []
  const errors: Array<{ sectionId: string; error: Error }> = []
  
  if (USE_PARALLEL) {
    // 並列処理（バッチ処理）
    for (let i = 0; i < sections.length; i += CONCURRENT_LIMIT) {
      const batch = sections.slice(i, i + CONCURRENT_LIMIT)
      const batchPromises = batch.map((section) => 
        generateWithRetry(section)
          .then(result => ({ sectionId: section.section_id, result, error: null }))
          .catch(error => ({ sectionId: section.section_id, result: null, error }))
      )
      
      const batchResults = await Promise.all(batchPromises)
      
      // 結果を処理（成功したものは追加、エラーは記録）
      for (const { sectionId, result, error } of batchResults) {
        if (error) {
          console.error(`[LP-SITE] セクション ${sectionId} のワイヤーフレーム生成に失敗しましたが、処理を続行します:`, error)
          errors.push({ sectionId, error: error as Error })
          // エラーが発生した場合でも、デフォルトワイヤーフレームを使用して続行
          wireframes.push({
            section_id: sectionId,
            pc: getDefaultWireframeData('pc'),
            sp: getDefaultWireframeData('sp'),
          })
        } else if (result) {
          wireframes.push(result as SectionWireframe)
        }
      }
    }
  } else {
    // 順次処理（以前の実装、確実に動作する）
    for (const section of sections) {
      try {
        const wireframe = await generateWithRetry(section)
        wireframes.push(wireframe)
      } catch (error: any) {
        console.error(`[LP-SITE] セクション ${section.section_id} のワイヤーフレーム生成に失敗しましたが、デフォルトワイヤーフレームを使用して続行します:`, error)
        errors.push({ sectionId: section.section_id, error: error as Error })
        // エラーが発生した場合でも、デフォルトワイヤーフレームを使用して続行
        wireframes.push({
          section_id: section.section_id,
          pc: getDefaultWireframeData('pc'),
          sp: getDefaultWireframeData('sp'),
        })
      }
    }
  }

  // すべてのセクションでエラーが発生した場合のみエラーをスロー
  if (wireframes.length === 0) {
    throw new Error(`すべてのセクションでワイヤーフレーム生成に失敗しました: ${errors.map(e => e.sectionId).join(', ')}`)
  }

  // 一部のセクションでエラーが発生した場合は警告をログに記録
  if (errors.length > 0) {
    console.warn(`[LP-SITE] ${errors.length}個のセクションでワイヤーフレーム生成に失敗しましたが、デフォルトワイヤーフレームを使用して続行します`)
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




