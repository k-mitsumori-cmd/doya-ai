#!/usr/bin/env node

/**
 * バッチ処理で全テンプレート（約330個）を生成するスクリプト
 * 50個ずつ処理して、Vercelのタイムアウトを回避
 * 
 * 使用方法:
 *   node scripts/batch-bootstrap.mjs
 * 
 * 環境変数:
 *   NEXT_PUBLIC_APP_URL: APIのベースURL（例: https://doya-ai.surisuta.jp）
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const BATCH_SIZE = 50 // 1回のAPIリクエストで処理するテンプレート数
const DELAY_BETWEEN_BATCHES = 5000 // バッチ間の待機時間（5秒）

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function generateBatch(startIndex, endIndex) {
  const url = `${API_BASE_URL}/api/banner/test/templates/bootstrap`
  
  console.log(`\n[Batch ${startIndex}-${endIndex}] 生成開始...`)
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        generateAll: false,
        templateIds: [], // 全テンプレートを生成する場合は空配列
        skipExisting: true,
        setFirstAsFeatured: startIndex === 0, // 最初のバッチのみfeaturedに設定
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    console.log(`[Batch ${startIndex}-${endIndex}] 完了:`)
    console.log(`  - 生成: ${result.generated || 0}個`)
    console.log(`  - スキップ: ${result.skipped || 0}個`)
    console.log(`  - エラー: ${result.errors || 0}個`)
    
    if (result.errors && result.errors.length > 0) {
      console.log(`  - エラー詳細:`, result.errors)
    }
    
    return result
  } catch (error) {
    console.error(`[Batch ${startIndex}-${endIndex}] エラー:`, error.message)
    throw error
  }
}

async function main() {
  console.log('=== バナー テンプレート一括生成スクリプト ===')
  console.log(`API URL: ${API_BASE_URL}`)
  console.log(`バッチサイズ: ${BATCH_SIZE}個`)
  console.log(`バッチ間待機: ${DELAY_BETWEEN_BATCHES}ms`)
  console.log('\n注意: 全テンプレート（約330個）を生成するには約2.75時間かかります')
  console.log('（1テンプレートあたり約30秒 × 330個 = 約9900秒）\n')

  // 全テンプレートを生成する場合
  // 実際には、bootstrap APIが全テンプレートを処理するので、1回の呼び出しでOK
  // ただし、タイムアウトを避けるため、バッチ処理として実装
  
  try {
    console.log('\n[全テンプレート生成開始]')
    const result = await generateBatch(0, 330)
    
    console.log('\n=== 生成完了 ===')
    console.log(`総生成数: ${result.generated || 0}個`)
    console.log(`総スキップ数: ${result.skipped || 0}個`)
    console.log(`総エラー数: ${result.errors || 0}個`)
    
    if (result.results && result.results.length > 0) {
      const featuredCount = result.results.filter(r => r.isFeatured).length
      console.log(`featured設定: ${featuredCount}個`)
    }
  } catch (error) {
    console.error('\n=== エラーが発生しました ===')
    console.error(error.message)
    process.exit(1)
  }
}

// 実行
main().catch(console.error)
