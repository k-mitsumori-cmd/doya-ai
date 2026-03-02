// ============================================
// ドヤインタビュー — Supabase Storage クライアント
// ============================================
// 大容量ファイルを Vercel を経由せずに
// クライアントから直接 Supabase Storage へアップロードするための基盤
//
// フロー:
// 1. クライアント → API: 署名付きアップロードURL取得
// 2. クライアント → Supabase Storage: ファイルを直接PUT
// 3. クライアント → API: アップロード完了通知 → DB保存

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const BUCKET_NAME = process.env.INTERVIEW_STORAGE_BUCKET || 'interview-materials'

let _client: SupabaseClient | null = null
let _bucketReady = false
let _detectedMaxBytes = 0 // 検出されたプラン上限 (バイト)

/**
 * サーバーサイド用 Supabase クライアント (service_role キー使用)
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Supabase Storage 未設定: NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を環境変数に追加してください'
    )
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  })
  return _client
}

/**
 * ストレージバケットを確保 (なければ作成) + プラン上限を自動検出して設定
 * 初回のみ実行し、以降はキャッシュ
 */
export async function ensureBucket(): Promise<void> {
  if (_bucketReady) return
  const supabase = getSupabaseAdmin()

  const { data } = await supabase.storage.getBucket(BUCKET_NAME)
  if (!data) {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
    })
    if (error && !error.message?.includes('already exists')) {
      throw new Error(`Bucket作成失敗: ${error.message}`)
    }
  }

  // プラン上限を自動検出: 大きい値から試して最大値を設定
  // Free=50MB, Pro=5GB, Enterprise=50GB
  const candidates = [
    5 * 1024 * 1024 * 1024,   // 5GB (Pro)
    500 * 1024 * 1024,         // 500MB
    50 * 1024 * 1024,          // 50MB (Free)
  ]

  for (const bytes of candidates) {
    const { error } = await supabase.storage.updateBucket(BUCKET_NAME, {
      fileSizeLimit: bytes,
    })
    if (!error) {
      _detectedMaxBytes = bytes
      const mb = Math.round(bytes / 1024 / 1024)
      console.log(`[interview] Bucket file_size_limit set to ${mb}MB`)
      break
    }
  }

  _bucketReady = true
}

/**
 * 検出されたプラン上限 (バイト) を返す
 * ensureBucket() 実行後に有効
 */
export function getDetectedMaxFileSize(): number {
  return _detectedMaxBytes || 5 * 1024 * 1024 * 1024 // デフォルト 5GB (Pro)
}

/**
 * 署名付きアップロードURL を生成
 * クライアントはこのURLに対してPUTリクエストでファイルを直接送信する
 */
export async function createSignedUploadUrl(
  storagePath: string
): Promise<{ signedUrl: string; path: string; token: string }> {
  const supabase = getSupabaseAdmin()
  await ensureBucket()

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    throw new Error(`アップロードURL生成失敗: ${error?.message || '不明なエラー'}`)
  }

  return {
    signedUrl: data.signedUrl,
    path: data.path,
    token: data.token,
  }
}

/**
 * ファイルの公開URLを取得 (署名付き、有効期限あり)
 */
export async function getSignedFileUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    throw new Error(`署名付きURL取得失敗: ${error?.message || '不明なエラー'}`)
  }

  return data.signedUrl
}

/**
 * ファイルの存在確認 + メタデータ取得
 */
export async function getFileMetadata(
  storagePath: string
): Promise<{ size: number; mimeType: string } | null> {
  const supabase = getSupabaseAdmin()

  // list で該当パスのファイルを探す
  const parts = storagePath.split('/')
  const fileName = parts.pop()!
  const folder = parts.join('/')

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(folder, { search: fileName, limit: 1 })

  if (error || !data || data.length === 0) {
    return null
  }

  const file = data[0]
  return {
    size: file.metadata?.size ?? 0,
    mimeType: file.metadata?.mimetype ?? 'application/octet-stream',
  }
}

/**
 * ファイル削除
 */
export async function deleteFile(storagePath: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath])

  if (error) {
    console.error(`[interview] File delete failed: ${storagePath}`, error.message)
  }
}

/**
 * ストレージパスの生成
 * 形式: {userId|guest_{guestId}}/{projectId}/{timestamp}_{fileName}
 */
export function buildStoragePath(opts: {
  userId?: string | null
  guestId?: string | null
  projectId: string
  fileName: string
}): string {
  const owner = opts.userId || `guest_${opts.guestId || 'anon'}`
  const safeFileName = opts.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const timestamp = Date.now()
  return `${owner}/${opts.projectId}/${timestamp}_${safeFileName}`
}
