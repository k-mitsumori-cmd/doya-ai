// ============================================
// ドヤボイスAI — 録音アップロードの共通部分
// ============================================
// 署名付きURLで Supabase Storage へ直接送る（Vercel の約4.5MB のボディ制限を避ける）。
// 発行 API（upload-url）と完了 API（confirm）の両方が、同じ上限・形式・認証をここで確かめる。

import { getStorageAdmin, isOwnStoragePath } from '@/lib/direct-upload/server'

export const VOICE_BUCKET = process.env.VOICE_STORAGE_BUCKET || 'voice-recordings'

/** 録音1本の上限。音声にはプラン別の上限が無いため、固定値で全プロ共通にする */
export const VOICE_MAX_FILE_SIZE = 50 * 1024 * 1024
export const VOICE_MAX_FILE_SIZE_LABEL = '50MB'

const EXT_BY_TYPE: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
}

/** "audio/webm;codecs=opus" のようなパラメータ付きの値から、形式だけを取り出す */
export function normalizeVoiceMime(mime: unknown): string | null {
  if (typeof mime !== 'string') return null
  const base = mime.split(';')[0].trim().toLowerCase()
  return EXT_BY_TYPE[base] ? base : null
}

export function voiceExtFromMime(mime: string): string {
  return EXT_BY_TYPE[mime] || 'mp4'
}

export const getVoiceSupabaseAdmin = getStorageAdmin
export const isOwnVoicePath = isOwnStoragePath
