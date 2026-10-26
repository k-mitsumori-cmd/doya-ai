// 広告画像AIのフィードバック採点の満点。
// 合計の分母は「項目数 × 1項目の満点」で出す。数を直接書くと、項目を増減したときに表示が食い違う。
export const FEEDBACK_SCORE_KEYS = ['visibility', 'appeal', 'cta', 'fit', 'brand'] as const

/** 1項目の満点 */
export const FEEDBACK_ITEM_MAX = 5

/** 合計の満点（項目数 × 1項目の満点） */
export function feedbackTotalMax(itemCount: number = FEEDBACK_SCORE_KEYS.length, itemMax: number = FEEDBACK_ITEM_MAX): number {
  return itemCount * itemMax
}
