// ============================================
// メディア処理ジョブの種類（Next.js 側とワーカー側で同じ名前を使う）
// ワーカー側の対応: worker/src/handlers/
// 種類を足すとき: ここに名前を足し、worker/src/handlers に処理を書いて index.ts に登録する
// ============================================

export const MEDIA_JOB_KINDS = ['extract_audio', 'thumbnail', 'preview_720p', 'process_all', 'transcribe'] as const
export type MediaJobKind = (typeof MEDIA_JOB_KINDS)[number]

export const MEDIA_JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'canceled'] as const
export type MediaJobStatus = (typeof MEDIA_JOB_STATUSES)[number]

export const MEDIA_JOB_KIND_LABELS: Record<MediaJobKind, string> = {
  extract_audio: '音声の抜き出し',
  thumbnail: 'サムネイルの作成',
  preview_720p: '閲覧用の軽い動画（720p）',
  process_all: '音声・軽い動画・サムネイルの一括作成',
  transcribe: '文字起こし',
}

export const MEDIA_JOB_STATUS_LABELS: Record<MediaJobStatus, string> = {
  queued: '順番待ち',
  running: '処理中',
  succeeded: '完了',
  failed: '失敗',
  canceled: '取り消し',
}

export type MediaJobParams = {
  extract_audio: { format?: 'mp3' | 'm4a' }
  thumbnail: { atSeconds?: number; count?: number }
  preview_720p: Record<string, never>
  /** 入力を1回だけ読み、音声・720p・サムネイルをまとめて作る。transcribe: true で音声のあと文字起こしまで続ける（有料API） */
  process_all: { format?: 'mp3' | 'm4a'; preview?: boolean; thumbnails?: number; atSeconds?: number; transcribe?: boolean; language?: string }
  /** 音声ファイル（出力バケットの本人の階層）の文字起こし（AssemblyAI。有料API） */
  transcribe: { language?: string }
}

export type MediaJobOutput = {
  name: string
  bucket: string
  path: string
  contentType: string
  size: number
}

export function isMediaJobKind(v: unknown): v is MediaJobKind {
  return typeof v === 'string' && (MEDIA_JOB_KINDS as readonly string[]).includes(v)
}

/** 出力を入れるバケット（非公開）。ワーカーと同じ環境変数名・既定値 */
export function mediaOutputBucket(): string {
  return process.env.MEDIA_OUTPUT_BUCKET || 'media-jobs'
}

/** 入力として許すバケット。環境変数 MEDIA_JOB_INPUT_BUCKETS（カンマ区切り）で指定する */
export function allowedInputBuckets(): string[] {
  return (process.env.MEDIA_JOB_INPUT_BUCKETS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 再試行の待ち時間（分）。attempts=1回目の失敗後は2分、2回目の失敗後は6分 */
export function retryDelayMinutes(attempts: number): number {
  return 2 * Math.pow(3, Math.max(0, attempts - 1))
}
