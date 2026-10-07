// ============================================
// ドヤ商談準備 ストレージ（Supabase・非公開バケット）
// 提案スライド画像を非公開で保存し、署名URLで配信する。
// ============================================
import { getSupabaseAdmin } from '@/lib/interview/storage'
import { ensurePrivateImageBucket } from '@/lib/private-storage-bucket'

const BUCKET = process.env.SHODAN_STORAGE_BUCKET || 'shodan'
export async function assertPrivateStorage(): Promise<void> {
  await ensurePrivateImageBucket(getSupabaseAdmin().storage, BUCKET, 26214400)
}

export async function uploadPng(path: string, buffer: Buffer): Promise<string> {
  await assertPrivateStorage()
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: 'image/png', upsert: true })
  if (error) throw new Error('画像の保存に失敗しました')
  return path
}

/** 任意のバイナリ（ロゴ等）を保存 */
export async function uploadFile(path: string, buffer: Buffer, contentType: string): Promise<string> {
  await assertPrivateStorage()
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: true })
  if (error) throw new Error('アップロードに失敗しました')
  return path
}

/** 署名付き表示URL（既定2時間） */
export async function signedUrl(path: string | null | undefined, expiresSec = 7200): Promise<string | null> {
  if (!path) return null
  try {
    await assertPrivateStorage()
    const supabase = getSupabaseAdmin()
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresSec)
    return data?.signedUrl || null
  } catch {
    return null
  }
}
