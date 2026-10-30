// ============================================
// サービス名（ブランド名）の正本。画面に出る「ドヤAI」は、ここの関数を通して出す（旗の裏）
// ============================================
// 切り替えの旗は ./flag.ts。旗が off の間は、どの関数も今の「ドヤAI」のままの結果を返す。
// - コードの中の識別名（doya-ai、doya_ai など）・ツールの名前（ドヤAIO・ドヤAI質問リンク・ドヤAI商談・ドヤバナー など）は変えない。
// - 検索で「ドヤAI」を打った人にも届くよう、切り替え後は「ドヤ部下（旧ドヤAI）」を、しばらく併記する。
import { isBrandRenamed } from './flag'

export { brandRenameRollout, isBrandRenamed } from './flag'

export const BRAND_NAME_OLD = 'ドヤAI'
export const BRAND_NAME_NEW = 'ドヤ部下'
export const BRAND_EN_OLD = 'DOYA AI'
export const BRAND_EN_NEW = 'DOYA BUKA'

/** サービス名。旗が off なら「ドヤAI」 */
export function brandName(renamed: boolean = isBrandRenamed()): string {
  return renamed ? BRAND_NAME_NEW : BRAND_NAME_OLD
}

/** 英語のサービス名 */
export function brandNameEn(renamed: boolean = isBrandRenamed()): string {
  return renamed ? BRAND_EN_NEW : BRAND_EN_OLD
}

/** 旧名を併記した名前。切り替え後は「ドヤ部下（旧ドヤAI）」。旗が off なら「ドヤAI」 */
export function brandNameWithFormer(renamed: boolean = isBrandRenamed()): string {
  return renamed ? `${BRAND_NAME_NEW}（旧${BRAND_NAME_OLD}）` : BRAND_NAME_OLD
}

/** 構造化データ（Organization・SoftwareApplication）の alternateName に加える、旧名と英語の別表記 */
export function brandAlternateNames(renamed: boolean = isBrandRenamed()): string[] {
  return renamed ? [BRAND_NAME_OLD, BRAND_EN_OLD, 'Doya AI', 'DoyaAI', BRAND_EN_NEW, 'Doya Buka', 'DoyaBuka'] : []
}

// 「ドヤAI」のあとに続くと、別のツールの名前になる語（ドヤAIO・ドヤAI質問リンク・ドヤAI商談）。ここは変えない
const KEEP_AFTER = 'O|質問リンク|商談'
const SERVICE_NAME_RE = new RegExp(`${BRAND_NAME_OLD}(?!${KEEP_AFTER})`, 'g')

/** 文の中のサービス名「ドヤAI」を、切り替え後は「ドヤ部下」に置き換える。ツールの名前は変えない。旗が off なら、そのまま返す */
export function brandText(text: string, renamed: boolean = isBrandRenamed()): string {
  if (!renamed || !text) return text
  return text.replace(SERVICE_NAME_RE, BRAND_NAME_NEW)
}
