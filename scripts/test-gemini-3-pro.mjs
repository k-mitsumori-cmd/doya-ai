#!/usr/bin/env node

/**
 * gemini-3-proモデルの動作確認スクリプト
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

function getApiKey() {
  const candidates = [
    process.env.GOOGLE_GENAI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  ].filter((v) => typeof v === 'string' && v.trim().length > 0)

  const apiKey = candidates[0]
  if (!apiKey) {
    throw new Error(
      'Gemini APIキーが設定されていません。環境変数: GOOGLE_GENAI_API_KEY（推奨）/ GOOGLE_API_KEY / GEMINI_API_KEY を設定してください。'
    )
  }
  return apiKey.trim()
}

async function checkModelAvailability(modelName) {
  const apiKey = getApiKey()
  const endpoint = `${GEMINI_API_BASE}/models/${modelName}`
  
  console.log(`\n[1] モデル情報の取得: ${modelName}`)
  console.log(`    Endpoint: ${endpoint}`)
  
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey,
      },
    })

    if (res.ok) {
      const modelInfo = await res.json()
      console.log(`    ✅ モデルが利用可能です`)
      console.log(`    モデル名: ${modelInfo.name || modelName}`)
      console.log(`    表示名: ${modelInfo.displayName || 'N/A'}`)
      console.log(`    説明: ${modelInfo.description || 'N/A'}`)
      return true
    } else {
      const errorText = await res.text()
      console.log(`    ❌ モデルが利用できません (${res.status})`)
      console.log(`    エラー: ${errorText.substring(0, 200)}`)
      return false
    }
  } catch (e) {
    console.log(`    ❌ エラーが発生しました: ${e.message}`)
    return false
  }
}

async function testGenerateContent(modelName) {
  const apiKey = getApiKey()
  const endpoint = `${GEMINI_API_BASE}/models/${modelName}:generateContent`
  
  console.log(`\n[2] コンテンツ生成のテスト: ${modelName}`)
  console.log(`    Endpoint: ${endpoint}`)
  
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'こんにちは。1+1は？',
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 100,
        },
      }),
    })

    if (res.ok) {
      const json = await res.json()
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      console.log(`    ✅ コンテンツ生成に成功しました`)
      console.log(`    レスポンス: ${text.substring(0, 100)}...`)
      return true
    } else {
      const errorText = await res.text()
      console.log(`    ❌ コンテンツ生成に失敗しました (${res.status})`)
      console.log(`    エラー: ${errorText.substring(0, 500)}`)
      return false
    }
  } catch (e) {
    console.log(`    ❌ エラーが発生しました: ${e.message}`)
    return false
  }
}

async function listAvailableModels() {
  const apiKey = getApiKey()
  const endpoint = `${GEMINI_API_BASE}/models`
  
  console.log(`\n[3] 利用可能なモデル一覧の取得`)
  console.log(`    Endpoint: ${endpoint}`)
  
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey,
      },
    })

    if (res.ok) {
      const json = await res.json()
      const models = json?.models || []
      console.log(`    ✅ ${models.length}個のモデルが見つかりました`)
      
      const gemini3Models = models.filter((m) => 
        m.name?.includes('gemini-3') || m.name?.includes('gemini-3-pro')
      )
      
      if (gemini3Models.length > 0) {
        console.log(`\n    Gemini 3系モデル:`)
        gemini3Models.forEach((m) => {
          console.log(`      - ${m.name} (${m.displayName || 'N/A'})`)
        })
      } else {
        console.log(`    ⚠️  Gemini 3系モデルは見つかりませんでした`)
      }
      
      // 利用可能な主要モデルを表示
      const majorModels = models
        .filter((m) => {
          const name = m.name || ''
          return (
            name.includes('gemini-2') ||
            name.includes('gemini-1.5') ||
            name.includes('gemini-1.0')
          )
        })
        .slice(0, 10)
      
      if (majorModels.length > 0) {
        console.log(`\n    利用可能な主要モデル (最大10件):`)
        majorModels.forEach((m) => {
          console.log(`      - ${m.name}`)
        })
      }
      
      return true
    } else {
      const errorText = await res.text()
      console.log(`    ❌ モデル一覧の取得に失敗しました (${res.status})`)
      console.log(`    エラー: ${errorText.substring(0, 200)}`)
      return false
    }
  } catch (e) {
    console.log(`    ❌ エラーが発生しました: ${e.message}`)
    return false
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('Gemini 3 Pro モデル動作確認スクリプト')
  console.log('='.repeat(60))
  
  const modelName = 'gemini-3-pro'
  
  // 1. モデルの利用可能性を確認
  const isAvailable = await checkModelAvailability(modelName)
  
  // 2. 実際にコンテンツ生成をテスト
  if (isAvailable) {
    await testGenerateContent(modelName)
  } else {
    console.log(`\n    ⚠️  モデルが利用できないため、コンテンツ生成テストをスキップします`)
  }
  
  // 3. 利用可能なモデル一覧を取得
  await listAvailableModels()
  
  console.log('\n' + '='.repeat(60))
  if (isAvailable) {
    console.log('✅ gemini-3-proは利用可能です')
  } else {
    console.log('❌ gemini-3-proは利用できません')
    console.log('   フォールバックモデル（gemini-1.5-pro等）またはChatGPT APIが使用されます')
  }
  console.log('='.repeat(60))
}

main().catch((e) => {
  console.error('エラー:', e)
  process.exit(1)
})

