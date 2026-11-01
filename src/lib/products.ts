// ============================================
// 製品の表（ドヤバディ マーケティング・セールス・人事・予実管理・経営管理）
// ============================================
// 設計: docs/design/buddy-products-2026-11-01.md（2026-11-01 本人の決定「おすすめで進める」。A案「見せ方だけ分ける」）
// - 製品は見え方の絞り込み。ツールの URL・課金・データ・権限は変えない（担当でない製品のツールも開ける）。
// - 見積もり（セールス・予実管理）とプロマネ（予実管理・経営管理）は2つの製品に入る。実体と URL は1つのまま。
// - 経営管理のホームは今の経営ホーム（/home）。ほかの製品のホームは /hub/<id>（/hr は HR のツールの URL なので /<id> にしない）。
// ⚠️ ここは純粋な表。サーバー専用の部品（next/headers・prisma など）を import しない（画面からも使うため）。
// ⚠️ 製品の表の正本はこのファイルだけ。services.ts には持たせない。
// ⚠️ 旗 PRODUCT_HUBS_ROLLOUT が off のあいだは使わない（今のメニューのまま。src/lib/products/flag.ts）。
import type { DepartmentId } from '@/lib/departments'

export type ProductId = 'marketing' | 'sales' | 'hr' | 'budget' | 'management'

export interface Product {
  id: ProductId
  /** 製品名（「ドヤバディ」のあとに付ける部門名） */
  name: string
  /** 英語の名前（DOYA BUDDY のあと） */
  en: string
  /** 切り替えの一覧に出す一言 */
  hint: string
  /** 製品のホーム */
  home: string
  /** 製品のアイコン（src/components/shell/icons.tsx の名前） */
  icon: 'Megaphone' | 'Briefcase' | 'Users' | 'Wallet' | 'LayoutDashboard'
  /** ツールの id。並びがそのままメニューの並び */
  toolIds: readonly string[]
}

// ⚠️ ベータで隠しているツール（cunning）は、どの製品にも入れない（2026-10-26 の決定のまま）。
export const PRODUCTS: readonly Product[] = [
  { id: 'management', name: '経営管理', en: 'Management', hint: '全部の製品の数字と、判断が要ること', home: '/home', icon: 'LayoutDashboard', toolIds: ['promane'] },
  { id: 'sales', name: 'セールス', en: 'Sales', hint: '商談・見積・営業リスト', home: '/hub/sales', icon: 'Briefcase', toolIds: ['sfa', 'shodan', 'aishodan', 'doyalist', 'doyaslide', 'quote'] },
  { id: 'marketing', name: 'マーケティング', en: 'Marketing', hint: '記事・バナー・AI検索の対策', home: '/hub/marketing', icon: 'Megaphone', toolIds: ['aio', 'seo', 'banner', 'adimage', 'persona', 'interview', 'asklink', 'popup', 'tenjikai'] },
  { id: 'hr', name: '人事', en: 'HR', hint: '社員・採用・勤怠', home: '/hub/hr', icon: 'Users', toolIds: ['hr', 'mensetsu', 'shanai', 'kintai'] },
  { id: 'budget', name: '予実管理', en: 'Budget', hint: '売上と支払いの予定と実績', home: '/hub/budget', icon: 'Wallet', toolIds: ['income', 'expense', 'quote', 'promane'] },
]

export const PRODUCT_IDS: readonly ProductId[] = PRODUCTS.map((p) => p.id)

/** 何も決まっていないときに開く製品 */
export const FALLBACK_PRODUCT: ProductId = 'management'

/** 2つの製品に入るツールを、どちらにも入っていない製品から開いたときの行き先 */
const PRIMARY_PRODUCT: Record<string, ProductId> = { quote: 'sales', promane: 'budget' }

