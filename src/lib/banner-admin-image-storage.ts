import { randomUUID } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/interview/storage'

const BUCKET = 'banner-admin-images'
const MAX_BYTES = 5 * 1024 * 1024
const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export function validBannerAdminFile(mimeType: unknown, fileSize: unknown): mimeType is string {
  return typeof mimeType === 'string' && mimeType in EXTENSIONS &&
    typeof fileSize === 'number' && Number.isSafeInteger(fileSize) && fileSize > 0 && fileSize <= MAX_BYTES
}

export async function createBannerAdminUpload(mimeType: string) {
  const storage = getSupabaseAdmin().storage
  const { data: bucket, error: bucketError } = await storage.getBucket(BUCKET)
  if (bucketError && !/not found/i.test(bucketError.message)) throw bucketError
  if (!bucket) {
    const { error } = await storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: Object.keys(EXTENSIONS),
    })
    if (error && !/already exists/i.test(error.message)) throw error
  } else if (!bucket.public) {
    throw new Error('Banner admin image bucket is not public')
  }

  const path = `admin/${randomUUID()}.${EXTENSIONS[mimeType]}`
  const { data, error } = await storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) throw error || new Error('Upload URL was not issued')
  const publicUrl = storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  return { signedUrl: data.signedUrl, publicUrl }
}

export async function bannerAdminImageExists(imageUrl: string): Promise<boolean> {
  const storage = getSupabaseAdmin().storage
  const prefix = storage.from(BUCKET).getPublicUrl('admin/').data.publicUrl
  if (!imageUrl.startsWith(prefix)) return false
  const fileName = imageUrl.slice(prefix.length)
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(fileName)) return false
  const { data, error } = await storage.from(BUCKET).info(`admin/${fileName}`)
  return !error && !!data && Number(data.size) > 0 && Number(data.size) <= MAX_BYTES
}
