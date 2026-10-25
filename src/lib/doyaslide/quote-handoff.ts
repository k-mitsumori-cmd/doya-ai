// ============================================
// 見積書 → ドヤスライド の引き渡し（材料にする）
// ============================================
// ⚠️ Web検索を止める目印（サーバーだけが付ける）
//   スキーマを変えずに「見積書から作った資料」を見分けるため、customBrief の先頭行に
//   内部の目印 QUOTE_HANDOFF_MARKER を置く。/api/doyaslide/structure は、この目印が
//   あれば Web 検索（SerpAPI）を一切呼ばない。画面から送る旗では止めない。
//   理由: structure は project.title と customBrief の先頭 200 文字を検索語にして
//   外部へ送る。見積書の取引先名と金額を、外部の検索に出さないため。
export const QUOTE_HANDOFF_MARKER = '［見積書から作成］'

/** 見積書から作った資料か（先頭行の目印で見分ける） */
export function isQuoteHandoffBrief(customBrief: string | null | undefined): boolean {
  return typeof customBrief === 'string' && customBrief.startsWith(QUOTE_HANDOFF_MARKER)
}

export const HANDOFF_KINDS = ['quote', 'persona', 'seo'] as const
export type HandoffKind = (typeof HANDOFF_KINDS)[number]
export const HANDOFF_ID_PATTERN = /^[a-z0-9]{20,40}$/i

export type QuoteForHandoff = {
  title: string
  clientCompany: string | null
  status: string
  totalExclTax: number
  totalInclTax: number
  lineItems: { itemName: string; qty: number; unit: string; unitPrice: number }[]
}

const yen = (n: number) => `${Math.trunc(n).toLocaleString('ja-JP')}円`

/** 資料の補足（customBrief）を作る。下書きの見積書は、金額に「未確定」を付ける */
export function buildQuoteBrief(doc: QuoteForHandoff): string {
  const draft = doc.status === 'draft'
  const tag = draft ? '（未確定）' : ''
  const lines = [
    QUOTE_HANDOFF_MARKER,
    '次の見積書の内容を材料にして、提案資料をつくります。',
    draft ? 'この見積書は下書きです。金額はすべて未確定です。確定した金額として書かないでください。' : '',
    doc.clientCompany ? `宛先: ${doc.clientCompany}` : '',
    '明細:',
    ...doc.lineItems.slice(0, 50).map(
      (item) => `・${item.itemName} ${item.qty}${item.unit} 単価${yen(item.unitPrice)}${tag}`
    ),
    `合計（税抜）: ${yen(doc.totalExclTax)}${tag}`,
    `合計（税込）: ${yen(doc.totalInclTax)}${tag}`,
  ]
  return lines.filter(Boolean).join('\n').slice(0, 20000)
}
