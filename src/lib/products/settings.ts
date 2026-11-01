// ============================================
// 製品の設定（会社が使う製品・メンバーの担当と既定）の決まり。純粋な関数（DB は settings.server.ts）
// ============================================
// 設計: docs/design/buddy-products-2026-11-01.md §5
// - 会社が使う製品: 行が無い製品は「使う」。経営管理は止められない。使わない製品は切り替えの一覧で下に下げるだけで、ツールは開ける
// - メンバーの担当: 複数。既定の製品は1つで、担当の中から選ぶ（担当が空なら、どの製品でもよい）
// - 社長（オーナー）と管理者は、担当に関係なく全部の製品を見る（今の部署の決まりと同じ）
// ⚠️ 製品は見え方だけ。ここの結果をツールの権限の判定に使わない（2026-11-01 の決定「担当でない製品のツールも開けるまま」）
import { PRODUCT_IDS, isProductId, type ProductId } from '@/lib/products'

/** 止められない製品（設定と権限の入口なので） */
export const ALWAYS_ON_PRODUCTS: readonly ProductId[] = ['management']

/** 表の行から、会社が使う製品の一覧を作る（決まった並び。行が無い製品は使う） */
export function enabledProductsFrom(rows: readonly { productId: string; enabled: boolean }[]): ProductId[] {
  const off = new Set(rows.filter((r) => !r.enabled && isProductId(r.productId)).map((r) => r.productId))
  return PRODUCT_IDS.filter((id) => ALWAYS_ON_PRODUCTS.includes(id) || !off.has(id))
}

export type CompanyProductsDecision =
  | { ok: true; enabled: ProductId[] }
  | { ok: false; status: number; code: 'INVALID_VALUE' }

/** 会社が使う製品の保存を受け付けるか。body: { enabled: ProductId[] }。知らない値が1つでもあれば全体を断る（黙って捨てない） */
export function decideCompanyProductsUpdate(raw: unknown): CompanyProductsDecision {
  if (!Array.isArray(raw) || raw.length > PRODUCT_IDS.length * 2) return { ok: false, status: 400, code: 'INVALID_VALUE' }
  if (!raw.every(isProductId)) return { ok: false, status: 400, code: 'INVALID_VALUE' }
  const set = new Set<ProductId>([...raw, ...ALWAYS_ON_PRODUCTS])
  return { ok: true, enabled: PRODUCT_IDS.filter((id) => set.has(id)) }
}

export type MemberProductsDecision =
  | { ok: true; products: ProductId[]; defaultProduct: ProductId | null }
  | { ok: false; status: number; code: 'INVALID_VALUE' | 'DEFAULT_NOT_ASSIGNED' }

/** メンバーの担当と既定の保存を受け付けるか。body: { products: ProductId[], defaultProduct: ProductId | null } */
export function decideMemberProductsUpdate(raw: unknown): MemberProductsDecision {
  const body = (raw && typeof raw === 'object' ? raw : {}) as { products?: unknown; defaultProduct?: unknown }
  const list = body.products
  if (!Array.isArray(list) || list.length > PRODUCT_IDS.length * 2 || !list.every(isProductId)) return { ok: false, status: 400, code: 'INVALID_VALUE' }
  const products = PRODUCT_IDS.filter((id) => list.includes(id))
  const def = body.defaultProduct ?? null
  if (def !== null && !isProductId(def)) return { ok: false, status: 400, code: 'INVALID_VALUE' }
  if (def && products.length > 0 && !products.includes(def)) return { ok: false, status: 400, code: 'DEFAULT_NOT_ASSIGNED' }
  return { ok: true, products, defaultProduct: def }
}

/** 画面に渡す、今の人の製品（担当・管理者が決めた既定・全部を見るか・会社が使う製品） */
export interface MemberProducts {
  assigned: ProductId[]
  adminDefault: ProductId | null
  /** オーナーと管理者は全部を見る */
  all: boolean
  enabled: ProductId[]
  /** 製品の設定の画面（/home/products）を開けるか（表を読めた管理者以上だけ） */
  canManage: boolean
}

/** 旗が off・表が無い・会社に入っていないときの形（全部を使い、決まりは何も無い） */
export const NO_MEMBER_PRODUCTS: MemberProducts = Object.freeze({ assigned: [], adminDefault: null, all: true, enabled: [...PRODUCT_IDS], canManage: false }) as MemberProducts

export function memberProductsFor(input: {
  role: string | null
  row: { products: readonly string[]; defaultProduct: string | null } | null
  enabled: ProductId[]
}): MemberProducts {
  const assigned = PRODUCT_IDS.filter((id) => input.row?.products.includes(id))
  const def = input.row?.defaultProduct
  const adminDefault = isProductId(def) && input.enabled.includes(def) ? def : null
  const all = input.role === 'owner' || input.role === 'admin'
  return { assigned, adminDefault, all, enabled: input.enabled, canManage: all }
}

/**
 * 切り替えの一覧の並び。使う製品を上に（担当がある人は担当を先に）、会社が使っていない製品は「ほかの製品」として下に。
 * ⚠️ 隠さない。ツールは開けるまま（2026-11-01 の決定）
 */
export function orderProductsForSwitcher(mp: Pick<MemberProducts, 'assigned' | 'all' | 'enabled'>): { main: ProductId[]; others: ProductId[] } {
  const enabled = PRODUCT_IDS.filter((id) => mp.enabled.includes(id))
  const first = mp.all ? [] : enabled.filter((id) => mp.assigned.includes(id))
  const main = [...first, ...enabled.filter((id) => !first.includes(id))]
  return { main, others: PRODUCT_IDS.filter((id) => !enabled.includes(id)) }
}
