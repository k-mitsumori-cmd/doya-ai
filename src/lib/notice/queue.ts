// ============================================
// ドヤくんの知らせの順番待ち（画面に依らない純粋な部品）
// ============================================
// 共通の決まり（メインの提案リスト 2026-10-25）
// - 同時に出すのは1つだけ。順番は エラー → 承認待ち → 新機能 → ヒント
// - 作業中は出さない。ただしエラーだけは作業中でも出す
// - エラーは、表示中の承認待ち・新機能・ヒントより先に出す（表示中のものは列に戻す）
// - once の知らせは、閉じたら二度と出さない（記録は seen.ts）
// - 同じ id の知らせは、列に1つだけ

export type NoticeKind = 'error' | 'approval' | 'feature' | 'hint'
export type NoticeTone = 'info' | 'warn' | 'error'

export const NOTICE_RANK: Record<NoticeKind, number> = { error: 0, approval: 1, feature: 2, hint: 3 }

export interface NoticePage {
  /** ドヤくんの絵（/character/{pose}-256.webp）。表示オフのときは出さない */
  pose?: string
  eyebrow: string
  title: string
  body?: string
  points?: string[]
}

export interface NoticeAction {
  label: string
  /** 押したときに開く画面 */
  href?: string
  /** 押したときに、この知らせを「見た」にする（既定は true） */
  done?: boolean
}

export interface Notice extends NoticePage {
  id: string
  kind: NoticeKind
  tone?: NoticeTone
  /** 閉じたら二度と出さない */
  once?: boolean
  /** 何枚かを順に見せる（ようこそなど）。あれば title などより先に使う */
  pages?: NoticePage[]
  primary?: NoticeAction
  secondary?: NoticeAction
}

export interface NoticeQueueState {
  current: Notice | null
  queue: Notice[]
}

export const EMPTY_QUEUE: NoticeQueueState = { current: null, queue: [] }

const byRank = (a: Notice, b: Notice) => NOTICE_RANK[a.kind] - NOTICE_RANK[b.kind]

/** 列に足す。見たことがある once の知らせ・同じ id の知らせは足さない。エラーは表示中のものより先に出す */
export function enqueueNotice(s: NoticeQueueState, n: Notice, seen: ReadonlySet<string>): NoticeQueueState {
  if (n.once && seen.has(n.id)) return s
  if (s.current?.id === n.id || s.queue.some((q) => q.id === n.id)) return s
  if (s.current && n.kind === 'error' && s.current.kind !== 'error') {
    return { current: null, queue: [n, s.current, ...s.queue].sort(byRank) }
  }
  return { current: s.current, queue: [...s.queue, n].sort(byRank) }
}

/** 次を出す。表示中があれば何もしない。作業中はエラーだけを出す */
export function showNextNotice(s: NoticeQueueState, busy: boolean): NoticeQueueState {
  if (s.current || !s.queue.length) return s
  const [head, ...rest] = s.queue
  if (busy && head.kind !== 'error') return s
  return { current: head, queue: rest }
}

/**
 * 表示中を閉じる。
 * - done（×・主なボタン・最後のページ）: once なら「見た」に入れる
 * - later（「あとで」・下へ引く・外を押す）: 列の後ろへ戻さず、この画面では出さない（次に開いたときにまた出る）
 */
export function closeNotice(s: NoticeQueueState): { state: NoticeQueueState; closed: Notice | null } {
  return { state: { current: null, queue: s.queue }, closed: s.current }
}

/** 作業中になったら、表示中のエラー以外を列に戻す */
export function pauseNotice(s: NoticeQueueState): NoticeQueueState {
  if (!s.current || s.current.kind === 'error') return s
  return { current: null, queue: [s.current, ...s.queue].sort(byRank) }
}
