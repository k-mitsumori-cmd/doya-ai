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

    // レスポンスを読み込む
    const result = await response.json()
    
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
  console.log(`API URL: ${API_BASE_URL}`)
  
  // 環境変数の確認
  if (API_BASE_URL.includes('localhost')) {
    console.warn('\n⚠️  ローカル環境で実行する場合:')
    console.warn('  1. .env.local ファイルを作成してください')
    console.warn('  2. DATABASE_URL と GOOGLE_GENAI_API_KEY を設定してください')
    console.warn('  3. ローカルサーバーを起動してください: npm run dev\n')
  } else {
    console.log('本番環境のAPIエンドポイントを使用します')
    console.log('注意: Vercelのタイムアウト制限（最大600秒）があるため、')
    console.log('全テンプレート（約330個）の生成は一度には完了しません。\n')
  }

  try {
    await callBootstrapAPI()
    console.log('\n✓ 一括生成が完了しました')
  } catch (error) {
    console.error('\n✗ 一括生成に失敗しました')
    console.error('\n解決方法:')
    if (API_BASE_URL.includes('localhost')) {
      console.error('  1. .env.local ファイルに DATABASE_URL を設定してください')
      console.error('  2. ローカルサーバーが起動していることを確認してください')
      console.error('  3. サーバーログでエラー詳細を確認してください')
    } else {
      console.error('  1. 本番環境のAPIエンドポイントが正しく動作しているか確認してください')
      console.error('  2. 環境変数（DATABASE_URL, GOOGLE_GENAI_API_KEY）が設定されているか確認してください')
    }
    process.exit(1)
  }
}

// 実行
main().catch(console.error)
