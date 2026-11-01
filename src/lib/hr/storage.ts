// ============================================
// ドヤHR - 従業員写真ストレージ (Supabase Storage)
// ============================================
// 新しい従業員写真は非公開バケットへ保存し、組織権限を確認する同一オリジンAPIで表示する。
// 既存の公開バケットとその保存済みURLは、この変更では移行・変更しない。
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ensurePrivateImageBucket } from '@/lib/private-storage-bucket'
import { raceTimeout } from '@/lib/fetch-timeout'

let _supabase: SupabaseClient | null = null
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _supabase
}

const BUCKET = process.env.HR_PHOTO_STORAGE_BUCKET || 'hr-photos-private'
const MAX_PHOTO_BYTES = 5 * 1024 * 1024

function photoPath(path: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(path)) {
    throw new Error('写真の保存先が不正です')
  }
  return path
}

async function ensureBucket() {
  await ensurePrivateImageBucket(getSupabase().storage, BUCKET, MAX_PHOTO_BYTES)
}

/**
 * 従業員写真を非公開保存し、権限確認付きの表示URLを返す
 * @param buffer 画像バイナリ
 * @param path 保存パス（例: `${organizationId}/${uuid}.jpg`）
 * @param contentType 画像のMIMEタイプ
 */
export async function uploadHrPhoto(
  buffer: Buffer,
  path: string,
  contentType: string
): Promise<string> {
  photoPath(path)
  if (!buffer.length || buffer.length > MAX_PHOTO_BYTES) throw new Error('写真は5MB以下で指定してください')
  await ensureBucket()

  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true })

  if (error) throw new Error('Supabase upload error')

  return `/api/hr/photos/${path}`
}

/** Only call after checking the organization and an employee's attached photo URL. */
export async function downloadHrPhoto(path: string): Promise<Buffer | null> {
  photoPath(path)
  await ensureBucket()
  const { data, error } = await raceTimeout('downloadHrPhoto', 20000, getSupabase().storage.from(BUCKET).download(path))
  if (error || !data) return null
  if (data.size > MAX_PHOTO_BYTES) throw new Error('写真のサイズを確認できませんでした')
  const buffer = Buffer.from(await raceTimeout('readHrPhoto', 10000, data.arrayBuffer()))
  if (!buffer.length || buffer.length > MAX_PHOTO_BYTES) throw new Error('写真のサイズを確認できませんでした')
  return buffer
}
