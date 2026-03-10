// ============================================
// ドヤボイスAI — Supabase Storage 音声ファイル管理
// ============================================

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const BUCKET_NAME = process.env.VOICE_STORAGE_BUCKET || 'voice-audio'
const MIME_MAP: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
}

let _client: SupabaseClient | null = null
let _bucketReady = false

function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase Storage 未設定')
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  })
  return _client
}

async function ensureBucket(): Promise<void> {
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
  _bucketReady = true
}

/**
 * 音声ファイルをSupabase Storageにアップロードし署名付きURLを返す
 */
export async function uploadVoiceAudio(opts: {
  userId: string
  projectId: string
  audioBase64: string
  format: string
}): Promise<string> {
  const supabase = getSupabaseAdmin()
  await ensureBucket()

  const buffer = Buffer.from(opts.audioBase64, 'base64')
  const storagePath = `${opts.userId}/${opts.projectId}/${Date.now()}.${opts.format}`
  const mimeType = MIME_MAP[opts.format] || 'audio/mpeg'

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    })

  if (error) {
    throw new Error(`音声アップロード失敗: ${error.message}`)
  }

  // 署名付きURL（1年有効）
  const { data, error: urlError } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, 365 * 24 * 3600)

  if (urlError || !data?.signedUrl) {
    throw new Error(`署名付きURL取得失敗: ${urlError?.message || '不明なエラー'}`)
  }

  return data.signedUrl
}

/**
 * Supabase Storage が利用可能かチェック
 */
export function isStorageAvailable(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return !!(url && key)
}
