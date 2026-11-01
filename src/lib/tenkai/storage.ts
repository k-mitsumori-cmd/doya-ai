// ============================================
// ドヤ展開AI — Supabase Storage クライアント
// ============================================
// interviewパターンを踏襲し、tenkai-videos バケットを管理

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { ensurePrivateImageBucket } from '@/lib/private-storage-bucket'

const BUCKET_NAME = process.env.TENKAI_STORAGE_BUCKET || 'tenkai-videos'

let _client: SupabaseClient | null = null

/**
 * サーバーサイド用 Supabase クライアント (service_role キー使用)
 */
function getSupabaseAdmin(): SupabaseClient {
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
 * ストレージバケットを確保 (なければ作成)
 */
async function ensureBucket(): Promise<void> {
  await ensurePrivateImageBucket(getSupabaseAdmin().storage, BUCKET_NAME)
}

/**
 * 署名付きアップロードURL を生成
 * パス形式: {userId}/{projectId}/{timestamp}_{fileName}
 */
export async function getUploadSignedUrl(
  storagePath: string
): Promise<{ signedUrl: string; path: string; token: string }> {
  const supabase = getSupabaseAdmin()
  await ensureBucket()

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    throw new Error('アップロードURLを生成できませんでした')
  }

  return {
    signedUrl: data.signedUrl,
    path: data.path,
    token: data.token,
  }
}

/**
 * 署名付きダウンロードURL を取得
 */
export async function getDownloadSignedUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string> {
  const supabase = getSupabaseAdmin()
  await ensureBucket()

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    throw new Error('署名付きURLを取得できませんでした')
  }

  return data.signedUrl
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
    console.error("[lib/tenkai/storage] failed")
  }
}

/**
 * ストレージパスの生成
 * 形式: {userId}/{projectId}/{timestamp}_{fileName}
 */
export function buildStoragePath(opts: {
  userId: string
  projectId: string
  fileName: string
}): string {
  const safeFileName = opts.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const timestamp = Date.now()
  return `${opts.userId}/${opts.projectId}/${timestamp}_${safeFileName}`
}
