// ============================================
// ドヤインタビュー — 型定義
// ============================================

export type InterviewPlanCode = 'GUEST' | 'FREE' | 'PRO' | 'ENTERPRISE'

export type MaterialType = 'audio' | 'video' | 'text' | 'pdf' | 'image' | 'url'
export type MaterialStatus = 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'ERROR'
export type TranscriptionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR'
export type ProjectStatus = 'DRAFT' | 'PLANNING' | 'RECORDING' | 'TRANSCRIBING' | 'EDITING' | 'REVIEWING' | 'COMPLETED'

// 素材アップロードで許可するMIMEタイプ
export const ALLOWED_MIME_TYPES: Record<string, MaterialType> = {
  // 音声
  'audio/mpeg': 'audio',
  'audio/mp3': 'audio',
  'audio/wav': 'audio',
  'audio/x-wav': 'audio',
  'audio/mp4': 'audio',
  'audio/x-m4a': 'audio',
  'audio/m4a': 'audio',
  'audio/ogg': 'audio',
  'audio/webm': 'audio',
  'audio/flac': 'audio',
  // 動画
  'video/mp4': 'video',
  'video/quicktime': 'video',
  'video/webm': 'video',
  'video/x-msvideo': 'video',
  // PDF
  'application/pdf': 'pdf',
  // テキスト
  'text/plain': 'text',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'text',
  // 画像
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
}

// 許可する拡張子
export const ALLOWED_EXTENSIONS = new Set([
  'mp3', 'wav', 'm4a', 'ogg', 'webm', 'flac',
  'mp4', 'mov', 'avi',
  'pdf',
  'txt', 'docx',
  'jpg', 'jpeg', 'png', 'webp',
])

// 最大ファイルサイズ (バイト) — 環境変数で上書き可能
// Supabase プラン上限: Free=50MB, Pro=5GB
export function getMaxFileSize(): number {
  const envMb = process.env.INTERVIEW_MAX_FILE_SIZE_MB
  if (envMb) return parseInt(envMb, 10) * 1024 * 1024
  return 5 * 1024 * 1024 * 1024 // デフォルト 5GB (Supabase Pro)
}

// ============================================
// API レスポンス型
// ============================================

export interface UploadUrlResponse {
  signedUrl: string
  path: string
  token: string
  materialId: string
}

export interface MaterialResponse {
  id: string
  projectId: string
  type: MaterialType
  fileName: string
  fileUrl: string | null
  fileSize: number | null
  mimeType: string | null
  duration: number | null
  status: MaterialStatus
  error: string | null
  createdAt: string
}

export interface TranscriptionResponse {
  id: string
  projectId: string
  materialId: string | null
  text: string
  segments: TranscriptionSegment[] | null
  summary: string | null
  provider: string | null
  confidence: number | null
  status: TranscriptionStatus
  createdAt: string
}

export interface TranscriptionSegment {
  start: number
  end: number
  text: string
  speaker?: string
}

export interface ProjectResponse {
  id: string
  title: string
  status: ProjectStatus
  intervieweeName: string | null
  intervieweeRole: string | null
  intervieweeCompany: string | null
  genre: string | null
  theme: string | null
  materialCount: number
  draftCount: number
  createdAt: string
  updatedAt: string
}
