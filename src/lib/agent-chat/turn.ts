// ============================================
// チャットの1回の依頼を、会話の形（作業の一覧・確認カード・完了）に進める（画面にも API にも依らない純粋な部品）
// ============================================
// 決まり（設計: docs/architecture/agent-chat/DESIGN-2026-11-05.md）:
//   - 保存の指示（effect "submit"）は、確認カードを出している間（phase "confirm"）に、本人が「approve」したときだけ返す。
//   - 完了（phase "done"）は、画面の送信が成功を知らせた（submitted ok）あとだけ。失敗したら failed にして、直して再送できる。
//   - 足りない値を聞くのは、AI を呼ばずに画面の中だけで行う。
import { normalizeValue } from '@/lib/agent-router/prefill'
import type { AgentField } from '@/lib/agent-router/types'
import { yenCandidates } from './ground'
import { buildSteps, confirmRows, doneView } from './ops'
import { yenText } from './today'
import type { AgentFormSnapshot, ChatApiResponse, ChatOp, ConfirmRow, NextAction, StepView } from './types'

export type Phase = 'idle' | 'reading' | 'asking' | 'working' | 'confirm' | 'submitting' | 'done' | 'failed' | 'guided'

export interface ChatState {
  phase: Phase
  text: string
  op: ChatOp | null
  values: Record<string, string>
  missing: AgentField[]
  steps: StepView[]
  say: string
  /** 聞き返しに答えた言葉（会話に出す。値が飛ぶ元になる） */
  answers: string[]
  /** 確認カードを出した時の、画面の今の値（金額の直しの計算に使う） */
  snap: AgentFormSnapshot | null
  /** 確認カードの前に出すひと言（金額を直したあとなど） */
  notice: string | null
  /** 聞き返しの入力が合わなかったときの案内 */
  askError: string | null
  confirm: { title: string; submitLabel: string; rows: ConfirmRow[]; note: string } | null
  done: { lead: string; made: string; next: NextAction[]; href: string } | null
  /** 失敗の内容（failed のとき） */
  error: string | null
  /** 失敗の理由の種類。blocked=権限がない / not-started=ツールをまだ始めていない（どちらも、もう一度やっても同じ失敗になる） */
  errorKind: FailKind
  /** チャットの操作でない答え（guided のとき）。今の案内のまま出す */
  guide: Exclude<ChatApiResponse, { kind: 'op' }> | null
}

export type FailKind = 'blocked' | 'not-started' | 'other'

export type ChatEvent =
  | { t: 'ask'; text: string }
  | { t: 'reply'; res: ChatApiResponse | null }
  | { t: 'answer'; value: string }
  | { t: 'step'; id: string; status: 'run' | 'done' }
  | { t: 'ready'; snap: AgentFormSnapshot; message?: string }
  /** 確認カードの前後で、金額を直す依頼（「税込みだった」・新しい金額）。画面の今の値から計算する。AI は呼ばない */
  | { t: 'adjust'; text: string }
  | { t: 'run-failed'; error: string; kind?: FailKind }
  | { t: 'approve' }
  /** 保存の前に画面の値を読み直したら、確認カードを出した時と違っていた（本人が画面で直した）。保存せず、確認カードを出し直す */
  | { t: 'changed'; snap: AgentFormSnapshot }
  | { t: 'submitted'; ok: true; snap: AgentFormSnapshot; href: string }
  | { t: 'submitted'; ok: false; error: string; kind?: FailKind }
  | { t: 'retry' }
  | { t: 'reset' }

export type ChatEffect =
  | { k: 'api'; text: string }
  | { k: 'run'; op: ChatOp; values: Record<string, string> }
  /** 金額の欄を直す。set は、あわせて入れる欄（例: 税込みの切り替え） */
  | { k: 'amend'; amount: number; message: string; set?: Record<string, string> }
  | { k: 'submit' }

export const INITIAL_STATE: ChatState = {
  phase: 'idle', text: '', op: null, values: {}, missing: [], steps: [], say: '', answers: [], snap: null, notice: null, askError: null, confirm: null, done: null, error: null, errorKind: 'other', guide: null,
}