/** 最後に開いた製品を覚える cookie（中身は製品の id だけ） */
export const PRODUCT_COOKIE = 'doya_product'
/** 本人が「この製品を既定にする」で選んだ製品を覚える cookie（段2で、会社の表の値をこれより先に使う） */
export const PRODUCT_DEFAULT_COOKIE = 'doya_product_default'

export function isProductId(v: unknown): v is ProductId {
  return typeof v === 'string' && (PRODUCT_IDS as readonly string[]).includes(v)
}

export function getProduct(id: ProductId): Product {
  return PRODUCTS.find((p) => p.id === id) as Product
}

/** cookie や URL の値を読む。知らない値は null */
export function parseProductId(raw: string | string[] | null | undefined): ProductId | null {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (!v) return null
  let text = v
  try { text = decodeURIComponent(v) } catch { /* そのまま読む */ }
  const s = text.trim()
  return isProductId(s) ? s : null
}

/** ツールが入っている製品（表の並び）。どこにも入っていなければ空 */
export function productsOfTool(toolId: string): ProductId[] {
  return PRODUCTS.filter((p) => p.toolIds.includes(toolId)).map((p) => p.id)
}

/** ツールの主な製品（複数に入るときは PRIMARY_PRODUCT、1つならそれ）。どこにも入っていなければ null */
export function primaryProductOfTool(toolId: string): ProductId | null {
  const hits = productsOfTool(toolId)
  if (hits.length === 0) return null
  const primary = PRIMARY_PRODUCT[toolId]
  return primary && hits.includes(primary) ? primary : hits[0]
}

/**
 * 今のパスで、どの製品のメニューを出すか。
 * - /home（とその下）は経営管理、/hub/<id> はその製品。
 * - ツールのパスは、今の製品に入っていれば今の製品のまま。入っていなければ、そのツールの主な製品。
 * - どれにも当たらないパス（料金など）は、今の製品のまま。
 */
export function productForPath(path: string, current: ProductId): ProductId {
  const seg = path.split(/[?#]/)[0].split('/').filter(Boolean)
  if (seg[0] === 'home') return 'management'
  if (seg[0] === 'hub') return parseProductId(seg[1]) ?? current
  if (!seg[0]) return current
  const hits = productsOfTool(seg[0])
  if (hits.length === 0) return current
  if (hits.includes(current)) return current
  return primaryProductOfTool(seg[0]) ?? current
}

/**
 * 最初に開く製品の決め方（設計書 §4.6）。
 * 1. 本人が既定にした製品 2. 管理者がそのメンバーに決めた既定（段2） 3. 最後に開いた製品
 * 4. 社長・管理者なら経営管理、メンバーなら担当の最初の1つ（段2） 5. 経営管理
 */
export function resolveStartProduct(input: {
  selfDefault?: ProductId | null
  adminDefault?: ProductId | null
  last?: ProductId | null
  isAdmin?: boolean
  assigned?: readonly ProductId[]
}): ProductId {
  if (input.selfDefault) return input.selfDefault
  if (input.adminDefault) return input.adminDefault
  if (input.last) return input.last
  if (input.isAdmin) return 'management'
  const first = input.assigned?.find(isProductId)
  return first ?? FALLBACK_PRODUCT
}

/** 経営ホームの「ドヤくんに頼む」の例を、製品に合わせて絞るための部署の id（経営管理は絞らない） */
export function departmentOfProduct(id: ProductId): DepartmentId | null {
  if (id === 'marketing' || id === 'sales' || id === 'hr') return id
  if (id === 'budget') return 'admin'
  return null
}

/** 部署の入口（旗 DEPARTMENTS_ROLLOUT）で選んでいた部署を、製品に読み替える（admin は予実管理） */
export function productOfDepartment(id: DepartmentId): ProductId {
  return id === 'admin' ? 'budget' : id
}

/** 正式名（「ドヤバディ セールス」）。ブランド名は呼ぶ側が brandName() で渡す */
export function productFullName(brand: string, id: ProductId): string {
  return `${brand} ${getProduct(id).name}`
}
