// ============================================
// 直接アップロードの共通部品（サーバー側）
// ============================================
// 署名付きURLの発行と、完了時のファイル確認を、ツールごとに書かずここにまとめる。
// 流れ: (1) issueSignedUpload で署名付きURLを発行 → (2) ブラウザが直接 PUT
//       → (3) verifyUploadedObject で実在とサイズを確かめてから DB に記録する。
// 認証・プラン・保存先の持ち主の確認は、呼び出し側のルートが行う。
// 動画（数百MB〜数GB）に広げる方針は reference ではなくこのファイルの末尾コメントを参照。

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function getStorageAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase未設定: NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

export type SignedUpload = { signedUrl: string; path: string; token: string }

/** バケットが無ければ（privateで）作ってから、署名付きアップロードURLを発行する */
export type BucketCreateOptions = { fileSizeLimit?: number; allowedMimeTypes?: string[] }

/**
 * ⚠️ bucketOptions は「バケットを新しく作るとき」だけ効く（既存バケットの設定は変えない）。
 *    申告サイズは PUT 時には強制されないため、上限はバケット側の fileSizeLimit で守る。
 */
export async function issueSignedUpload(bucket: string, storagePath: string, bucketOptions: BucketCreateOptions = {}): Promise<SignedUpload> {
  const supabase = getStorageAdmin()
  let { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(storagePath)
  if (error && /not found/i.test(error.message || '')) {
    await supabase.storage.createBucket(bucket, { public: false, ...bucketOptions })
    ;({ data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(storagePath))
  }
  if (error || !data) throw new Error(`storage: ${error?.message || 'signed url'}`)
  return { signedUrl: data.signedUrl, path: storagePath, token: data.token }
}

export type VerifyResult =
  | { ok: true; size: number }
  | { ok: false; reason: 'NOT_FOUND' | 'BAD_SIZE' | 'TOO_LARGE'; size?: number }

/** 申告ではなく Storage 上の実サイズで確かめる。上限超過なら置かれたファイルを消す */
export async function verifyUploadedObject(bucket: string, storagePath: string, maxBytes: number): Promise<VerifyResult> {
  const supabase = getStorageAdmin()
  const { data, error } = await supabase.storage.from(bucket).info(storagePath)
  if (error || !data) return { ok: false, reason: 'NOT_FOUND' }
  const size = Number(data.size)
  if (!Number.isSafeInteger(size) || size <= 0) return { ok: false, reason: 'BAD_SIZE' }
  if (size > maxBytes) {
    await supabase.storage.from(bucket).remove([storagePath])
    return { ok: false, reason: 'TOO_LARGE', size }
  }
  return { ok: true, size }
}

/** 保存先が「自分のユーザーID/」の直下かを確かめる（他人の保存先を完了にさせない） */
export function isOwnStoragePath(userId: string, storagePath: unknown): storagePath is string {
  if (typeof storagePath !== 'string') return false
  if (storagePath.includes('..') || storagePath.length > 300) return false
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '')
  return new RegExp(`^${safeId}/[a-zA-Z0-9_.-]+$`).test(storagePath)
}

// --------------------------------------------
// 動画へ広げるときのメモ（2026-10-30 調査。くわしくは共有ノートの一覧）
// --------------------------------------------
// ・署名付きURLの PUT は1回で送り切る方式。数百MB以上は途中で切れると最初からやり直し。
// ・Supabase の TUS（再開できる送信）は、ブラウザに Supabase の認証トークンを渡す必要がある。
//   このアプリは NextAuth で Supabase Auth を使っていないため、そのままは使えない。
// ・代案は S3 互換のマルチパート（パートごとの署名付きURLをこのファイルで発行し、
//   ブラウザが切れたパートだけ送り直す）。動画を始めるときに実機で確かめてから採用する。
