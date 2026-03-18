// ============================================
// ドヤボイスAI — プラン判定ユーティリティ
// ============================================

const PRO_PLANS = ['PRO', 'LIGHT', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE']

/**
 * ボイスサービスのPROプラン判定（LIGHT以上すべて含む）
 */
export function isVoicePro(plan: string): boolean {
  return PRO_PLANS.includes(plan.toUpperCase())
}

/**
 * LIGHT以上のプラン判定（速度・ピッチ・音量カスタマイズ可否に使用）
 */
export function isVoiceLightOrAbove(plan: string): boolean {
  return PRO_PLANS.includes(plan.toUpperCase())
}

/**
 * セッションユーザーからプラン文字列を取得
 */
export function getVoicePlan(user: any): string {
  return String(user?.voicePlan || user?.plan || 'FREE').toUpperCase()
}

/**
 * セッションユーザーからPRO判定（クライアント用）
 */
export function isVoiceProFromUser(user: any): boolean {
  return isVoicePro(getVoicePlan(user))
}
