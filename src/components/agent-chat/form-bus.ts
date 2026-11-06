// ============================================
// 画面（ツールのフォーム）と会話（AgentDock）の間の通り道
// ============================================
// 設計: docs/architecture/agent-chat/DESIGN-2026-11-05.md
// - フォームは、開いている間だけ register する。会話は、同じ画面の欄を動かして値を入れ、本物の送信処理を呼ぶ。
// - 保存の手段をここで作らない。submit はフォームが持つ本物の送信処理を呼ぶだけ（成功・失敗はその結果）。
import type { AgentFormSnapshot } from '@/lib/agent-chat/types'

export type SubmitResult = { ok: true; href: string } | { ok: false; error: string }

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

/** フォームが現れて、入力できる状態になるまで待つ（時間切れは null） */
export function waitForAgentForm(formKey: string, timeoutMs = 20_000): Promise<AgentFormHandler | null> {
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
      if (h && h.ready()) finish(h)
    }
    listeners.add(check)
    // ready() は登録のあとに変わる（一覧を読み終える）ので、短い間隔でも確かめる
    const poll = window.setInterval(check, 100)
    const timer = window.setTimeout(() => finish(null), timeoutMs)
    check()
  })
}
