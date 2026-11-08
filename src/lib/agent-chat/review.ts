// ============================================
// 確認カードで見せた内容と、保存の直前の画面を比べる（画面にも API にも依らない純粋な部品）
// ============================================
// 決まり（設計: docs/architecture/agent-chat/DESIGN-2026-11-05.md）:
//   - 本人が確認した内容と違うものは、保存しない。保存の直前に、画面・フォーム・準備の状態・全部の欄を比べる。
//   - 全部の欄（draft）は、この画面の中で比べるだけに使う。AI にも確認カードにも渡さない。
import type { AgentFormSnapshot, ChatOp } from './types'

/**
 * 比べた結果。
 * same=保存してよい / shown=確認カードに出る値が変わった / hidden=確認カードに出ない欄が変わった /
 * busy=読み込みや保存の処理が終わっていない / blocked=今の人には操作できない /
 * form=フォームが閉じた・別のフォームになった / screen=別の画面に移った
 */
export type ReviewVerdict = 'same' | 'shown' | 'hidden' | 'busy' | 'blocked' | 'form' | 'screen'

/** 確認カードを出した時に控える、フォームそのものと全部の欄 */
export interface ReviewReceipt { form: object; draft: string | null }

export function draftKey(draft: unknown): string | null {
  return draft == null ? null : JSON.stringify(draft)
}

/** 今の画面が、その操作のフォームの画面か。path に ?to= を持つ操作は、運ばれた先を here で判定する */
export function onOpScreen(op: Pick<ChatOp, 'path' | 'here'>, pathname: string): boolean {
  return op.here ? new RegExp(op.here).test(pathname) : pathname === op.path
}

export function judgeReview(input: {
  receipt: ReviewReceipt | null
  form: object | undefined
  onScreen: boolean
  ready: boolean
  blocked: boolean
  shown: AgentFormSnapshot | null
  snap: AgentFormSnapshot
  draft: string | null
}): ReviewVerdict {
  const { receipt, form, onScreen, ready, blocked, shown, snap, draft } = input
  if (!onScreen) return 'screen'
  if (!receipt || !form || receipt.form !== form || !shown || draft === null) return 'form'
  if (blocked) return 'blocked'
  if (!ready) return 'busy'
  if (JSON.stringify(shown) !== JSON.stringify(snap)) return 'shown'
  if (draft !== receipt.draft) return 'hidden'
  return 'same'
}

/**
 * 「やめる」で、会話が入れた値を画面から消してよいか。
 * - 本人が「やめる」を押せる時（確認カード・失敗・選択肢）だけ戻す。値を入れている途中・金額を直している途中のやり直しでは、欄に触らない
 * - 値を入れたフォームが、今も同じ画面にあるときだけ戻す（別の画面へ移ったあとは触らない）
 * - 確認カードのあとに本人が画面で直していたら、本人の内容を残す（戻さない）
 * - 確認カードの前（途中で止めた・失敗した）は、入れかけの値を戻す
 */
export function shouldUndoFill(input: { phase: string; filledForm: object; currentForm: object | undefined; receipt: ReviewReceipt | null; draftNow: string | null }): boolean {
  const { phase, filledForm, currentForm, receipt, draftNow } = input
  if (phase !== 'confirm' && phase !== 'failed' && phase !== 'choosing') return false
  if (currentForm !== filledForm) return false
  if (!receipt) return true
  return receipt.form === filledForm && receipt.draft === draftNow
}

export const SAVE_BUSY_MESSAGE = '保存の処理が進んでいます。終わるまでお待ちください。'

/**
 * 画面のボタンと会話の確認ボタンが同じ保存の処理を通るときに、同時に1件だけ受け付ける鍵。
 * 新規の登録に成功したら close する。画面が移るまでの間に、同じ内容を2件作らないため。
 */
export function createSaveLock() {
  let running = false
  let closed = false
  return {
    busy: () => running || closed,
    close: () => { closed = true },
    async run<T>(fn: () => Promise<T>): Promise<T | { ok: false; error: string; kind?: undefined }> {
      if (running || closed) return { ok: false, error: SAVE_BUSY_MESSAGE }
      running = true
      try { return await fn() } finally { running = false }
    },
  }
}
