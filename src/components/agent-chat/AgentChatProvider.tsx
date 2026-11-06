'use client'
// ============================================
// チャットで仕事を進める仕組みの持ち主（会話の状態と、画面を動かす実行役）
// ============================================
// 設計: docs/architecture/agent-chat/DESIGN-2026-11-05.md
// - 状態の進め方は src/lib/agent-chat/turn.ts（純粋）。ここは、その指示（effect）を実際の通信・画面の操作にする。
// - 保存は、確認カードで本人が押したあと（effect "submit"）に、画面のフォームの本物の送信処理を呼ぶだけ。
// ⚠️ 旗 AGENT_CHAT_ROLLOUT が off のときは、ShellGate がこれを描かない（今の画面・API のまま）。
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { chatOpByKey, resolveFixed } from '@/lib/agent-chat/ops'
import { incomeAmountAmendmentMessage, planIncomeAmountAmendment } from '@/lib/agent-chat/income-amount'
import { jstTodayYmd, yenText } from '@/lib/agent-chat/today'
import { INITIAL_STATE, reduce, type ChatEffect, type ChatEvent, type ChatState } from '@/lib/agent-chat/turn'
import type { AgentFormSnapshot, ChatApiResponse, ChatOp } from '@/lib/agent-chat/types'
import { getAgentForm, waitForAgentForm, type AgentFormHandler } from './form-bus'
import { blurField, clearStage, cursorOff, fly, focusField, nextFrames, paceMs, sleep, typeInto } from './motion'

export interface AgentChatApi {
  state: ChatState
  open: boolean
  setOpen: (v: boolean) => void
  /** スマホの見せ方（会話・両方・画面）。切り替えても処理は止めない */
  view: 'both' | 'chat' | 'tool'
  setView: (v: 'both' | 'chat' | 'tool') => void
  dispatch: (ev: ChatEvent) => void
  /** 経営ホームなど、ほかの場所から依頼の結果（API の返事）を渡して会話を始める */
  begin: (text: string, res: ChatApiResponse) => void
}

const Ctx = createContext<AgentChatApi | null>(null)
/** 旗が off（Provider が無い）のときは null */
export function useAgentChat(): AgentChatApi | null { return useContext(Ctx) }

const ABORTED = Symbol('aborted')

