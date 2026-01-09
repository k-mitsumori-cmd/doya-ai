import { Storage } from '@google-cloud/storage'
import { GoogleAuth } from 'google-auth-library'

// Google Cloud Storageの初期化
let storage: Storage | null = null
let bucketName: string | null = null

async function getStorage(): Promise<Storage> {
  if (!storage) {
    // 必須環境変数の確認（デバッグ情報付き）
    console.log('[GCS] Checking environment variables...')
    console.log('[GCS] GOOGLE_CLOUD_PROJECT_ID:', process.env.GOOGLE_CLOUD_PROJECT_ID ? `✓ (${process.env.GOOGLE_CLOUD_PROJECT_ID.substring(0, 20)}...)` : '✗')
    console.log('[GCS] GCS_BUCKET_NAME:', process.env.GCS_BUCKET_NAME ? `✓ (${process.env.GCS_BUCKET_NAME})` : '✗')
    console.log('[GCS] GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS ? `✓ (${process.env.GOOGLE_APPLICATION_CREDENTIALS.substring(0, 50)}...)` : '✗')
    console.log('[GCS] GCS_CLIENT_EMAIL:', process.env.GCS_CLIENT_EMAIL ? `✓ (${process.env.GCS_CLIENT_EMAIL})` : '✗')
    console.log('[GCS] GCS_PRIVATE_KEY:', process.env.GCS_PRIVATE_KEY ? `✓ (${process.env.GCS_PRIVATE_KEY.substring(0, 50)}...)` : '✗')
    
    if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
      console.error('[GCS] GOOGLE_CLOUD_PROJECT_ID is not set')
      throw new Error('GOOGLE_CLOUD_PROJECT_ID環境変数が設定されていません。Vercelダッシュボードで環境変数を設定してください。')
    }

    if (!process.env.GCS_BUCKET_NAME) {
      console.error('[GCS] GCS_BUCKET_NAME is not set')
      throw new Error('GCS_BUCKET_NAME環境変数が設定されていません。Vercelダッシュボードで環境変数を設定してください。')
    }

    // 環境変数から認証情報を取得
    let credentials: any = undefined
    
    // 方法1: Workload Identity Federationを使用（推奨）
    // 注意: Vercelは現在OIDCトークンを直接提供していないため、
    // この方法は将来的にVercelがOIDCをサポートした場合に使用可能になります
    // 現在は、組織ポリシーを無効化してサービスアカウントキーを使用するか、
    // 方法2または方法3を使用してください
    if (process.env.GCS_WORKLOAD_IDENTITY_PROVIDER && process.env.GCS_SERVICE_ACCOUNT_EMAIL) {
      try {
        // Workload Identity Federationの設定が完了している場合の処理
        // 現在はVercelがOIDCトークンを提供していないため、この方法は使用できません
        // 将来的にVercelがOIDCをサポートした場合に備えてコードを残しています
        console.log('[GCS] Workload Identity Federation configuration detected, but Vercel OIDC tokens are not currently available')
        console.log('[GCS] Please use service account key (GOOGLE_APPLICATION_CREDENTIALS) or individual environment variables instead')
      } catch (error) {
        console.warn('[GCS] Failed to use Workload Identity Federation:', error)
        credentials = undefined
      }
    }
    
    // 方法2: GOOGLE_APPLICATION_CREDENTIALS（JSON文字列またはファイルパス）
    // 環境変数名の確認（よくある間違いをチェック）
    const credsEnvVar = process.env.GOOGLE_APPLICATION_CREDENTIALS
    if (!credsEnvVar) {
      // 類似の環境変数名をチェック
      const envVarNames = Object.keys(process.env)
      const similarNames = envVarNames.filter(name => 
        name.toUpperCase().includes('GOOGLE') && 
        (name.toUpperCase().includes('APPLICATION') || name.toUpperCase().includes('CREDENTIAL'))
      )
      if (similarNames.length > 0) {
        console.warn('[GCS] Similar environment variable names found (may be misspelled):', similarNames)
        console.warn('[GCS] Expected: GOOGLE_APPLICATION_CREDENTIALS')
        console.warn('[GCS] Please check if the environment variable name is correct in Vercel dashboard')
      }
    }
    
    if (!credentials && credsEnvVar) {
      try {
        // JSON文字列として設定されている場合
        const credsStr = credsEnvVar.trim()
        console.log('[GCS] Attempting to parse GOOGLE_APPLICATION_CREDENTIALS, length:', credsStr.length)
        
        // 空文字列のチェック
        if (credsStr.length === 0) {
          throw new Error('GOOGLE_APPLICATION_CREDENTIALSが空です。値を設定してください。')
        }
        
        // JSONパースを試みる
        credentials = JSON.parse(credsStr)
        console.log('[GCS] Successfully parsed GOOGLE_APPLICATION_CREDENTIALS')
        console.log('[GCS] Credentials type:', credentials.type)
        console.log('[GCS] Credentials project_id:', credentials.project_id)
        console.log('[GCS] Credentials client_email:', credentials.client_email ? credentials.client_email.substring(0, 30) + '...' : 'missing')
        console.log('[GCS] Credentials private_key:', credentials.private_key ? (typeof credentials.private_key === 'string' ? (credentials.private_key.startsWith('-----BEGIN') ? 'Present (PEM format)' : credentials.private_key.substring(0, 30) + '...') : 'Present (non-string)') : 'missing')
        
        // 認証情報の検証
        if (!credentials.type || credentials.type !== 'service_account') {
          console.error('[GCS] Invalid credentials type:', credentials.type)
          throw new Error('GOOGLE_APPLICATION_CREDENTIALSの形式が正しくありません。サービスアカウントキーのJSONである必要があります。typeが"service_account"である必要があります。')
        }
        if (!credentials.project_id) {
          console.error('[GCS] Missing project_id in credentials')
          throw new Error('GOOGLE_APPLICATION_CREDENTIALSにproject_idが含まれていません。')
        }
        if (!credentials.private_key) {
          console.error('[GCS] Missing private_key in credentials')
          throw new Error('GOOGLE_APPLICATION_CREDENTIALSにprivate_keyが含まれていません。')
        }
        if (!credentials.client_email) {
          console.error('[GCS] Missing client_email in credentials')
          throw new Error('GOOGLE_APPLICATION_CREDENTIALSにclient_emailが含まれていません。')
        }
        
        console.log('[GCS] Using GOOGLE_APPLICATION_CREDENTIALS - validation passed')
      } catch (parseError: any) {
        console.error('[GCS] Error parsing GOOGLE_APPLICATION_CREDENTIALS:', parseError)
        if (parseError instanceof SyntaxError) {
          console.error('[GCS] JSON parse error details:', {
            message: parseError.message,
            inputLength: credsEnvVar?.length,
            inputPreview: credsEnvVar?.substring(0, 200),
            inputEnd: credsEnvVar?.substring(Math.max(0, credsEnvVar.length - 100)),
          })
          throw new Error(
            'GOOGLE_APPLICATION_CREDENTIALSが有効なJSON形式ではありません。\n\n' +
            '確認事項:\n' +
            '1. JSONファイルの内容をそのまま1行で貼り付けているか\n' +
            '2. 改行が含まれていないか（含まれている場合は削除）\n' +
            '3. JSONの構文が正しいか（カンマ、引用符など）\n\n' +
            'エラー詳細: ' + parseError.message
          )
        }
        throw parseError
      }
    }
    
    // 方法3: 個別の環境変数から認証情報を構築（サービスアカウントキーが作成できない場合の代替）
    if (!credentials && process.env.GCS_CLIENT_EMAIL && process.env.GCS_PRIVATE_KEY) {
      try {
        credentials = {
          type: 'service_account',
          project_id: process.env.GOOGLE_CLOUD_PROJECT_ID,
          private_key_id: process.env.GCS_PRIVATE_KEY_ID || '',
          private_key: process.env.GCS_PRIVATE_KEY.replace(/\\n/g, '\n'),
          client_email: process.env.GCS_CLIENT_EMAIL,
          client_id: process.env.GCS_CLIENT_ID || '',
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
          client_x509_cert_url: process.env.GCS_CLIENT_X509_CERT_URL || '',
        }
        console.log('[GCS] Using credentials from individual environment variables')
      } catch (error) {
        console.error('[GCS] Failed to construct credentials from environment variables:', error)
        credentials = undefined
      }
    }

    const config: any = {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    }

    if (credentials) {
      config.credentials = credentials
      console.log('[GCS] Storage client initialized successfully with credentials')
    } else {
      // 認証情報が設定されていない場合
      console.error('[GCS] No credentials provided')
      console.error('[GCS] Required environment variables:')
      console.error('[GCS]   - GOOGLE_CLOUD_PROJECT_ID:', process.env.GOOGLE_CLOUD_PROJECT_ID ? `✓ (${process.env.GOOGLE_CLOUD_PROJECT_ID})` : '✗')
      console.error('[GCS]   - GCS_BUCKET_NAME:', process.env.GCS_BUCKET_NAME ? `✓ (${process.env.GCS_BUCKET_NAME})` : '✗')
      console.error('[GCS]   - GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS ? `✓ (${process.env.GOOGLE_APPLICATION_CREDENTIALS.length} chars)` : '✗')
      console.error('[GCS]   - GCS_CLIENT_EMAIL:', process.env.GCS_CLIENT_EMAIL ? `✓ (${process.env.GCS_CLIENT_EMAIL})` : '✗')
      console.error('[GCS]   - GCS_PRIVATE_KEY:', process.env.GCS_PRIVATE_KEY ? `✓ (${process.env.GCS_PRIVATE_KEY.length} chars)` : '✗')
      
      // 環境変数名の確認（よくある間違いをチェック）
      const envVarNames = Object.keys(process.env)
      const similarNames = envVarNames.filter(name => 
        name.includes('GOOGLE') || name.includes('APPLICATION') || name.includes('CREDENTIAL')
      )
      if (similarNames.length > 0) {
        console.error('[GCS] Similar environment variable names found:', similarNames)
      }
      
      const missingVars = []
      if (!process.env.GOOGLE_CLOUD_PROJECT_ID) missingVars.push('GOOGLE_CLOUD_PROJECT_ID')
      if (!process.env.GCS_BUCKET_NAME) missingVars.push('GCS_BUCKET_NAME')
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GCS_CLIENT_EMAIL && !process.env.GCS_PRIVATE_KEY) {
        missingVars.push('GOOGLE_APPLICATION_CREDENTIALS または (GCS_CLIENT_EMAIL + GCS_PRIVATE_KEY)')
      }
      
      throw new Error(
        `Google Cloud Storageの認証情報が設定されていません。\n\n` +
        `設定が必要な環境変数:\n${missingVars.map(v => `- ${v}`).join('\n')}\n\n` +
        `Vercelダッシュボードで環境変数を設定してください。\n` +
        `環境変数名は完全に一致している必要があります（大文字小文字も含む）。`
      )
    }

    storage = new Storage(config)
  }
  return storage
}

