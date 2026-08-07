// ============================================
// ドヤ面接官 ストレージ（Supabase・非公開バケット）
// ============================================
// 面接の録音を保存する。応募者の音声そのものなので、
// 公開バケットに置かない・URLを直接持たせない・署名URLは短命にする。
import { getSupabaseAdmin } from '@/lib/interview/storage'

const BUCKET = process.env.MENSETSU_STORAGE_BUCKET || 'mensetsu'
let _ready = false

async function ensureBucket() {
  if (_ready) return
  const supabase = getSupabaseAdmin()
  const { data } = await supabase.storage.getBucket(BUCKET)
  if (!data) {
    await supabase.storage
      // 非公開・100MBまで（20分の音声で十分に収まる）
      .createBucket(BUCKET, { public: false, fileSizeLimit: 104857600 })
      .catch(() => {})
  }
  _ready = true
}

/** 録音を保存し、保存先パスを返す */
export async function uploadRecording(
  path: string,
  buffer: Buffer,
  contentType = 'audio/webm'
): Promise<string> {
  await ensureBucket()
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: true })
  if (error) throw new Error(`録音の保存に失敗しました: ${error.message}`)
  return path
}

/**
 * 再生用の署名URL（既定15分）。
 * 面接の録音は機微なので、他サービスの既定（2時間）より短くしている。
 */
export async function signedRecordingUrl(
  path: string | null | undefined,
  expiresSec = 900
): Promise<string | null> {
  if (!path) return null
  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresSec)
    return data?.signedUrl || null
  } catch {
    return null
  }
}

/** 保持期限切れの削除（cronから呼ばれる） */
export async function deleteRecording(path: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw new Error(`録音の削除に失敗しました: ${error.message}`)
}
