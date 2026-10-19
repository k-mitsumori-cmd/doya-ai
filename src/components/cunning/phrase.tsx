// ============================================
// 日本語の短い文を、1文字だけの行を出さずに折り返す（UI 品質 T-1・S-62）
// ============================================
// - 句読点（、。・！？」））の後ろに <wbr> を入れ、そこを折り返しの候補にする
// - word-break: auto-phrase … 文節で折り返す（Chrome 119 以降。対応しないブラウザでは無視される）
// - text-wrap: balance … 行の長さをそろえ、最後の行に1文字だけ残さない（Chrome・Safari・Firefox の新しい版）
// ⚠️ keep-all は使わない（句読点の無い文が1つのかたまりになり、狭い幅で途中の変な位置で切れるため）
import { Fragment } from 'react'

export const PHRASE_CLASS = '[word-break:auto-phrase] [text-wrap:balance]'

export function Phrase({ text }: { text: string }) {
  const parts = text.split(/(?<=[、。・！？」）])/)
  return <>{parts.map((p, i) => <Fragment key={i}>{i > 0 ? <wbr /> : null}{p}</Fragment>)}</>
}
