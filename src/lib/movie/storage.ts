// ============================================
// ドヤムービーAI - Supabase Storage
// ============================================
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

const BUCKET = 'movie-renders'

export async function ensureMovieBucket() {
  const { data: buckets } = await getSupabase().storage.listBuckets()
  const exists = buckets?.some(b => b.name === BUCKET)
  if (!exists) {
    await getSupabase().storage.createBucket(BUCKET, { public: false })
  }
}

export async function uploadMovieFile(
  buffer: Buffer,
  path: string,
  contentType: 'video/mp4' | 'image/gif' | 'image/png'
): Promise<string> {
  await ensureMovieBucket()

  const { error } = await getSupabase().storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true })

  if (error) throw new Error(`Supabase upload error: ${error.message}`)

  const { data } = await getSupabase().storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7) // 7日間有効

  if (!data?.signedUrl) throw new Error('署名付きURL生成に失敗しました')
  return data.signedUrl
}

export async function getSignedMovieUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await getSupabase().storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn)

  if (error || !data?.signedUrl) throw new Error('URL取得に失敗しました')
  return data.signedUrl
}

export async function deleteMovieFile(path: string): Promise<void> {
  await getSupabase().storage.from(BUCKET).remove([path])
}

export function buildMoviePath(userId: string, projectId: string, format: string): string {
  const timestamp = Date.now()
  return `${userId}/${projectId}/${timestamp}.${format}`
}