const READ_FAILED = '依頼を読めませんでした。時間をおいて、もう一度お試しください。'

function setStep(steps: StepView[], id: string, status: StepView['status']): StepView[] {
  return steps.map((s) => (s.id === id ? { ...s, status } : s))
}

/** 状態に、足りない値があれば聞く・無ければ画面で進める、を決める */
function advance(state: ChatState): { state: ChatState; effects: ChatEffect[] } {
  if (!state.op) return { state, effects: [] }
  if (state.missing.length) return { state: { ...state, phase: 'asking', askError: null }, effects: [] }
  return { state: { ...state, phase: 'working', askError: null }, effects: [{ k: 'run', op: state.op, values: state.values }] }
}

export function reduce(state: ChatState, ev: ChatEvent): { state: ChatState; effects: ChatEffect[] } {
  switch (ev.t) {
    case 'ask': {
      const text = ev.text.trim()
      if (!text || state.phase === 'reading' || state.phase === 'working' || state.phase === 'submitting') return { state, effects: [] }
      return { state: { ...INITIAL_STATE, phase: 'reading', text }, effects: [{ k: 'api', text }] }
    }
    case 'reply': {
      if (state.phase !== 'reading') return { state, effects: [] }
      const res = ev.res
      if (!res) return { state: { ...state, phase: 'failed', error: READ_FAILED }, effects: [] }
      if (res.kind === 'op') {
        const next: ChatState = { ...state, op: res.op, values: res.values, missing: res.missing, steps: buildSteps(res.op), say: res.say }
        return advance(next)
      }
      return { state: { ...state, phase: 'guided', guide: res }, effects: [] }
    }
    case 'answer': {
      if (state.phase !== 'asking' || !state.missing.length) return { state, effects: [] }
      const field = state.missing[0]
      const v = normalizeValue(field.type, ev.value)
      if (!v) return { state: { ...state, askError: `${field.label}の形が合いません。もう一度入れてください。` }, effects: [] }
      return advance({ ...state, answers: [...state.answers, ev.value.trim()], values: { ...state.values, [field.key]: v }, missing: state.missing.slice(1) })
    }
    case 'step': {
      if (state.phase !== 'working') return { state, effects: [] }
      return { state: { ...state, steps: setStep(state.steps, ev.id, ev.status) }, effects: [] }
    }
    case 'ready': {
      if (state.phase !== 'working' || !state.op) return { state, effects: [] }
      const c = confirmRows(state.op, ev.snap)
      const steps = setStep(state.steps.map((s) => (s.id === 'confirm' ? s : { ...s, status: 'done' as const })), 'confirm', 'run')
      return { state: { ...state, phase: 'confirm', steps, snap: ev.snap, notice: ev.message ?? null, confirm: { title: state.op.confirmTitle, submitLabel: state.op.submitLabel, rows: c.rows, note: c.note } }, effects: [] }
    }
    case 'adjust': {
      // ⚠️ 直せるのは確認カードを出している間だけ。直したあとも、保存の指示は返さない（もう一度 確認カードで押してもらう）
      if (state.phase !== 'confirm' || !state.op || !state.snap) return { state, effects: [] }
      const text = ev.text.normalize('NFKC')
      const typed = [...yenCandidates(text)][0]
      const inclusive = /税込/.test(text)
      const answers = [...state.answers, ev.text.trim()]
      // 税の計算が無い操作は、チャットでは直さない。画面の欄を直してもらい、保存の前に画面の今の値で確認カードを出し直す
      if (state.op.taxAdjust === 'none') return { state: { ...state, notice: '内容を直すときは、画面の欄を直してください。直したあと、確認カードのボタンを押すと、確認カードを出し直します。' }, effects: [] }
      if (state.op.taxAdjust === 'flag') {
        // 画面に「税込み」の切り替えがあるツール。金額はそのままで、切り替えを入れる（割り算をしない）
        const base = typed ?? Number(state.snap.amount)
        const exclusive = /税抜/.test(text) && !inclusive
        if (!Number.isFinite(base) || base <= 0) return { state: { ...state, notice: '金額を読み取れませんでした。画面の金額の欄は、直接直せます。' }, effects: [] }
        if (!inclusive && !exclusive && typed == null) return { state: { ...state, notice: '直し方を読み取れませんでした。「税込みだった」か、新しい金額を入れてください。' }, effects: [] }
        const message = inclusive ? `${yenText(base)} を税込みとして入れ直しました。` : exclusive ? `${yenText(base)} を税抜として入れ直しました。` : `金額を ${yenText(base)} に直しました。`
        return { state: { ...state, phase: 'working', notice: null, answers }, effects: [{ k: 'amend', amount: base, message, ...(inclusive || exclusive ? { set: { taxIncluded: inclusive ? 'true' : 'false' } } : {}) }] }
      }
      const sub = Number(state.snap.subtotal)
      const base = typed ?? sub
      if (!Number.isFinite(base) || base <= 0) return { state: { ...state, notice: '金額を読み取れませんでした。画面の金額の欄は、直接直せます。' }, effects: [] }
      const amount = inclusive ? Math.round(base / 1.1) : base
      if (!inclusive && typed == null) return { state: { ...state, notice: '直し方を読み取れませんでした。「税込みだった」か、新しい金額を入れてください。' }, effects: [] }
      const message = inclusive ? `税込みの ${yenText(base)} を、税抜の ${yenText(amount)} に直しました。` : `税抜の ${yenText(amount)} に直しました。`
      return { state: { ...state, phase: 'working', notice: null, answers }, effects: [{ k: 'amend', amount, message }] }
    }
    case 'run-failed': {
      if (state.phase !== 'working') return { state, effects: [] }
      return { state: { ...state, phase: 'failed', error: ev.error, errorKind: ev.kind ?? 'other' }, effects: [] }
    }
    case 'approve': {
      // ⚠️ 保存の指示を返すのは、確認カードが出ているときだけ
      if (state.phase !== 'confirm') return { state, effects: [] }
      return { state: { ...state, phase: 'submitting', error: null }, effects: [{ k: 'submit' }] }
    }
    case 'changed': {
      // 保存の前の読み直しで違いが見つかった。保存はまだ走っていない。確認カードを、画面の今の値で出し直す
      if (state.phase !== 'submitting' || !state.op) return { state, effects: [] }
      const c = confirmRows(state.op, ev.snap)
      return { state: { ...state, phase: 'confirm', snap: ev.snap, notice: '画面の内容が変わったので、保存せずに確認カードを出し直しました。内容を確かめてください。', confirm: { title: state.op.confirmTitle, submitLabel: state.op.submitLabel, rows: c.rows, note: c.note } }, effects: [] }
    }
    case 'submitted': {
      if (state.phase !== 'submitting' || !state.op) return { state, effects: [] }
      if (!ev.ok) return { state: { ...state, phase: 'failed', error: ev.error, errorKind: ev.kind ?? 'other' }, effects: [] }
      const d = doneView(state.op, ev.snap, ev.href)
      return {
        state: { ...state, phase: 'done', steps: state.steps.map((s) => ({ ...s, status: 'done' as const })), done: { ...d, href: ev.href }, confirm: null },
        effects: [],
      }
    }
    case 'retry': {
      // 失敗のあと、画面の値がそのまま残っているので、確認カードに戻す（送信に失敗した場合だけ。読み取り・画面の失敗は最初から）
      if (state.phase !== 'failed') return { state, effects: [] }
      // 権限がない・ツールを始めていない失敗は、もう一度やっても同じになる。やり直しは受け付けない（画面から始める・管理者に頼む、を案内する）
      if (state.errorKind !== 'other') return { state, effects: [] }
      if (state.confirm) return { state: { ...state, phase: 'confirm', error: null, errorKind: 'other' }, effects: [] }
      if (state.op) return advance({ ...state, steps: buildSteps(state.op), error: null, errorKind: 'other' })
      return { state: INITIAL_STATE, effects: [] }
    }
    case 'reset':
      return { state: INITIAL_STATE, effects: [] }
  }
}
