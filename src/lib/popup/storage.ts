// ============================================
// ドヤポップアップ: 画像の保存（Supabase Storage・非公開バケット）
// ============================================
// ⚠️ バケットは非公開のまま。訪問者には公開API（/api/popup/public/image/[id]）が中継して返す
//    （署名URLは期限が切れるので、サイトに出し続ける画像には使えない）。
// ⚠️ 形式は中身のバイト列で判定する。拡張子や Content-Type は利用者が自由に付けられる。
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { getSupabaseAdmin } from '@/lib/interview/storage'
import { ensurePrivateImageBucket } from '@/lib/private-storage-bucket'

const BUCKET = process.env.POPUP_STORAGE_BUCKET || 'popup'
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024

export type ImageType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'

const EXT: Record<ImageType, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }

/** 先頭のバイト列から画像の形式を判定する。対応外は null */
export function detectImageType(buf: Uint8Array): ImageType | null {
  if (buf.length < 12) return null
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif'
  const riff = String.fromCharCode(buf[0], buf[1], buf[2], buf[3])
  const webp = String.fromCharCode(buf[8], buf[9], buf[10], buf[11])
  if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp'
  return null
}

export function contentTypeOfPath(path: string): ImageType {
  const ext = path.split('.').pop()
  return (Object.entries(EXT).find(([, e]) => e === ext)?.[0] as ImageType) || 'image/png'
}

async function bucket() {
  const supabase = getSupabaseAdmin()
  await ensurePrivateImageBucket(supabase.storage, BUCKET, MAX_IMAGE_BYTES)
  return supabase.storage.from(BUCKET)
}

/**
 * 画像を保存してパスと縦横を返す。パスは中身のハッシュを含むので、同じパスの中身は変わらない
 * （公開APIで長くキャッシュさせられる）。
 */
export async function saveImage(
  userId: string,
  popupId: string,
  buf: Buffer
): Promise<{ path: string; width: number; height: number } | { error: string }> {
  if (buf.length > MAX_IMAGE_BYTES) return { error: '画像は2MBまでです。' }
  const type = detectImageType(buf)
  if (!type) return { error: 'PNG・JPEG・WebP・GIF の画像を選んでください。' }
  let width = 0
  let height = 0
  try {
    const meta = await sharp(buf, { animated: type === 'image/gif' }).metadata()
    width = meta.width || 0
    height = meta.pageHeight || meta.height || 0
  } catch {
    return { error: '画像を読み込めませんでした。別の画像でお試しください。' }
  }
  if (width < 50 || height < 50 || width > 4000 || height > 4000) return { error: '画像の大きさは縦横50〜4000pxにしてください。' }
  const hash = createHash('sha256').update(buf).digest('hex').slice(0, 20)
  // ⚠️ パスには英数字だけを使う（userId / popupId は cuid）
  const path = `${userId.replace(/[^A-Za-z0-9]/g, '')}/${popupId.replace(/[^A-Za-z0-9]/g, '')}/${hash}.${EXT[type]}`
  const { error } = await (await bucket()).upload(path, buf, { contentType: type, upsert: true })
  if (error) return { error: '画像の保存に失敗しました。時間をおいてもう一度お試しください。' }
  return { path, width, height }
}

export async function loadImage(path: string): Promise<Buffer | null> {
  if (!/^[A-Za-z0-9]+\/[A-Za-z0-9]+\/[a-f0-9]{20}\.(png|jpg|webp|gif)$/.test(path)) return null
  const { data, error } = await (await bucket()).download(path)
  if (error || !data) return null
  return Buffer.from(await data.arrayBuffer())
}
