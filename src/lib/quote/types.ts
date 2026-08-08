// ============================================
// ドヤ見積もりAI（quote）型定義
// 仕様: reference/services/quote.md
// ============================================

export type QuoteRole = 'owner' | 'admin' | 'manager' | 'member'

export const ROLE_HIERARCHY: Record<QuoteRole, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  member: 1,
}

export function hasMinRole(role: string | undefined, min: QuoteRole): boolean {
  return (ROLE_HIERARCHY[(role || '') as QuoteRole] ?? 0) >= ROLE_HIERARCHY[min]
}

export interface QuoteContext {
  userId: string
  organizationId: string
  organizationName: string
  organizationSlug: string
  role: QuoteRole
}

/**
 * 金額の出所。
 * ⚠️ 相場は事業判断に直結する。根拠のない金額を出さないため、
 *    どこから来た数字かを必ず記録し、画面にも表示する。
 */
export type PriceSource = 'own_price' | 'market' | 'competitor' | 'manual' | 'unknown'

export const PRICE_SOURCE_LABEL: Record<PriceSource, string> = {
  own_price: '自社の公開価格',
  market: '相場データ',
  competitor: '競合の公開価格',
  manual: '手入力',
  unknown: '要見積',
}

/** 商材プロフィール（URL調査の結果） */
export interface ProductProfile {
  companyName?: string
  summary?: string
  /** SaaS / 受託制作 / コンサル / 運用代行 / スポット など */
  deliveryModel?: string
  /** 月額 / 従量 / 人数 / 制作物単位 / 工数 など */
  pricingAxis?: string
  targetCustomer?: string
  /** サイトに書かれていた価格（あればこれが最優先の根拠になる） */
  publishedPrices?: string[]
  optionCandidates?: string[]
}

/** 生成された見積もり品目 */
export interface SuggestedItem {
  itemName: string
  spec: string
  qty: number
  unit: string
  unitPrice: number | null
  taxRate: number
  priceSource: PriceSource
  sourceRef: string
  rangeMin: number | null
  rangeMax: number | null
}

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft: '下書き',
  confirmed: '確定',
  sent: '送付済み',
}
