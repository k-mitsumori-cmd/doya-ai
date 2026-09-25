import { getSupabaseAdmin, ensureBucket, BUCKET_NAME } from './storage'

export const THUMBNAIL_STORAGE_MARKER = 'interview-thumbnail-storage:v1'
const MAX_THUMBNAIL_BYTES = 8 * 1024 * 1024
const SAFE_PART = /^[A-Za-z0-9_-]{1,128}$/
const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])

function thumbnailPath(owner: string, projectId: string): string {
  if (!SAFE_PART.test(owner) || !SAFE_PART.test(projectId)) throw new Error('不正なサムネイルの保存先です')
  return `${owner}/${projectId}/thumbnail`
}

export function thumbnailOwner(project: { userId: string | null; guestId: string | null }): string {
  const owner = project.userId || (project.guestId ? `guest_${project.guestId}` : '')
  if (!SAFE_PART.test(owner)) throw new Error('サムネイルの所有者を確認できません')
  return owner
}

export function thumbnailUrlForClient(projectId: string, stored: string | null, updatedAt: Date): string | null {
  if (!stored) return null
  if (stored !== THUMBNAIL_STORAGE_MARKER) return stored // Existing data URLs remain readable.
  return `/api/interview/projects/${encodeURIComponent(projectId)}/thumbnail?v=${updatedAt.getTime()}`
}

export async function uploadInterviewThumbnail(owner: string, projectId: string, mimeType: string, encoded: string): Promise<void> {
  if (!IMAGE_MIME.has(mimeType) || typeof encoded !== 'string' || /[^A-Za-z0-9+/=]/.test(encoded)) {
    throw new Error('画像形式が正しくありません')
  }
  if (encoded.length > Math.ceil(MAX_THUMBNAIL_BYTES / 3) * 4 + 4) throw new Error('画像サイズが上限を超えています')
  const bytes = Buffer.from(encoded, 'base64')
  if (bytes.toString('base64') !== encoded) throw new Error('画像形式が正しくありません')
  if (!bytes.length || bytes.length > MAX_THUMBNAIL_BYTES) throw new Error('画像サイズが上限を超えています')
  await ensureBucket()
  const { error } = await getSupabaseAdmin().storage.from(BUCKET_NAME).upload(thumbnailPath(owner, projectId), bytes, {
    contentType: mimeType,
    cacheControl: '0',
    upsert: true,
  })
  if (error) throw new Error('サムネイルの保存に失敗しました')
}

export async function downloadInterviewThumbnail(owner: string, projectId: string): Promise<Blob> {
  const storage = getSupabaseAdmin().storage
  const { data: bucket, error: bucketError } = await storage.getBucket(BUCKET_NAME)
  if (bucketError || !bucket || bucket.public) throw new Error('非公開ストレージを確認できません')
  const { data, error } = await storage.from(BUCKET_NAME).download(thumbnailPath(owner, projectId))
  if (error || !data || !IMAGE_MIME.has(data.type) || data.size < 1 || data.size > MAX_THUMBNAIL_BYTES) {
    throw new Error('サムネイルを取得できません')
  }
  return data
}