export default function AgentChatProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<ChatState>(INITIAL_STATE)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'both' | 'chat' | 'tool'>('both')
  const stateRef = useRef(state)
  // 会話をやり直したとき、前の実行役が続きを進めないようにする番号
  const runId = useRef(0)
  const reviewed = useRef<{ form: AgentFormHandler; snapshot: AgentFormSnapshot } | null>(null)

  const dispatchRef = useRef<(ev: ChatEvent) => void>(() => {})

  const runOp = useCallback(async (op: ChatOp, values: Record<string, string>, id: number) => {
    const alive = () => runId.current === id
    const d = (ev: ChatEvent) => { if (!alive()) throw ABORTED; dispatchRef.current(ev) }
    const wait = async (ms: number) => { await sleep(ms); if (!alive()) throw ABORTED }
    try {
      d({ t: 'step', id: 'open-tool', status: 'run' }); await wait(paceMs()); d({ t: 'step', id: 'open-tool', status: 'done' })
      d({ t: 'step', id: 'open-form', status: 'run' })
      if (window.location.pathname !== op.path) router.push(op.path)
      const form = await waitForAgentForm(op.formKey)
      if (!alive()) throw ABORTED
      if (!form) { d({ t: 'run-failed', error: `${op.label}の画面を開けませんでした。もう一度お試しください。` }); return }
      await wait(240); d({ t: 'step', id: 'open-form', status: 'done' })
      // 決まった値 → 欄（依頼から読んだ値）の順。欄ごとに、スクロール → 光らせる → 値が飛ぶ → 入れる、を実際の setValue に合わせて進める
      const todo: { stepId: string; key: string; value: string; label: string; fixed: boolean }[] = [
        ...resolveFixed(op, jstTodayYmd()).map((f) => ({ stepId: `fixed:${f.key}`, key: f.key, value: f.value, label: f.value, fixed: true })),
        ...op.fields.map((f) => ({ stepId: `fill:${f.key}`, key: f.key, value: values[f.key] ?? '', label: f.type === 'yen' ? yenText(values[f.key]) : (values[f.key] ?? ''), fixed: false })).filter((x) => x.value),
      ]
      for (const t of todo) {
        d({ t: 'step', id: t.stepId, status: 'run' })
        await focusField(t.key)
        if (!alive()) throw ABORTED
        let ok = true
        if (t.fixed) {
          ok = await form.setValue(t.key, t.value)
          await wait(90)
        } else {
          await fly(t.label, t.key)
          if (!alive()) throw ABORTED
          if (op.pickKeys.includes(t.key)) ok = await form.setValue(t.key, t.value)
          else {
            await typeInto(t.value, (v) => { void form.setValue(t.key, v) }, alive)
            if (!alive()) throw ABORTED
            ok = await form.setValue(t.key, t.value)
          }
          await wait(180)
        }
        blurField(t.key)
        if (!ok) { d({ t: 'run-failed', error: '画面に値を入れられませんでした。画面を開き直して、もう一度お試しください。' }); return }
        d({ t: 'step', id: t.stepId, status: 'done' })
      }
      cursorOff()
      await nextFrames(3)
      if (!alive()) throw ABORTED
      const snap = { ...form.snapshot() }
      reviewed.current = { form, snapshot: snap }
      d({ t: 'ready', snap })
    } catch (e) {
      clearStage()
      if (e !== ABORTED) dispatchRef.current({ t: 'run-failed', error: '画面の操作を進められませんでした。' })
    }
  }, [router])

  /** 確認カードのあとの金額の直し。画面の欄を、1字ずつ入れ直す（小計・売上予定のプレビューは画面の今の処理で変わる）。AI は呼ばない */
  const amend = useCallback(async (amount: number | null, inclusive: boolean, id: number) => {
    const alive = () => runId.current === id
    const op = stateRef.current.op
    const form = op ? getAgentForm(op.formKey) : undefined
    const receipt = reviewed.current
    const assertContext = () => {
      if (!alive()) throw ABORTED
      if (!op || !form || receipt?.form !== form || getAgentForm(op.formKey) !== form || !form.ready() || window.location.pathname !== op.path) {
        throw new Error('登録の画面が変わりました。依頼から始め直して、内容を確認してください。')
      }
    }
    try {
      assertContext()
      if (!form) return
      const before = { ...form.snapshot() }
      const plan = planIncomeAmountAmendment(before, amount, inclusive)
      await focusField('amount')
      assertContext()
      if (!sameReview(form.snapshot(), before)) throw new Error('金額を直す前に内容が変わりました。画面を確認して、もう一度依頼してください。')
      if (!await form.setValue('amount', '')) throw new Error('金額の欄に入力できませんでした。')
      await typeInto(String(plan.amount), (v) => { assertContext(); void form.setValue('amount', v) }, alive)
      assertContext()
      if (!await form.setValue('amount', String(plan.amount))) throw new Error('金額の欄に入力できませんでした。')
      await sleep(160)
      blurField('amount'); cursorOff()
      await nextFrames(3)
      assertContext()
      const snap = { ...form.snapshot() }
      const message = incomeAmountAmendmentMessage(plan, snap)
      reviewed.current = { form, snapshot: snap }
      dispatchRef.current({ t: 'ready', snap, message })
    } catch (e) {
      clearStage()
      if (e !== ABORTED && alive()) {
        reviewed.current = null
        dispatchRef.current({ t: 'confirmation-invalid', error: e instanceof Error ? e.message : '金額を直せませんでした。' })
      }
    }
  }, [])

  const runEffect = useCallback((eff: ChatEffect) => {
    const id = runId.current
    if (eff.k === 'api') {
      void (async () => {
        let res: ChatApiResponse | null = null
        try {
          const r = await fetch('/api/agent/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: eff.text }) })
          res = r.ok ? ((await r.json()) as ChatApiResponse) : null
        } catch { res = null }
        if (runId.current === id) dispatchRef.current({ t: 'reply', res: normalizeReply(res) })
      })()
    } else if (eff.k === 'run') {
      void runOp(eff.op, eff.values, id)
    } else if (eff.k === 'amend') {
      void amend(eff.amount, eff.inclusive, id)
    } else {
      void (async () => {
        const op = stateRef.current.op
        const form = op ? getAgentForm(op.formKey) : undefined
        if (!form) { if (runId.current === id) dispatchRef.current({ t: 'submitted', ok: false, error: '登録の画面が閉じられました。もう一度、依頼から始めてください。' }); return }
        // 成功すると画面が移ってフォームが消えるので、確認カードの値はここで読んでおく
        const snap = { ...form.snapshot() }
        const receipt = reviewed.current
        if (!receipt || receipt.form !== form || !form.ready() || window.location.pathname !== op?.path || !sameReview(snap, receipt.snapshot) || !sameReview(stateRef.current.snap, receipt.snapshot)) {
          reviewed.current = null
          dispatchRef.current({ t: 'confirmation-invalid', error: '登録する画面または内容が変わりました。依頼から始め直して、内容を確認してください。' })
          return
        }
        let r: Awaited<ReturnType<typeof form.submit>>
        try { r = await form.submit() } catch { r = { ok: false, error: '登録できませんでした。通信を確かめて、もう一度お試しください。' } }
        if (runId.current !== id) return
        dispatchRef.current(r.ok ? { t: 'submitted', ok: true, snap, href: r.href } : { t: 'submitted', ok: false, error: r.error })
      })()
    }
  }, [runOp, amend])

  const dispatch = useCallback((ev: ChatEvent) => {
    const { state: next, effects } = reduce(stateRef.current, ev)
    // 新しい依頼を受けたとき・やり直したときだけ、前の実行役を止める（受け付けなかった依頼では止めない）
    if ((ev.t === 'ask' && next !== stateRef.current) || ev.t === 'reset') { runId.current += 1; reviewed.current = null }
    stateRef.current = next
    setState(next)
    effects.forEach(runEffect)
  }, [runEffect])
  dispatchRef.current = dispatch

  const begin = useCallback((text: string, res: ChatApiResponse) => {
    // 経営ホームがすでに AI を呼んで答えを受け取っているので、ここでは呼ばない。ask のあとに reply を渡す
    runId.current += 1
    reviewed.current = null
    stateRef.current = { ...INITIAL_STATE, phase: 'reading', text }
    setState(stateRef.current)
    setOpen(true)
    dispatch({ t: 'reply', res: normalizeReply(res) })
  }, [dispatch])

  const api = useMemo<AgentChatApi>(() => ({ state, open, setOpen, view, setView, dispatch, begin }), [state, open, view, dispatch, begin])
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

/** 返ってきた操作は、画面側の定義（ops.ts）で置き換える（知らない操作は受け付けない） */
function normalizeReply(res: ChatApiResponse | null): ChatApiResponse | null {
  if (!res) return null
  if (res.kind !== 'op') return res
  const op = chatOpByKey(res.op?.key)
  return op ? { ...res, op } : null
}

/** Compare the complete local review, including a form-specific payload marker when present. */
function sameReview(a: AgentFormSnapshot | null, b: AgentFormSnapshot): boolean {
  if (!a) return false
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && a[key] === b[key])
}