function getBucketName(): string {
  if (!bucketName) {
    bucketName = process.env.GCS_BUCKET_NAME || 'doya-interview-storage'
  }
  return bucketName
}

export interface UploadResult {
  url: string
  pathname: string
  size: number
}

/**
 * Google Cloud Storageにファイルをアップロード
 */
export async function uploadToGCS(
  filePath: string,
  buffer: Buffer | ArrayBuffer,
  options?: {
    contentType?: string
    public?: boolean
  }
): Promise<UploadResult> {
  const storage = await getStorage()
  const bucket = storage.bucket(getBucketName())
  const file = bucket.file(filePath)

  const bufferData = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer

  try {
    // 均一バケットレベルアクセスが有効な場合、publicオプションは使用できない
    // 代わりに、バケットレベルで公開設定を行う必要がある
    await file.save(bufferData, {
      metadata: {
        contentType: options?.contentType || 'application/octet-stream',
      },
      // publicオプションは削除（均一バケットレベルアクセスを使用）
    })
  } catch (saveError: any) {
    // エラーの詳細をログに記録
    const errorDetails: any = {
      message: saveError?.message,
      code: saveError?.code,
      filePath,
      bucketName: getBucketName(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    }
    
    // レスポンスがある場合は追加情報を取得
    if (saveError?.response) {
      errorDetails.responseStatus = saveError.response.status
      errorDetails.responseData = saveError.response.data
    }
    
    // エラーの種類を判定
    if (saveError?.code === 401 || saveError?.message?.includes('Unauthorized')) {
      errorDetails.errorType = 'AUTHENTICATION_ERROR'
      errorDetails.suggestion = 'GOOGLE_APPLICATION_CREDENTIALS環境変数を確認してください'
    } else if (saveError?.code === 403 || saveError?.message?.includes('Forbidden')) {
      errorDetails.errorType = 'PERMISSION_ERROR'
      errorDetails.suggestion = 'サービスアカウントにStorage Object Adminロールが付与されているか確認してください'
    } else if (saveError?.code === 404 || saveError?.message?.includes('Not found')) {
      errorDetails.errorType = 'BUCKET_NOT_FOUND'
      errorDetails.suggestion = 'GCS_BUCKET_NAME環境変数が正しいか、バケットが存在するか確認してください'
    }
    
    console.error('[GCS] File save error details:', JSON.stringify(errorDetails, null, 2))
    throw saveError
  }

  // 公開URLを取得
  const url = `https://storage.googleapis.com/${getBucketName()}/${filePath}`
  const pathname = filePath

  // ファイルサイズを取得
  const [metadata] = await file.getMetadata()
  const size = typeof metadata.size === 'string' ? parseInt(metadata.size, 10) : (metadata.size || 0)

  return {
    url,
    pathname,
    size,
  }
}

/**
 * Google Cloud Storageからファイルを削除
 */
export async function deleteFromGCS(fileUrl: string | null): Promise<void> {
  if (!fileUrl) {
    return
  }

  try {
    const storage = await getStorage()
    const bucket = storage.bucket(getBucketName())

    // URLからパスを抽出
    // https://storage.googleapis.com/bucket-name/path/to/file
    const urlPattern = /https:\/\/storage\.googleapis\.com\/[^/]+\/(.+)$/
    const match = fileUrl.match(urlPattern)

    if (match && match[1]) {
      const filePath = decodeURIComponent(match[1])
      const file = bucket.file(filePath)
      await file.delete()
      console.log(`[GCS] Deleted file: ${filePath}`)
    } else {
      // URL形式でない場合は、そのままパスとして使用
      const file = bucket.file(fileUrl)
      await file.delete()
      console.log(`[GCS] Deleted file: ${fileUrl}`)
    }
  } catch (error) {
    console.error(`[GCS] Failed to delete file: ${fileUrl}`, error)
    throw error
  }
}

/**
 * Google Cloud Storageからファイルを取得
 */
export async function getFileFromGCS(fileUrl: string | null): Promise<Buffer> {
  if (!fileUrl) {
    throw new Error('File URL is required')
  }

  const storage = await getStorage()
  const bucket = storage.bucket(getBucketName())

  // URLからパスを抽出
  const urlPattern = /https:\/\/storage\.googleapis\.com\/[^/]+\/(.+)$/
  const match = fileUrl.match(urlPattern)

  if (match && match[1]) {
    const filePath = decodeURIComponent(match[1])
    const file = bucket.file(filePath)
    const [buffer] = await file.download()
    return buffer
  } else {
    // URL形式でない場合は、そのままパスとして使用
    const file = bucket.file(fileUrl)
    const [buffer] = await file.download()
    return buffer
  }
}

/**
 * Google Cloud Storageの使用状況を取得
 */
export async function getGCSUsage(): Promise<{
  totalSize: number
  fileCount: number
}> {
  const storage = await getStorage()
  const bucket = storage.bucket(getBucketName())

  const [files] = await bucket.getFiles({
    prefix: 'interview/',
  })

  let totalSize = 0
  for (const file of files) {
    const [metadata] = await file.getMetadata()
    totalSize += typeof metadata.size === 'string' ? parseInt(metadata.size, 10) : (metadata.size || 0)
  }

  return {
    totalSize,
    fileCount: files.length,
  }
}

/**
 * 署名付きURLを生成（クライアントから直接アップロード用）
 * @param filePath GCS内のファイルパス
 * @param contentType ファイルのContent-Type
 * @param expiresIn 有効期限（秒、デフォルト: 1時間）
 * @returns 署名付きURLとアップロード用のメタデータ
 */
export async function generateSignedUploadUrl(
  filePath: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<{
  signedUrl: string
  filePath: string
  publicUrl: string
}> {
  try {
    const storage = await getStorage()
    const bucket = storage.bucket(getBucketName())
    const file = bucket.file(filePath)

    // 署名付きURLを生成（PUTメソッドでアップロード可能）
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + expiresIn * 1000,
      contentType,
    })

    // 公開URLも生成
    const publicUrl = `https://storage.googleapis.com/${getBucketName()}/${filePath}`

    return {
      signedUrl,
      filePath,
      publicUrl,
    }
  } catch (error: any) {
    // 認証エラーの場合は詳細なメッセージを返す
    if (error?.message?.includes('認証情報') || 
        error?.message?.includes('GOOGLE_APPLICATION_CREDENTIALS') ||
        error?.message?.includes('credentials')) {
      const missingVars = []
      if (!process.env.GOOGLE_CLOUD_PROJECT_ID) missingVars.push('GOOGLE_CLOUD_PROJECT_ID')
      if (!process.env.GCS_BUCKET_NAME) missingVars.push('GCS_BUCKET_NAME')
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && 
          !process.env.GCS_CLIENT_EMAIL && 
          !process.env.GCS_PRIVATE_KEY) {
        missingVars.push('GOOGLE_APPLICATION_CREDENTIALS または GCS_CLIENT_EMAIL + GCS_PRIVATE_KEY')
      }
      
      throw new Error(
        `Google Cloud Storageの認証情報が設定されていません。\n\n` +
        `設定が必要な環境変数:\n${missingVars.map(v => `- ${v}`).join('\n')}\n\n` +
        `Vercelダッシュボードで環境変数を設定してください。\n` +
        `詳細: ${error?.message || '不明なエラー'}`
      )
    }
    
    // その他のエラー
    console.error('[GCS] Error generating signed URL:', error)
    throw new Error(
      `署名付きURLの生成に失敗しました: ${error?.message || '不明なエラー'}\n` +
      `エラーコード: ${error?.code || 'なし'}`
    )
  }
}

