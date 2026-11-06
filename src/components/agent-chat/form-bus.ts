// ============================================
// 画面（ツールのフォーム）と会話（AgentDock）の間の通り道
// ============================================
// 設計: docs/architecture/agent-chat/DESIGN-2026-11-05.md
// - フォームは、開いている間だけ register する。会話は、同じ画面の欄を動かして値を入れ、本物の送信処理を呼ぶ。
// - 保存の手段をここで作らない。submit はフォームが持つ本物の送信処理を呼ぶだけ（成功・失敗はその結果）。
import type { AgentFormSnapshot, ChatChoice } from '@/lib/agent-chat/types'

export type SubmitResult = { ok: true; href: string } | { ok: false; error: string; kind?: 'blocked' | 'not-started' | 'other' }

/** 保存の失敗が「権限がない」（サーバーが 403）なら 'blocked'。もう一度やっても同じ失敗になる */
export function failKindOf(e: unknown): 'blocked' | undefined {
  return (e as { status?: number } | null)?.status === 403 ? 'blocked' : undefined
}

export interface AgentFormHandler {
  /**
   * 欄に値を入れる（欄の名前は操作の定義の key）。入れられない欄は false。
   * 1字ずつ入れる動きのために、同じ欄に途中の値を続けて渡してよい（画面の小計・売上予定のプレビューは、そのたびに今の処理で変わる）。
   */
  setValue(key: string, value: string): boolean | Promise<boolean>
  /** 今の欄の値（確認カードに出す。税の計算も画面の今の処理の結果） */
  snapshot(): AgentFormSnapshot
  /** 画面の本物の送信処理（ボタンと同じ）。成功・失敗の結果を返す */
  submit(): Promise<SubmitResult>
  /** 入力できる状態か（取引先の一覧を読み終えたなど） */
  ready(): boolean
  /**
   * 今の人には操作できない理由（権限がないなど。なければ null）。会話は、値を入れる前にこの理由を出して止まる。
   * ⚠️ 権限の判定は、画面とサーバーが今していること（ロール・API の 403）をそのまま映す。会話専用の判定を作らない。
   */
  blocked?(): string | null
  /**
   * 欄を出す（ダイアログを開く、など）。画面を開いたあと・値を入れる前に1回呼ぶ。出し終えたら解決する。
   * ⚠️ 開くだけで、値は入れない。保存もしない。
   */
  prepare?(): void | Promise<void>
  /**
   * 本人に選んでもらう選択肢（例: ワークスペースが複数あるときの一覧）。なければ null。
   * 返すのは、その人が今の権限で見える選択肢だけ（画面が今出している一覧と同じ）。AI に選ばせない。
   */
  choices?(): { prompt: string; options: ChatChoice[] } | null
  /** 選んだ選択肢の画面へ運ぶ（画面の今の移動と同じ）。運んだあと、本物のフォームが同じ名前で登録される */
  choose?(id: string): void | Promise<void>
}

// 会話の確認ボタンから保存しているあいだだけ立てる。フォームは、この間は通知（toast）と画面の移動をしない。
// 完了は会話が先に出し、そのあと会話が移動する（通知がページ名に重なる、完了の前に読み込みの枠が出る、を避ける）。
let agentSubmitDepth = 0
export function isAgentSubmit(): boolean { return agentSubmitDepth > 0 }
export async function runAgentSubmit<T>(fn: () => Promise<T>): Promise<T> {
  agentSubmitDepth += 1
  try { return await fn() } finally { agentSubmitDepth -= 1 }
}

const forms = new Map<string, AgentFormHandler>()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

export function registerAgentForm(formKey: string, handler: AgentFormHandler): () => void {
  forms.set(formKey, handler)
  notify()
  return () => {
    if (forms.get(formKey) === handler) { forms.delete(formKey); notify() }
  }
}

export function getAgentForm(formKey: string): AgentFormHandler | undefined {
  return forms.get(formKey)
}

/**
 * フォームが現れて、入力できる状態になるまで待つ（時間切れは null）。
 * accept を渡すと、それを満たす登録だけを待つ（選択肢の画面から本物のフォームへ運んだあと、まだ残る選択肢の画面の登録を返さないため）。
 */
export function waitForAgentForm(formKey: string, timeoutMs = 20_000, accept?: (h: AgentFormHandler) => boolean): Promise<AgentFormHandler | null> {
  return new Promise((resolve) => {
    let done = false
    const finish = (h: AgentFormHandler | null) => {
      if (done) return
      done = true
      listeners.delete(check)
      window.clearInterval(poll)
      window.clearTimeout(timer)
      resolve(h)
    }
    const check = () => {
      const h = forms.get(formKey)
      if (h && h.ready() && (!accept || accept(h))) finish(h)
    }
    listeners.add(check)
    // ready() は登録のあとに変わる（一覧を読み終える）ので、短い間隔でも確かめる
    const poll = window.setInterval(check, 100)
    const timer = window.setTimeout(() => finish(null), timeoutMs)
    check()
  })
}
