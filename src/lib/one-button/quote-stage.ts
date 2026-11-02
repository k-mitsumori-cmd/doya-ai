// ============================================
// ドヤ見積の「これ1つで全部進む」帯が、いまどの段階を押させるか（画面に依らない純粋な部品）
// ============================================
// 品目の数だけで決めると、2つずれる（2026-10-27 round14 の本番の確認）。
// - 商材を登録ずみでも「URLを入れて解析」を求めてしまう → 商材があれば「品目の候補を出す」
// - 見積書を作ったあとも「作成しました」の押せないボタンのまま → 作ったら「作った見積書を開く」
export type QuoteOneButtonStage = 'analyze' | 'suggest' | 'create' | 'open'

export function quoteOneButtonStage(s: {
  /** 作った見積書の id（無ければ ''） */
  createdId: string
  itemCount: number
  /** 選んでいる商材の id（無ければ ''） */
  selectedProduct: string
}): QuoteOneButtonStage {
  if (s.createdId) return 'open'
  if (s.itemCount > 0) return 'create'
  if (s.selectedProduct) return 'suggest'
  return 'analyze'
}
