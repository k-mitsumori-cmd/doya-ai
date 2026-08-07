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

/**
 * ブラウザから直接アップロードするための署名付きURL。
 *
 * なぜ経由させないか: Vercel Functions のリクエスト本文は約4.5MBが上限で、
 * 20分の面接音声はこれを超えうる。サーバを経由すると長い面接ほど失敗する。
 * 署名URLを渡してブラウザ→Supabaseに直接送らせることで上限を回避する。
 */
export async function createSignedUploadUrl(
  path: string
): Promise<{ signedUrl: string; token: string; path: string }> {
  await ensureBucket()
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    throw new Error(`アップロードURLの発行に失敗しました: ${error?.message || 'unknown'}`)
  }
  return { signedUrl: data.signedUrl, token: data.token, path }
}

/** 実際にオブジェクトが存在するか（アップロード完了の確認用） */
export async function recordingExists(path: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin()
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
    const file = path.slice(path.lastIndexOf('/') + 1)
    const { data } = await supabase.storage.from(BUCKET).list(dir, { search: file, limit: 1 })
    return !!data?.some((f) => f.name === file)
  } catch {
    return false
  }
}

/** 保持期限切れの削除（cronから呼ばれる） */
export async function deleteRecording(path: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw new Error(`録音の削除に失敗しました: ${error.message}`)
}
