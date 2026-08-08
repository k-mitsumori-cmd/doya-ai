// ============================================
// ドヤ広告画像AI ストレージ（Supabase Storage）
// ============================================
// interview の Supabase 管理クライアントを再利用し、専用バケットに保存する。
// 構成は adbanner/storage.ts と同型。
import { getSupabaseAdmin } from '@/lib/interview/storage'

const BUCKET = process.env.ADIMAGE_STORAGE_BUCKET || 'adimage'
let _ready = false

async function ensureBucket() {
  if (_ready) return
  const supabase = getSupabaseAdmin()
  const { data } = await supabase.storage.getBucket(BUCKET)
  if (!data) {
    await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 26214400 }).catch(() => {})
  }
  _ready = true
}

export async function uploadPng(path: string, buffer: Buffer): Promise<string> {
  await ensureBucket()
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: 'image/png',
    upsert: true,
  })
  if (error) throw new Error(`画像の保存に失敗しました: ${error.message}`)
  return path
}

/** 署名付き表示URL（既定1時間） */
export async function signedUrl(path: string, expiresSec = 3600): Promise<string | null> {
  if (!path) return null
  await ensureBucket()
  const supabase = getSupabaseAdmin()
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresSec)
  return data?.signedUrl ?? null
}

export async function downloadBuffer(path: string): Promise<Buffer | null> {
  if (!path) return null
  await ensureBucket()
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error || !data) return null
  return Buffer.from(await data.arrayBuffer())
}
