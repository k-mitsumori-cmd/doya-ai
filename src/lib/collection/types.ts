// ============================================
// ツール図鑑・実績バッジ・活用度スコアの型
// ============================================
// ⚠️ ここは型だけ。DB は facts.server.ts、判定は badges.ts / score.ts（純粋関数）。

/** 分野。src/components/shell/tools.ts の区分（stage）と同じ値 */
export type CollectionArea = 'collect' | 'sell' | 'hire' | 'operate'

export const COLLECTION_AREAS: { id: CollectionArea; label: string; hint: string }[] = [
  { id: 'collect', label: 'マーケティング', hint: '記事・バナー・広告・展示会など' },
  { id: 'sell', label: '営業（セールス）', hint: '商談・営業リスト・提案資料など' },
  { id: 'hire', label: '採用・人材管理', hint: '面接・人事・勤怠など' },
  { id: 'operate', label: '経理・バックオフィス', hint: '見積・請求・支払・案件の収支など' },
]

export function isCollectionArea(v: unknown): v is CollectionArea {
  return typeof v === 'string' && COLLECTION_AREAS.some((a) => a.id === v)
}

/** 図鑑に載せるツール */
export interface CollectionTool {
  id: string
  name: string
  /** アイコンの名前（src/components/shell/icons.tsx の対応表） */
  icon: string
  hint: string
  href: string
  area: CollectionArea
  /** 開発中。活用度スコアの分母に入れない */
  beta?: boolean
}

/** ツールごとの使った記録（DB の既存の記録を数えたもの） */
export interface ToolUsage {
  count: number
  /** いちばん古い記録の日時（ISO）。分からなければ null */
  firstAt: string | null
}

/**
 * 実績の判定に使う事実。すべて DB の既存の記録から数える（facts.server.ts）。
 * ⚠️ 数え方を変えたら badges.ts の説明文とテストも直す。
 */
export interface CollectionFacts {
  /** ツールの id → 使った記録 */
  tools: Record<string, ToolUsage>
  /** 送った見積（sentAt がある、または status が sent） */
  quotesSent: ToolUsage
  /** 出した請求書（確定済みで、取り消していないもの） */
  invoicesIssued: ToolUsage
  /** 入金を記録した数 */
  paymentsRecorded: ToolUsage
  /** 請求漏れ0の月（YYYY-MM）。その月に請求予定があり、すべて請求済み・見送りになっている、締まった月 */
  cleanBillingMonths: string[]
  /** 書き上げた SEO 記事（status = DONE） */
  articlesDone: ToolUsage
  /** 受注した商談（status = won） */
  dealsWon: ToolUsage
  /** 終えた面接（completed / evaluated） */
  interviewsDone: ToolUsage
  /** 完了した案件（promane の status = completed） */
  projectsCompleted: ToolUsage
}

export const EMPTY_USAGE: ToolUsage = { count: 0, firstAt: null }

export function emptyFacts(): CollectionFacts {
  return {
    tools: {},
    quotesSent: EMPTY_USAGE,
    invoicesIssued: EMPTY_USAGE,
    paymentsRecorded: EMPTY_USAGE,
    cleanBillingMonths: [],
    articlesDone: EMPTY_USAGE,
    dealsWon: EMPTY_USAGE,
    interviewsDone: EMPTY_USAGE,
    projectsCompleted: EMPTY_USAGE,
  }
}
