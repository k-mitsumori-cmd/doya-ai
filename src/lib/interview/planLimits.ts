// ========================================
// インタビューAI プラン別制限管理
// ========================================

export type InterviewPlan = 'GUEST' | 'FREE' | 'PRO' | 'ENTERPRISE'

export interface PlanLimits {
  // ファイルサイズ制限（バイト）
  maxFileSize: number
  // 動画ファイルサイズ制限（バイト）
  maxVideoFileSize: number
  // 音声ファイルサイズ制限（バイト）
  maxAudioFileSize: number
  // 1時間使い放題機能が有効か
  hasOneHourUnlimited: boolean
  // プラン名
  planName: string
  // プラン説明
  description: string
}

// プラン別の制限定義
export const PLAN_LIMITS: Record<InterviewPlan, PlanLimits> = {
  GUEST: {
    maxFileSize: 100 * 1024 * 1024, // 100MB（音声のみ）
    maxVideoFileSize: 0, // 動画は不可
    maxAudioFileSize: 100 * 1024 * 1024, // 100MB
    hasOneHourUnlimited: true, // 最初の1時間は使い放題
    planName: 'ゲスト',
    description: '最初の1時間は使い放題（エンタープライズ機能まで）',
  },
  FREE: {
    maxFileSize: 1 * 1024 * 1024 * 1024, // 1GB（音声のみ）
    maxVideoFileSize: 0, // 動画は不可
    maxAudioFileSize: 1 * 1024 * 1024 * 1024, // 1GB
    hasOneHourUnlimited: false,
    planName: '無料',
    description: '音声ファイルのみアップロード可能（最大1GB）',
  },
  PRO: {
    maxFileSize: 5 * 1024 * 1024 * 1024, // 5GB（動画も可）
    maxVideoFileSize: 5 * 1024 * 1024 * 1024, // 5GB
    maxAudioFileSize: 5 * 1024 * 1024 * 1024, // 5GB
    hasOneHourUnlimited: false,
    planName: 'PRO',
    description: '動画ファイルもアップロード可能（最大5GB）',
  },
  ENTERPRISE: {
    maxFileSize: 10 * 1024 * 1024 * 1024, // 10GB（動画も可）
    maxVideoFileSize: 10 * 1024 * 1024 * 1024, // 10GB
    maxAudioFileSize: 10 * 1024 * 1024 * 1024, // 10GB
    hasOneHourUnlimited: false,
    planName: 'Enterprise',
    description: '大容量動画ファイルもアップロード可能（最大10GB）',
  },
}

/**
 * ユーザーのプランを取得
 * @param userId ユーザーID（ログインユーザーの場合）
 * @param guestId ゲストID（ゲストユーザーの場合）
 * @param userPlan ユーザーのプラン（UserServiceSubscriptionから取得）
 * @returns プランタイプ
 */
export async function getUserPlan(
  userId: string | null,
  guestId: string | null,
  userPlan: string | null = null
): Promise<InterviewPlan> {
  // ログインユーザーの場合
  if (userId) {
    if (userPlan === 'ENTERPRISE') return 'ENTERPRISE'
    if (userPlan === 'PRO') return 'PRO'
    return 'FREE'
  }

  // ゲストユーザーの場合
  if (guestId) {
    return 'GUEST'
  }

  // デフォルトはゲスト
  return 'GUEST'
}

/**
 * プラン別のファイルサイズ制限を取得
 * @param plan プランタイプ
 * @param isVideoFile 動画ファイルかどうか
 * @returns 最大ファイルサイズ（バイト）
 */
export function getMaxFileSize(plan: InterviewPlan, isVideoFile: boolean = false): number {
  const limits = PLAN_LIMITS[plan]

  if (isVideoFile) {
    return limits.maxVideoFileSize
  }

  return limits.maxAudioFileSize
}

/**
 * ファイルサイズが制限内かチェック
 * @param fileSize ファイルサイズ（バイト）
 * @param plan プランタイプ
 * @param isVideoFile 動画ファイルかどうか
 * @returns 制限内かどうか
 */
export function isFileSizeWithinLimit(
  fileSize: number,
  plan: InterviewPlan,
  isVideoFile: boolean = false
): boolean {
  const maxSize = getMaxFileSize(plan, isVideoFile)
  return fileSize <= maxSize
}

/**
 * ゲストユーザーの1時間使い放題機能が有効かチェック
 * @param guestFirstAccessAt ゲストユーザーの初回アクセス時刻
 * @returns 1時間以内かどうか
 */
export function isGuestUnlimitedActive(guestFirstAccessAt: Date | null): boolean {
  if (!guestFirstAccessAt) {
    return false
  }

  const now = new Date()
  const diffMs = now.getTime() - guestFirstAccessAt.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)

  return diffHours <= 1
}

/**
 * ゲストユーザーの1時間使い放題機能が有効な場合、エンタープライズプランの制限を適用
 * @param plan 現在のプラン
 * @param guestFirstAccessAt ゲストユーザーの初回アクセス時刻
 * @returns 実際に適用されるプラン
 */
export function getEffectivePlan(
  plan: InterviewPlan,
  guestFirstAccessAt: Date | null
): InterviewPlan {
  // ゲストユーザーで1時間以内の場合、エンタープライズプランの制限を適用
  if (plan === 'GUEST' && isGuestUnlimitedActive(guestFirstAccessAt)) {
    return 'ENTERPRISE'
  }

  return plan
}

