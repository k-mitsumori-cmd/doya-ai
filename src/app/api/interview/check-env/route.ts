import { NextRequest, NextResponse } from 'next/server'

// 環境変数の設定状況を確認（デバッグ用）
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    // すべての環境変数名を取得
    const allEnvVarNames = Object.keys(process.env)
    
    // 必要な環境変数のリスト
    const requiredVars = [
      'GOOGLE_CLOUD_PROJECT_ID',
      'GCS_BUCKET_NAME',
      'GOOGLE_APPLICATION_CREDENTIALS',
    ]
    
    const optionalVars = [
      'GCS_CLIENT_EMAIL',
      'GCS_PRIVATE_KEY',
    ]
    
    // 環境変数のチェック結果
    const checks: Record<string, {
      exists: boolean
      exactMatch: boolean
      similarNames: string[]
      valuePreview?: string
      valueLength?: number
    }> = {}
    
    // 類似の環境変数名を検出する関数
    function findSimilarNames(expectedName: string, allNames: string[]): string[] {
      return allNames.filter(name => {
        const nameUpper = name.toUpperCase()
        const expectedUpper = expectedName.toUpperCase()
        
        // 完全一致（大文字小文字が違う）
        if (nameUpper === expectedUpper && name !== expectedName) {
          return true
        }
        
        // 部分一致（よくある間違いを検出）
        if (nameUpper.includes(expectedUpper.substring(0, Math.min(20, expectedUpper.length))) ||
            expectedUpper.includes(nameUpper.substring(0, Math.min(20, nameUpper.length)))) {
          return name !== expectedName
        }
        
        return false
      })
    }
    
    // 必須環境変数のチェック
    for (const varName of requiredVars) {
      const value = process.env[varName]
      const exists = value !== undefined && value !== null && value.trim() !== ''
      const exactMatch = exists
      const similarNames = findSimilarNames(varName, allEnvVarNames)
      
      checks[varName] = {
        exists,
        exactMatch,
        similarNames,
        valuePreview: exists ? (varName === 'GOOGLE_APPLICATION_CREDENTIALS' 
          ? `${value!.substring(0, 50)}...` 
          : value!.substring(0, 30)) : undefined,
        valueLength: exists ? value!.length : undefined,
      }
    }
    
    // オプション環境変数のチェック
    for (const varName of optionalVars) {
      const value = process.env[varName]
      const exists = value !== undefined && value !== null && value.trim() !== ''
      const exactMatch = exists
      const similarNames = findSimilarNames(varName, allEnvVarNames)
      
      checks[varName] = {
        exists,
        exactMatch,
        similarNames,
        valuePreview: exists ? (varName === 'GCS_PRIVATE_KEY' 
          ? `${value!.substring(0, 50)}...` 
          : value!) : undefined,
        valueLength: exists ? value!.length : undefined,
      }
    }
    
    // 結果の集計
    const allRequiredExist = requiredVars.every(name => checks[name].exists)
    const hasSimilarNames = Object.values(checks).some(check => check.similarNames.length > 0)
    
    // JSON形式の確認（GOOGLE_APPLICATION_CREDENTIALS）
    let jsonValid = false
    let jsonError: string | null = null
    if (checks['GOOGLE_APPLICATION_CREDENTIALS'].exists) {
      try {
        const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS!.trim())
        jsonValid = creds.type === 'service_account' && 
                   creds.project_id && 
                   creds.private_key && 
                   creds.client_email
      } catch (error) {
        jsonError = error instanceof Error ? error.message : 'Unknown error'
      }
    }
    
    return NextResponse.json({
      status: allRequiredExist && !hasSimilarNames && jsonValid ? 'ok' : 'error',
      message: allRequiredExist && !hasSimilarNames && jsonValid 
        ? 'すべての環境変数が正しく設定されています' 
        : '環境変数の設定に問題があります',
      checks,
      summary: {
        allRequiredExist,
        hasSimilarNames,
        jsonValid,
        jsonError,
      },
      recommendations: hasSimilarNames ? [
        '類似の環境変数名が見つかりました。環境変数名が完全に一致しているか確認してください。',
        'Vercelダッシュボードで環境変数名を修正し、再デプロイしてください。',
      ] : [],
    })
  } catch (error) {
    console.error('[ENV CHECK] Error:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: '環境変数の確認中にエラーが発生しました',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

