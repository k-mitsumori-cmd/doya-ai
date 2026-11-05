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
import { jstTodayYmd } from '@/lib/agent-chat/today'
import { INITIAL_STATE, reduce, type ChatEffect, type ChatEvent, type ChatState } from '@/lib/agent-chat/turn'
import type { ChatApiResponse, ChatOp } from '@/lib/agent-chat/types'
import { getAgentForm, waitForAgentForm } from './form-bus'
import { nextFrames, paceMs, sleep } from './motion'

export interface AgentChatApi {
  state: ChatState
  open: boolean
  setOpen: (v: boolean) => void
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
  const stateRef = useRef(state)
  // 会話をやり直したとき、前の実行役が続きを進めないようにする番号
  const runId = useRef(0)

  const dispatchRef = useRef<(ev: ChatEvent) => void>(() => {})

  const runOp = useCallback(async (op: ChatOp, values: Record<string, string>, id: number) => {
    const d = (ev: ChatEvent) => { if (runId.current !== id) throw ABORTED; dispatchRef.current(ev) }
    const pace = async () => { await sleep(paceMs()); if (runId.current !== id) throw ABORTED }
    try {
      d({ t: 'step', id: 'open-tool', status: 'run' }); await pace(); d({ t: 'step', id: 'open-tool', status: 'done' })
      d({ t: 'step', id: 'open-form', status: 'run' })
      if (window.location.pathname !== op.path) router.push(op.path)
      const form = await waitForAgentForm(op.formKey)
      if (runId.current !== id) throw ABORTED
      if (!form) { d({ t: 'run-failed', error: `${op.label}の画面を開けませんでした。もう一度お試しください。` }); return }
      d({ t: 'step', id: 'open-form', status: 'done' })
      const todo: { stepId: string; key: string; value: string }[] = [
        ...resolveFixed(op, jstTodayYmd()).map((f) => ({ stepId: `fixed:${f.key}`, key: f.key, value: f.value })),
        ...op.fields.map((f) => ({ stepId: `fill:${f.key}`, key: f.key, value: values[f.key] ?? '' })).filter((x) => x.value),
      ]
      for (const t of todo) {
        d({ t: 'step', id: t.stepId, status: 'run' })
        const ok = await form.fill(t.key, t.value)
        if (!ok) { d({ t: 'run-failed', error: '画面に値を入れられませんでした。画面を開き直して、もう一度お試しください。' }); return }
        await pace()
        d({ t: 'step', id: t.stepId, status: 'done' })
      }
      await nextFrames(3)
      if (runId.current !== id) throw ABORTED
      d({ t: 'ready', snap: form.snapshot() })
    } catch (e) {
      if (e !== ABORTED) dispatchRef.current({ t: 'run-failed', error: '画面の操作を進められませんでした。' })
    }
  }, [router])

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
    } else {
      void (async () => {
        const op = stateRef.current.op
        const form = op ? getAgentForm(op.formKey) : undefined
        if (!form) { if (runId.current === id) dispatchRef.current({ t: 'submitted', ok: false, error: '登録の画面が閉じられました。もう一度、依頼から始めてください。' }); return }
        // 成功すると画面が移ってフォームが消えるので、確認カードの値はここで読んでおく
        const snap = form.snapshot()
        let r: Awaited<ReturnType<typeof form.submit>>
        try { r = await form.submit() } catch { r = { ok: false, error: '登録できませんでした。通信を確かめて、もう一度お試しください。' } }
        if (runId.current !== id) return
        dispatchRef.current(r.ok ? { t: 'submitted', ok: true, snap, href: r.href } : { t: 'submitted', ok: false, error: r.error })
      })()
    }
  }, [runOp])

  const dispatch = useCallback((ev: ChatEvent) => {
    const { state: next, effects } = reduce(stateRef.current, ev)
    // 新しい依頼を受けたとき・やり直したときだけ、前の実行役を止める（受け付けなかった依頼では止めない）
    if ((ev.t === 'ask' && next !== stateRef.current) || ev.t === 'reset') runId.current += 1
    stateRef.current = next
    setState(next)
    effects.forEach(runEffect)
  }, [runEffect])
  dispatchRef.current = dispatch

  const begin = useCallback((text: string, res: ChatApiResponse) => {
    // 経営ホームがすでに AI を呼んで答えを受け取っているので、ここでは呼ばない。ask のあとに reply を渡す
    runId.current += 1
    stateRef.current = { ...INITIAL_STATE, phase: 'reading', text }
    setState(stateRef.current)
    setOpen(true)
    dispatch({ t: 'reply', res: normalizeReply(res) })
  }, [dispatch])

  const api = useMemo<AgentChatApi>(() => ({ state, open, setOpen, dispatch, begin }), [state, open, dispatch, begin])
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

/** 返ってきた操作は、画面側の定義（ops.ts）で置き換える（知らない操作は受け付けない） */
function normalizeReply(res: ChatApiResponse | null): ChatApiResponse | null {
  if (!res) return null
  if (res.kind !== 'op') return res
  const op = chatOpByKey(res.op?.key)
  return op ? { ...res, op } : null
}
