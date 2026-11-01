// ============================================
// 分野のスタンプをそろえたときのボーナス（純粋関数）
// ============================================
// 開発中（beta）を除く、その分野のツールをすべて使うと、分野ごとに1回だけボーナスがもらえる。
// - ツールが2つ未満の分野は対象にしない（1つ使っただけでそろったことにならない）
// - 付与は台帳の bonus（月の上限 MONTHLY_BONUS_CAP の中。超える分は付かない）。同じ分野は sourceKey で1回だけ
// - 量は小さくする（原価の面。仕様 PRICING-POINTS §6 の1）
// ⚠️ ここは判定だけ。付与は bonus-actions.ts（ボタンを押したときだけ。画面を開いただけでは付けない）。
import type { CollectionArea, CollectionTool } from './types'
import { COLLECTION_AREAS } from './types'

/** 分野1つをそろえたときの量（仮。ユーザーの最終決定の前） */
export const STAMP_SET_BONUS = 30

/** 付与の sourceKey（分野ごとに1回） */
export const stampSetKey = (area: CollectionArea) => `stampset:${area}`

export interface StampSet {
  area: CollectionArea
  label: string
  used: number
  total: number
  /** ボーナスの対象になる分野か（開発中を除くツールが2つ以上） */
  eligible: boolean
  complete: boolean
  bonus: number
}

export function stampSets(tools: CollectionTool[], usedIds: ReadonlySet<string>): StampSet[] {
  return COLLECTION_AREAS.map((a) => {
    const inArea = tools.filter((t) => t.area === a.id && !t.beta)
    const used = inArea.filter((t) => usedIds.has(t.id)).length
    const eligible = inArea.length >= 2
    return { area: a.id, label: a.label, used, total: inArea.length, eligible, complete: eligible && used === inArea.length, bonus: STAMP_SET_BONUS }
  })
}

/** 今もらえる（そろっている）分野 */
export function claimableAreas(sets: StampSet[]): CollectionArea[] {
  return sets.filter((s) => s.complete).map((s) => s.area)
}
