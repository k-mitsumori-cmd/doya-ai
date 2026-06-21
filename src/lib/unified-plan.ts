// ============================================
// 統一プラン設定（料金まわりの単一ソース）
// ============================================
// 全サービス共通で「無料プラン」と「プロプラン(¥9,980/月)」の2種類のみ。
// プロプランを1つ契約すれば、全サービスのプロ機能（上限拡大）が解放される。
// 料金やプランIDを変えたいときは、このファイルだけを編集すればよい。

/** 統一プロプランの月額（円・税込） */
export const UNIFIED_PRO_PRICE = 9980

/**
 * 有料(プロ)プランかどうかの単一判定。User.plan を唯一の真実として全サービスで参照する。
 * FREE / GUEST（および未設定）は無料。それ以外は有料扱い。
 */
export function isPaidPlan(plan?: string | null): boolean {
  const p = (plan || 'FREE').toUpperCase()
  return p !== 'FREE' && p !== 'GUEST'
}

/** 統一プロプランの価格表示ラベル */
export const UNIFIED_PRO_PRICE_LABEL = '¥9,980'

/**
 * 統一プロプランで使う Stripe の planId。
 * checkout API(`/api/stripe/checkout`) の priceMap が解決できる値であること。
 * 'banner-pro' は本番の STRIPE_PRICE_BANNER_PRO_MONTHLY(¥9,980) に紐づく
 * （全サービス共通のプロ価格として流用）。
 */
export const UNIFIED_PRO_PLAN_ID = 'banner-pro'

/** 統一プランの訴求コピー */
export const UNIFIED_PLAN_COPY = {
  freeName: '無料プラン',
  proName: 'プロプラン',
  freeTagline: 'まずは無料でお試し',
  proTagline: '1契約で全サービスのプロ機能が使い放題',
  proNote: 'プロプランを1つ契約すると、ドヤAIの全サービスでプロ機能（上限アップ）が使えるようになります。',
} as const
