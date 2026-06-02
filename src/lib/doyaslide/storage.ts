// ============================================
// ドヤスライド ストレージ (Supabase Storage / 公開バケット)
// ============================================
// 生成スライド画像・アップロードロゴを保存し、公開URLを返す。
// 一覧/プレビュー/エクスポートで <img> として長期表示するため公開URLを採用。
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

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

const BUCKET = 'doyaslide'

let bucketReady = false
async function ensureBucket() {
  if (bucketReady) return // プロセス内で一度確認すれば十分（毎アップロードのlistBucketsを回避）
  const { data: buckets } = await getSupabase().storage.listBuckets()
  if (!buckets?.some((b) => b.name === BUCKET)) {
    await getSupabase().storage.createBucket(BUCKET, { public: true })
  }
  bucketReady = true
}

async function uploadBuffer(buffer: Buffer, path: string, contentType: string): Promise<string> {
  await ensureBucket()
  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true })
  if (error) throw new Error(`Supabase upload error: ${error.message}`)
  const { data } = getSupabase().storage.from(BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('公開URLの生成に失敗しました')
  return data.publicUrl
}

/** スライド画像を保存（base64） */
export async function uploadSlideImage(
  userId: string,
  projectId: string,
  base64: string,
  mimeType = 'image/png'
): Promise<string> {
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
  const buffer = Buffer.from(base64, 'base64')
  const path = `${userId}/${projectId}/${randomUUID()}.${ext}`
  return uploadBuffer(buffer, path, mimeType)
}

/** 合成済みバッファ（PNG）を保存 */
export async function uploadComposedImage(
  userId: string,
  projectId: string,
  buffer: Buffer
): Promise<string> {
  const path = `${userId}/${projectId}/${randomUUID()}.png`
  return uploadBuffer(buffer, path, 'image/png')
}

// スタイルプレビューは「スタイル × ページ番号」で複数ページをキャッシュする。
// 例: style-previews/v2-gptimg2/flashy-0.png（表紙）, flashy-1.png（特長）, flashy-2.png（まとめ）
// 生成モデルや品質を切り替えたら STYLE_PREVIEW_DIR の版を上げると、旧キャッシュが無視され全プレビューが自動で焼き直される。
const STYLE_PREVIEW_DIR = 'style-previews/v2-gptimg2'
function stylePreviewFile(style: string, page: number): string {
  return `${STYLE_PREVIEW_DIR}/${style}-${page}.png`
}

/** スタイルプレビューの公開URL（固定パス・全ユーザー共有キャッシュ） */
export function stylePreviewPublicUrl(style: string, page = 0): string {
  const { data } = getSupabase().storage.from(BUCKET).getPublicUrl(stylePreviewFile(style, page))
  return data.publicUrl
}

// 生成済みスタイルのプロセス内メモ（公開URLのHEADは信頼できないため Storage API で確認）
const knownStylePreviews = new Set<string>()

/** スタイルプレビュー(該当ページ)が既に存在するか（Storage list で確実に判定 + メモ化） */
export async function stylePreviewExists(style: string, page = 0): Promise<boolean> {
  const key = `${style}-${page}`
  if (knownStylePreviews.has(key)) return true
  try {
    const { data } = await getSupabase()
      .storage.from(BUCKET)
      .list(STYLE_PREVIEW_DIR, { search: `${key}.png`, limit: 100 })
    const exists = !!data?.some((f) => f.name === `${key}.png`)
    if (exists) knownStylePreviews.add(key)
    return exists
  } catch {
    return false
  }
}

/** スタイルプレビュー画像を固定パス(該当ページ)に保存（upsert）して公開URLを返す */
export async function uploadStylePreview(style: string, base64: string, page = 0): Promise<string> {
  const buffer = Buffer.from(base64, 'base64')
  const url = await uploadBuffer(buffer, stylePreviewFile(style, page), 'image/png')
  knownStylePreviews.add(`${style}-${page}`)
  return url
}

/** ロゴを保存 */
export async function uploadLogo(
  userId: string,
  buffer: Buffer,
  ext: string,
  contentType: string
): Promise<string> {
  const path = `${userId}/logos/${randomUUID()}.${ext}`
  return uploadBuffer(buffer, path, contentType)
}
