// ============================================
// 製品の設定（会社が使う製品・メンバーの担当と既定）の決まり。純粋な関数（DB は settings.server.ts）
// ============================================
// 設計: docs/design/buddy-products-2026-11-01.md §5
// - 会社が使う製品: 行が無い製品は「使う」。経営管理は止められない。使わない製品は切り替えの一覧で下に下げるだけで、ツールは開ける
// - メンバーの担当: 複数。既定の製品は1つで、担当の中から選ぶ（担当が空なら、どの製品でもよい）
// - 社長（オーナー）と管理者は、担当に関係なく全部の製品を見る（今の部署の決まりと同じ）
// - 本人も、自分の担当と既定を決められる（2026-11-02 の決定）。管理者が決めた値を初期値にし、本人が変えたら本人の値を先に使う。
//   管理者が「本人に変えさせない」（locked）にした人は、管理者の値だけを使う。表は増やさず、同じ行に本人の値の列を持つ
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
  | { ok: true; products: ProductId[]; defaultProduct: ProductId | null; locked?: boolean }
  | { ok: false; status: number; code: 'INVALID_VALUE' | 'DEFAULT_NOT_ASSIGNED' }

/** 担当と既定の値を確かめる（管理者が決めるときと、本人が決めるときで同じ決まり） */
function decideProductsAndDefault(body: { products?: unknown; defaultProduct?: unknown }): MemberProductsDecision {
  const list = body.products
  if (!Array.isArray(list) || list.length > PRODUCT_IDS.length * 2 || !list.every(isProductId)) return { ok: false, status: 400, code: 'INVALID_VALUE' }
  const products = PRODUCT_IDS.filter((id) => list.includes(id))
  const def = body.defaultProduct ?? null
  if (def !== null && !isProductId(def)) return { ok: false, status: 400, code: 'INVALID_VALUE' }
  if (def && products.length > 0 && !products.includes(def)) return { ok: false, status: 400, code: 'DEFAULT_NOT_ASSIGNED' }
  return { ok: true, products, defaultProduct: def }
}

/** メンバーの担当と既定の保存を受け付けるか（管理者）。body: { products: ProductId[], defaultProduct: ProductId | null, locked?: boolean } */
export function decideMemberProductsUpdate(raw: unknown): MemberProductsDecision {
  const body = (raw && typeof raw === 'object' ? raw : {}) as { products?: unknown; defaultProduct?: unknown; locked?: unknown }
  if (body.locked !== undefined && typeof body.locked !== 'boolean') return { ok: false, status: 400, code: 'INVALID_VALUE' }
  const d = decideProductsAndDefault(body)
  if (!d.ok || body.locked === undefined) return d
  return { ...d, locked: body.locked }
}

export type SelfProductsDecision =
  | { ok: true; reset: true }
  | { ok: true; reset: false; products: ProductId[]; defaultProduct: ProductId | null }
  | { ok: false; status: number; code: 'INVALID_VALUE' | 'DEFAULT_NOT_ASSIGNED' | 'LOCKED' }

/**
 * 本人が自分の担当と既定を決める保存を受け付けるか。body: { products, defaultProduct } か { reset: true }（管理者の値に戻す）。
 * 管理者が「本人に変えさせない」にしているときは断る（画面でも選べないようにしている）。
 */
export function decideSelfProductsUpdate(raw: unknown, locked: boolean): SelfProductsDecision {
  if (locked) return { ok: false, status: 403, code: 'LOCKED' }
  const body = (raw && typeof raw === 'object' ? raw : {}) as { products?: unknown; defaultProduct?: unknown; reset?: unknown }
  if (body.reset === true) return { ok: true, reset: true }
  const d = decideProductsAndDefault(body)
  if (!d.ok) return d
  return { ok: true, reset: false, products: d.products, defaultProduct: d.defaultProduct }
}

/** 表の1行（管理者の値と、本人の値と、ロック） */
export interface MemberProductsRowValue {
  products: readonly string[]
  defaultProduct: string | null
  selfProducts?: readonly string[]
  selfDefaultProduct?: string | null
  /** 本人が自分で決めたか（本人の担当が空でも「空にした」と分かるように持つ） */
  selfSet?: boolean
  /** 管理者が「本人に変えさせない」にしたか */
  locked?: boolean
}

/** 画面に渡す、今の人の製品（使う担当と既定・どちらの値か・全部を見るか・会社が使う製品） */
export interface MemberProducts {
  /** 使う担当（本人が決めていれば本人の値、無ければ管理者の値） */
  assigned: ProductId[]
  /** 使う既定（同じく本人の値が先）。会社が使っていない製品は既定にしない */
  defaultProduct: ProductId | null
  /** 値がどこから来たか */
  source: 'self' | 'admin' | 'none'
  /** 管理者が「本人に変えさせない」にしたか（このときは cookie の既定も使わない） */
  locked: boolean
  /** オーナーと管理者は全部を見る */
  all: boolean
  enabled: ProductId[]
  /** 製品の設定の画面（/home/products）を開けるか（表を読めた管理者以上だけ） */
  canManage: boolean
  /** 自分の担当の画面（/home/my-products）で、本人が決められるか（表を読めて、ロックされていない人） */
  canEditSelf: boolean
}

/** 旗が off・表が無い・会社に入っていないときの形（全部を使い、決まりは何も無い） */
export const NO_MEMBER_PRODUCTS: MemberProducts = Object.freeze({
  assigned: [], defaultProduct: null, source: 'none', locked: false, all: true, enabled: [...PRODUCT_IDS], canManage: false, canEditSelf: false,
}) as MemberProducts

const pickProducts = (list: readonly string[] | undefined): ProductId[] => PRODUCT_IDS.filter((id) => list?.includes(id))

/** 本人の値を使うか（本人が決めていて、ロックされていない） */
export const usesSelfValue = (row: MemberProductsRowValue | null): boolean => Boolean(row?.selfSet && !row.locked)

export function memberProductsFor(input: {
  role: string | null
  row: MemberProductsRowValue | null
  enabled: ProductId[]
}): MemberProducts {
  const { row } = input
  const self = usesSelfValue(row)
  const assigned = pickProducts(self ? row?.selfProducts : row?.products)
  const def = self ? row?.selfDefaultProduct : row?.defaultProduct
  const defaultProduct = isProductId(def) && input.enabled.includes(def) ? def : null
  const all = input.role === 'owner' || input.role === 'admin'
  const locked = Boolean(row?.locked)
  const source = self ? 'self' : row ? 'admin' : 'none'
  return { assigned, defaultProduct, source, locked, all, enabled: input.enabled, canManage: all, canEditSelf: !locked }
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
