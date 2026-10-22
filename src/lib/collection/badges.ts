// ============================================
// 実績バッジ（純粋関数）
// ============================================
// 仕事の成果に結びつく実績だけを置く。連続日数・ランキング・期間限定のものは置かない。
// 判定は DB の既存の記録を数えた CollectionFacts だけで行う（facts.server.ts）。
// ⚠️ 取った実績は消えない前提の記録だけを使う（取り消した請求書などは数えない）。
import type { CollectionArea, CollectionFacts, ToolUsage } from './types'

export interface BadgeDef {
  id: string
  title: string
  /** 取り方（まだ取っていないときに出す） */
  how: string
  area: CollectionArea
  icon: string
  /** 何件で取れるか */
  target: number
  /** 数える記録 */
  pick: (f: CollectionFacts) => ToolUsage
  /** 試すときに開くページ */
  href: string
}

/** 画面に渡す形（関数を持たない。サーバーからクライアントの部品へそのまま渡せる） */
export interface BadgeState extends Omit<BadgeDef, 'pick'> {
  earned: boolean
  /** 取った日（分かれば ISO）。target 件目の日は分からないので、最初の記録の日を目安に出す */
  earnedAt: string | null
  current: number
}

const months = (f: CollectionFacts): ToolUsage => ({
  count: f.cleanBillingMonths.length,
  firstAt: f.cleanBillingMonths[0] ? `${f.cleanBillingMonths[0]}-01T00:00:00.000Z` : null,
})

export const BADGES: BadgeDef[] = [
  { id: 'first-quote-sent', title: '初めて見積を送った', how: '見積書を作って、送った状態にする', area: 'operate', icon: 'FileText', target: 1, pick: (f) => f.quotesSent, href: '/quote' },
  { id: 'first-invoice', title: '初めて請求書を出した', how: '収入管理で請求書を確定する', area: 'operate', icon: 'Receipt', target: 1, pick: (f) => f.invoicesIssued, href: '/income' },
  { id: 'first-payment', title: '入金を記録した', how: '収入管理で入金を記録する', area: 'operate', icon: 'BadgeJapaneseYen', target: 1, pick: (f) => f.paymentsRecorded, href: '/income' },
  { id: 'clean-billing-month', title: '請求漏れ0の月', how: '請求予定をその月のうちに全部請求する', area: 'operate', icon: 'CheckSquare', target: 1, pick: months, href: '/income' },
  { id: 'clean-billing-3', title: '請求漏れ0の月が3回', how: '請求漏れの無い月を3回つくる', area: 'operate', icon: 'CalendarDays', target: 3, pick: months, href: '/income' },
  { id: 'first-project-completed', title: '案件を完了まで管理した', how: 'プロマネで案件を「完了」にする', area: 'operate', icon: 'FolderKanban', target: 1, pick: (f) => f.projectsCompleted, href: '/promane' },
  { id: 'first-deal-won', title: '初めて受注した', how: '営業管理で商談を「受注」にする', area: 'sell', icon: 'Briefcase', target: 1, pick: (f) => f.dealsWon, href: '/sfa' },
  { id: 'deals-won-10', title: '受注10件', how: '営業管理で受注した商談を10件にする', area: 'sell', icon: 'Target', target: 10, pick: (f) => f.dealsWon, href: '/sfa' },
  { id: 'articles-10', title: '記事を10本書いた', how: '記事作成で記事を10本書き上げる', area: 'collect', icon: 'PenTool', target: 10, pick: (f) => f.articlesDone, href: '/seo' },
  { id: 'first-interview-done', title: '初めて面接を記録した', how: '面接で面接を最後まで記録する', area: 'hire', icon: 'UserCheck', target: 1, pick: (f) => f.interviewsDone, href: '/mensetsu' },
]

export function evaluateBadges(facts: CollectionFacts, defs: BadgeDef[] = BADGES): BadgeState[] {
  return defs.map((def) => {
    const u = def.pick(facts)
    const earned = u.count >= def.target
    const { pick: _pick, ...rest } = def
    return { ...rest, earned, earnedAt: earned ? u.firstAt : null, current: Math.min(u.count, def.target) }
  })
}

/**
 * 画面に出すバッジ。取ったものはいつも出す。まだのものは、会社が使う分野のものだけ出す
 * （使わない分野の「まだ」を並べて、できていないように見せない）。
 */
export function visibleBadges(states: BadgeState[], selected: readonly CollectionArea[]): BadgeState[] {
  return states.filter((s) => s.earned || selected.includes(s.area))
}
