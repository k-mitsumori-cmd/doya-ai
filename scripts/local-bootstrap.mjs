#!/usr/bin/env node

/**
 * ローカル環境で全テンプレート（約330個）を生成するスクリプト
 * APIエンドポイント経由で実行するため、Vercelのタイムアウト制限を回避
 * 
 * 使用方法:
 *   cd doya-ai
 *   npm run dev  # 別ターミナルでローカルサーバーを起動
 *   node scripts/local-bootstrap.mjs
 * 
 * または、tsxを使用してTypeScriptファイルを直接実行:
 *   npx tsx scripts/local-bootstrap.ts
 * 
 * 環境変数:
 *   DATABASE_URL: PostgreSQLの接続URL（必須）
 *   GOOGLE_GENAI_API_KEY: Google AI Studio APIキー（必須）
 *   NEXT_PUBLIC_APP_URL: APIのベースURL（デフォルト: http://localhost:3000）
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const DELAY_BETWEEN_REQUESTS = 1000 // APIリクエスト間の待機時間（1秒）

const prisma = new PrismaClient()

const DELAY_BETWEEN_TEMPLATES = 30000 // 30秒待機（レート制限対策）

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function callBootstrapAPI() {
  const url = `${API_BASE_URL}/api/banner/test/templates/bootstrap`
  
  console.log(`\n[一括生成開始]`)
  console.log(`API URL: ${url}`)
  console.log(`注意: 全テンプレート（約330個）を生成するには約2.75時間かかります`)
  console.log(`（1テンプレートあたり約30秒 × 330個 = 約9900秒）\n`)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        generateAll: true,
        skipExisting: true,
        setFirstAsFeatured: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    // レスポンスをストリーミングで読み込む（長時間実行のため）
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      // バッファに完全なJSONが含まれているかチェック
      // 実際には、APIは最後に一度だけJSONを返すので、この処理は簡略化できます
    }

    const result = JSON.parse(buffer)
    
    console.log('\n=== 生成完了 ===')
    console.log(`生成: ${result.generated || 0}個`)
    console.log(`スキップ: ${result.skipped || 0}個`)
    console.log(`エラー: ${result.errors || 0}個`)
    
    if (result.errors && result.errors.length > 0) {
      console.log('\nエラー詳細:')
      result.errors.forEach(err => {
        console.log(`  - ${err.templateId}: ${err.error}`)
      })
    }
    
    return result
  } catch (error) {
    console.error('\n=== エラーが発生しました ===')
    console.error(error.message)
    throw error
  }
}

async function main() {
  console.log('=== バナー テンプレート一括生成スクリプト（API経由） ===\n')
  
  // 環境変数の確認
  if (!process.env.DATABASE_URL && !API_BASE_URL.includes('localhost')) {
    console.warn('警告: DATABASE_URL環境変数が設定されていません')
    console.warn('本番環境で実行する場合は、APIエンドポイントが正しく動作することを確認してください')
  }

  try {
    await callBootstrapAPI()
    console.log('\n✓ 一括生成が完了しました')
  } catch (error) {
    console.error('\n✗ 一括生成に失敗しました')
    process.exit(1)
  }
}

// 実行
main().catch(console.error)
