// ============================================
// 直接アップロードの共通部品：小さい画像（ロゴ・写真）向けの一時置き場
// ============================================
// ロゴや写真は、画像の中身の確認や変換をサーバーで行ってから最終の保存先に置く。
// そのため、ブラウザは一時置き場（staging）へ直接 PUT し、完了 API が読み出して
// 確認・変換し、最終の保存先に置いたあと一時ファイルを消す。

import { randomUUID } from 'crypto'
import { getStorageAdmin, issueSignedUpload, type SignedUpload } from './server'
import { allowIssue } from './rate-limit'

export const STAGING_BUCKET = process.env.DIRECT_UPLOAD_STAGING_BUCKET || 'direct-upload-staging'

/**
 * ロゴ・写真など画像1枚の上限。プラン別の uploadSizeLimit（インタビュー用）は
 * 動画・音声・資料向けの値で、ロゴや写真には大きすぎ、差をつける理由もない。
 * スマホの写真（5〜8MB）が通り、かつ画像として過大でない 10MB に統一する。
 */
export const IMAGE_UPLOAD_MAX = 10 * 1024 * 1024
export const IMAGE_UPLOAD_MAX_LABEL = '10MB'

export const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export type StageRequest = {
  /** 保存先の頭につける持ち主の印（ユーザーID・組織IDなど）。完了時にも同じ値で確かめる */
  ownerKey: string
  body: any
  allowed?: Record<string, string>
  maxBytes?: number
}

export type StageResult =
  | { ok: true; upload: SignedUpload; maxBytes: number }
  | { ok: false; error: string; status: number }

/** 発行 API の本体。形式とサイズを確かめて、一時置き場の署名付きURLを返す */
export async function issueStagedImageUpload(req: StageRequest): Promise<StageResult> {
  const allowed = req.allowed || IMAGE_TYPES
  const maxBytes = req.maxBytes || IMAGE_UPLOAD_MAX
  const mime = typeof req.body?.mimeType === 'string' ? req.body.mimeType.split(';')[0].trim().toLowerCase() : ''
  const ext = allowed[mime]
  if (!ext) return { ok: false, error: 'PNG / JPG / WebP のみ対応しています', status: 400 }
  const size = req.body?.fileSize
  if (!Number.isSafeInteger(size) || size <= 0) return { ok: false, error: 'ファイルサイズが不正です', status: 400 }
  if (size > maxBytes) {
    return { ok: false, error: `画像サイズは${Math.round(maxBytes / 1024 / 1024)}MB以下にしてください`, status: 400 }
  }
  const safeOwner = req.ownerKey.replace(/[^a-zA-Z0-9_-]/g, '')
  if (!allowIssue(`stage:${safeOwner}`)) return { ok: false, error: '短時間に多くのアップロードが行われました。しばらくしてからお試しください', status: 429 }
  const upload = await issueSignedUpload(STAGING_BUCKET, `${safeOwner}/${randomUUID()}.${ext}`, {
    // 申告サイズは PUT 時に強制されないので、一時置き場のバケット自体に上限と形式を持たせる
    fileSizeLimit: IMAGE_UPLOAD_MAX,
    allowedMimeTypes: Object.keys(IMAGE_TYPES),
  })
  return { ok: true, upload, maxBytes }
}

export type StagedRead =
  | { ok: true; buffer: Buffer; ext: string; path: string }
  | { ok: false; error: string; status: number }

/** 完了 API の入口。保存先の持ち主・実サイズを確かめて、中身を読み出す */
export async function readStagedImage(ownerKey: string, path: unknown, maxBytes = IMAGE_UPLOAD_MAX): Promise<StagedRead> {
  const safeOwner = ownerKey.replace(/[^a-zA-Z0-9_-]/g, '')
  if (typeof path !== 'string' || path.includes('..') || !new RegExp(`^${safeOwner}/[a-zA-Z0-9_.-]+$`).test(path)) {
    return { ok: false, error: '保存先が不正です', status: 400 }
  }
  const ext = path.split('.').pop() || ''
  if (!Object.values(IMAGE_TYPES).includes(ext)) return { ok: false, error: '保存先が不正です', status: 400 }
  const supabase = getStorageAdmin()
  const { data: info } = await supabase.storage.from(STAGING_BUCKET).info(path)
  if (!info) return { ok: false, error: 'アップロードされたファイルが見つかりません', status: 404 }
  const size = Number(info.size)
  if (!Number.isSafeInteger(size) || size <= 0 || size > maxBytes) {
    await supabase.storage.from(STAGING_BUCKET).remove([path])
    return { ok: false, error: `画像サイズは${Math.round(maxBytes / 1024 / 1024)}MB以下にしてください`, status: 400 }
  }
  const { data: blob, error } = await supabase.storage.from(STAGING_BUCKET).download(path)
  if (error || !blob) return { ok: false, error: 'アップロードされたファイルを読み出せませんでした', status: 500 }
  return { ok: true, buffer: Buffer.from(await blob.arrayBuffer()), ext, path }
}

/** 一時置き場の古いファイル（既定1時間より前）を消す。Cron 用。1回あたり最大 maxFolders 個の持ち主フォルダを見る */
export async function purgeStaleStaged(maxAgeMs = 60 * 60 * 1000, maxFolders = 200): Promise<{ removed: number }> {
  const bucket = getStorageAdmin().storage.from(STAGING_BUCKET)
  const { data: folders, error } = await bucket.list('', { limit: maxFolders })
  if (error || !folders) return { removed: 0 }
  const cutoff = Date.now() - maxAgeMs
  let removed = 0
  for (const f of folders) {
    if (f.id) continue // ルート直下のファイルは対象外（フォルダだけを見る）
    const { data: files } = await bucket.list(f.name, { limit: 1000 })
    const old = (files || [])
      .filter(x => x.id && x.created_at && new Date(x.created_at).getTime() < cutoff)
      .map(x => `${f.name}/${x.name}`)
    if (old.length) {
      const { error: rmErr } = await bucket.remove(old)
      if (!rmErr) removed += old.length
    }
  }
  return { removed }
}

/** 最終の保存先に置いたあとに、一時ファイルを消す（失敗しても処理は止めない） */
export async function removeStaged(path: string): Promise<void> {
  try {
    await getStorageAdmin().storage.from(STAGING_BUCKET).remove([path])
  } catch {
    /* 一時ファイルが残っても利用者には影響しない */
  }
}
