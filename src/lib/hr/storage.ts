// ============================================
// ドヤHR - 従業員写真ストレージ (Supabase Storage)
// ============================================
// 従業員の顔写真を Supabase Storage の公開バケットに保存し、公開URLを返す。
// 公開URLにしている理由: 一覧/詳細/組織図で <img> として長期表示するため
// （署名付きURLは期限切れで画像が壊れる）。パスはランダムUUIDで推測困難にする。
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

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

const BUCKET = 'hr-photos'

async function ensureBucket() {
  const { data: buckets } = await getSupabase().storage.listBuckets()
  const exists = buckets?.some((b) => b.name === BUCKET)
  if (!exists) {
    await getSupabase().storage.createBucket(BUCKET, { public: true })
  }
}

/**
 * 従業員写真をアップロードして公開URLを返す
 * @param buffer 画像バイナリ
 * @param path 保存パス（例: `${organizationId}/${uuid}.jpg`）
 * @param contentType 画像のMIMEタイプ
 */
export async function uploadHrPhoto(
  buffer: Buffer,
  path: string,
  contentType: string
): Promise<string> {
  await ensureBucket()

  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true })

  if (error) throw new Error(`Supabase upload error: ${error.message}`)

  const { data } = getSupabase().storage.from(BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('公開URLの生成に失敗しました')
  return data.publicUrl
}
