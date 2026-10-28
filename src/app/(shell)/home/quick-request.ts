// ============================================
// 経営ホームの「すぐ登録する依頼」（画面に依らない純粋な部品）
// ============================================
// 「20万円支出を登録したい」のような、1回の登録で済む依頼は、作戦に分けず、
// そのツールの登録の画面を、金額を入れた状態で開く。保存は利用者が押す。
// （2026-10-28 本人の指摘「登録の直前まで進めた方がいいのに、作戦にできませんと出る」）
// ⚠️ ここでは画面を開く先を決めるだけ。データは作らない。
// ⚠️ 金額が読めないときは null（作戦づくりか、ツールの入口に任せる）。

export type QuickRequestKind = 'expense' | 'invoice'

export interface QuickRequest {
  kind: QuickRequestKind
  /** 円。整数 */
  amount: number
  /** 開く画面 */
  href: string
  /** ボタンと案内に出す言葉 */
  label: string
}

/** 1回に入れられる金額の上限（入力の取り違えで桁が大きくなりすぎないように） */
export const QUICK_AMOUNT_MAX = 10_000_000_000

/** 文の中の金額を円で読む（「20万円」「200,000円」「1.5万円」「3千円」「2億円」）。読めなければ null */
export function parseYenAmount(text: string): number | null {
  const s = text.normalize('NFKC').replace(/\s+/g, '')
  // 単位（億・万・千）か「円」が付いた数だけを金額として読む（「3つ」「2025年」などは読まない）
  const m = s.match(/(\d+(?:,\d{3})*(?:\.\d+)?)(億|万|千)?(円)?/g)?.map((x) => x.match(/^(\d+(?:,\d{3})*(?:\.\d+)?)(億|万|千)?(円)?$/)).find((x) => x && (x[2] || x[3]))
  if (!m) return null
  const base = Number(m[1].replace(/,/g, ''))
  if (!Number.isFinite(base) || base <= 0) return null
  const unit = m[2] === '億' ? 100_000_000 : m[2] === '万' ? 10_000 : m[2] === '千' ? 1_000 : 1
  const yen = Math.round(base * unit)
  if (!Number.isSafeInteger(yen) || yen <= 0 || yen > QUICK_AMOUNT_MAX) return null
  return yen
}

const EXPENSE_WORDS = ['支出', '経費', '支払', '固定費', '外注費', '業務委託費']
const INVOICE_WORDS = ['請求', '売上']
/** 見るだけの依頼（「今月の売上を見たい」）は、登録の画面を開かない */
const VIEW_WORDS = ['見たい', '見る', '確認', '知りたい', 'いくら']

/** 依頼の文から、すぐ開ける登録の画面を選ぶ。合わなければ null */
export function parseQuickRequest(text: string): QuickRequest | null {
  const s = text.normalize('NFKC').replace(/\s+/g, '')
  if (!s || VIEW_WORDS.some((w) => s.includes(w))) return null
  const amount = parseYenAmount(s)
  if (amount == null) return null
  const yen = amount.toLocaleString('ja-JP')
  if (EXPENSE_WORDS.some((w) => s.includes(w))) {
    return { kind: 'expense', amount, href: `/expense?to=new-contract&amount=${amount}`, label: `支出の登録画面を開く（${yen}円を入れた状態）` }
  }
  if (INVOICE_WORDS.some((w) => s.includes(w))) {
    return { kind: 'invoice', amount, href: `/income/invoices/new?amount=${amount}`, label: `請求書の作成画面を開く（${yen}円を入れた状態）` }
  }
  return null
}

/** URL の amount を読む（登録の画面の側で使う）。正の整数の円だけを受け取り、ほかは '' */
export function readAmountParam(raw: string | null | undefined): string {
  if (!raw || !/^\d{1,11}$/.test(raw)) return ''
  const n = Number(raw)
  return n > 0 && n <= QUICK_AMOUNT_MAX ? String(n) : ''
}
