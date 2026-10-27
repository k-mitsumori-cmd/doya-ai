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

/**
 * 知らせの量（提案リスト (34)）。ユーザーが選ぶ。
 * normal … すべて / less … エラーと承認待ちだけ / errors … エラーだけ
 */
export type NoticeLevel = 'normal' | 'less' | 'errors'
export const NOTICE_LEVELS: { id: NoticeLevel; label: string; note: string }[] = [
  { id: 'normal', label: 'ふつう', note: 'ヒント・新機能・承認待ち・エラーを出します' },
  { id: 'less', label: '少なめ', note: '承認待ちとエラーだけを出します' },
  { id: 'errors', label: 'エラーだけ', note: 'うまくいかなかったときだけ出します' },
]
export function parseNoticeLevel(raw: string | null | undefined): NoticeLevel {
  return raw === 'less' || raw === 'errors' ? raw : 'normal'
}
/** この量の設定で、この種類を出してよいか */
export function allowedAtLevel(kind: NoticeKind, level: NoticeLevel): boolean {
  if (level === 'errors') return kind === 'error'
  if (level === 'less') return kind === 'error' || kind === 'approval'
  return true
}

export interface NoticePage {
  /** ドヤくんの絵（/character/{pose}-256.webp）。表示オフのときは出さない */
  pose?: string
  eyebrow: string
  title: string
  body?: string
  points?: string[]
  /** はじめの手順など、済んだかどうかを並べる */
  checklist?: { label: string; done: boolean; href?: string }[]
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
  /**
   * 1日1つまでに間引く知らせ（新機能・「〜でできること」）。その日にもう1つ出していたら、出さずに「お知らせ」の列（held）に移す。
   * 2026-10-27 統括の本番の確認（画面を移るたびに、そのツールの知らせが出ていた）
   */
  paced?: boolean
  /**
   * 「これ1つで全部進む」帯がある画面では出さない知らせ（ツールの「できること」）。帯の下に1行で同じ中身を出すため。
   * 見たことにはしない（帯の無い画面では、今までどおりカードで出る）
   */
  hideWithBand?: boolean
  /** 何枚かを順に見せる（ようこそなど）。あれば title などより先に使う */
  pages?: NoticePage[]
  primary?: NoticeAction
  secondary?: NoticeAction
  /** 3つめのボタン（控えめな見た目。例: ドヤパワーが尽きたときの「回復を待つ」） */
  tertiary?: NoticeAction
  /**
   * 本文の下に差し込む中身（例: 新料金の UpsellActions）。中身を出す部品が自分でボタンを持つときに使う。
   * 中身から閉じるときは、受け取った close(done) を呼ぶ。渡したときは primary・secondary・tertiary を出さない
   */
  content?: (close: (done: boolean) => void) => unknown
}

export interface NoticeQueueState {
  current: Notice | null
  queue: Notice[]
  /** 1日1つの決まりで止めた知らせ。メニューの「お知らせ」から開ける */
  held?: Notice[]
}

export const EMPTY_QUEUE: NoticeQueueState = { current: null, queue: [], held: [] }

const byRank = (a: Notice, b: Notice) => NOTICE_RANK[a.kind] - NOTICE_RANK[b.kind]

/** 列に足す。見たことがある once の知らせ・同じ id の知らせは足さない。エラーは表示中のものより先に出す */
export function enqueueNotice(s: NoticeQueueState, n: Notice, seen: ReadonlySet<string>, level: NoticeLevel = 'normal'): NoticeQueueState {
  if (!allowedAtLevel(n.kind, level)) return s
  if (n.once && seen.has(n.id)) return s
  if (s.current?.id === n.id || s.queue.some((q) => q.id === n.id) || s.held?.some((q) => q.id === n.id)) return s
  if (s.current && n.kind === 'error' && s.current.kind !== 'error') {
    return { current: null, queue: [n, s.current, ...s.queue].sort(byRank), held: s.held }
  }
  return { current: s.current, queue: [...s.queue, n].sort(byRank), held: s.held }
}

/**
 * 次を出す。表示中があれば何もしない。作業中はエラーだけを出す。
 * pacedUsedToday が true なら、paced の知らせは出さずに held へ移す（1日1つまで）
 */
export function showNextNotice(s: NoticeQueueState, busy: boolean, pacedUsedToday = false): NoticeQueueState {
  if (s.current || !s.queue.length) return s
  let queue = s.queue
  let held = s.held ?? []
  if (pacedUsedToday && queue.some((q) => q.paced)) {
    held = [...held, ...queue.filter((q) => q.paced)]
    queue = queue.filter((q) => !q.paced)
    if (!queue.length) return { current: null, queue, held }
  }
  const [head, ...rest] = queue
  if (busy && head.kind !== 'error') return queue === s.queue ? s : { current: null, queue, held }
  return { current: head, queue: rest, held }
}

/** 帯がある画面では、列から hideWithBand の知らせを外す（表示中のものは触らない） */
export function dropBandNotices(s: NoticeQueueState, bandOn: boolean): NoticeQueueState {
  if (!bandOn || !s.queue.some((q) => q.hideWithBand)) return s
  return { ...s, queue: s.queue.filter((q) => !q.hideWithBand) }
}

/** 「お知らせ」から1つ開く（本人が選んだので、1日1つの決まりは当てない）。表示中があれば、それは列に戻す */
export function openHeldNotice(s: NoticeQueueState, id: string): NoticeQueueState {
  const n = s.held?.find((q) => q.id === id)
  if (!n) return s
  const held = (s.held ?? []).filter((q) => q.id !== id)
  const queue = s.current ? [s.current, ...s.queue].sort(byRank) : s.queue
  return { current: { ...n, paced: false }, queue, held }
}

/** 日本時間の年月日（1日1つの決まりの「日」） */
export function noticeDay(d: Date): string {
  return new Date(d.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
}

/**
 * 表示中を閉じる。
 * - done（×・主なボタン・最後のページ）: once なら「見た」に入れる
 * - later（「あとで」・下へ引く・外を押す）: 列の後ろへ戻さず、この画面では出さない（次に開いたときにまた出る）
 */
export function closeNotice(s: NoticeQueueState): { state: NoticeQueueState; closed: Notice | null } {
  return { state: { current: null, queue: s.queue, held: s.held }, closed: s.current }
}

/** 作業中になったら、表示中のエラー以外を列に戻す */
export function pauseNotice(s: NoticeQueueState): NoticeQueueState {
  if (!s.current || s.current.kind === 'error') return s
  return { current: null, queue: [s.current, ...s.queue].sort(byRank), held: s.held }
}
