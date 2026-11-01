// ============================================
// ドヤ社内インタビュー 録音・写真の保存
// ============================================
// 保存先はドヤインタビューと同じ非公開バケット。ブラウザから署名付きURLへ直接アップロードする
// （Vercel の本文サイズ上限を通さない）。
import { buildStoragePath, createSignedUploadUrl, getFileMetadata, getSignedFileUrl, getSupabaseAdmin, BUCKET_NAME } from '@/lib/interview/storage'

export type UploadKind = 'audio' | 'photo'

export const AUDIO_MIME = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/flac', 'video/mp4', 'video/quicktime', 'video/webm']
export const PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_AUDIO_BYTES = 1024 * 1024 * 1024 // 1GB
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024
export const MAX_PHOTOS = 8
/** 文字起こしできる録音の長さの上限（秒）。費用の上限を決めるため */
export const MAX_AUDIO_SECONDS = 90 * 60

export function validateUpload(kind: UploadKind, mimeType: string, fileSize: number): string | null {
  if (!Number.isFinite(fileSize) || fileSize <= 0) return 'ファイルが空です。'
  if (kind === 'audio') {
    if (!AUDIO_MIME.includes(mimeType)) return '対応していない形式です。mp3・m4a・wav・mp4 などの録音ファイルをお選びください。'
    if (fileSize > MAX_AUDIO_BYTES) return '録音ファイルは1GBまでです。'
  } else {
    if (!PHOTO_MIME.includes(mimeType)) return '写真は JPEG・PNG・WebP でお選びください。'
    if (fileSize > MAX_PHOTO_BYTES) return '写真は1枚15MBまでです。'
  }
  return null
}

export function shanaiStoragePath(userId: string, interviewId: string, kind: UploadKind, fileName: string) {
  return buildStoragePath({ userId, projectId: `shanai_${kind}_${interviewId}`, fileName: fileName || (kind === 'audio' ? 'audio' : 'photo') })
}

/** パスがこのユーザー・このインタビューのものか（他人のパスを確定させない） */
export function isOwnPath(path: string, userId: string, interviewId: string, kind: UploadKind) {
  return typeof path === 'string' && path.startsWith(`${userId}/shanai_${kind}_${interviewId}/`) && !path.includes('..')
}

export { createSignedUploadUrl, getFileMetadata, getSignedFileUrl }

/** 写真の中身を取得（Word 出力・サムネ合成用） */
export async function downloadFile(path: string): Promise<Buffer | null> {
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET_NAME).download(path)
  if (error || !data) return null
  return Buffer.from(await data.arrayBuffer())
}

export async function removeFiles(paths: string[]) {
  const list = paths.filter(Boolean)
  if (list.length === 0) return
  const { error } = await getSupabaseAdmin().storage.from(BUCKET_NAME).remove(list)
  if (error) console.warn('[shanai] storage remove failed')
}
