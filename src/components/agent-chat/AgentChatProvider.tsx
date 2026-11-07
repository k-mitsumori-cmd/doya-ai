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
import { draftKey, judgeReview, onOpScreen, type ReviewReceipt } from '@/lib/agent-chat/review'
import { INITIAL_STATE, reduce, type ChatEffect, type ChatEvent, type ChatState } from '@/lib/agent-chat/turn'
import type { AgentFormSnapshot, ChatApiResponse, ChatOp } from '@/lib/agent-chat/types'
import { getAgentForm, runAgentSubmit, waitForAgentForm, type AgentFormHandler } from './form-bus'
import { blurField, clearMarks, clearStage, cursorOff, fly, focusField, nextFrames, paceMs, sleep, typeInto } from './motion'

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
  // 確認カードを出した時のフォームと全部の欄。保存の直前に、今の画面と比べる
  const reviewed = useRef<ReviewReceipt | null>(null)
  const review = useCallback((form: AgentFormHandler): AgentFormSnapshot => {
    const snap = { ...form.snapshot() }
    reviewed.current = { form, draft: draftKey(form.draft()) }
    return snap
  }, [])

  const dispatchRef = useRef<(ev: ChatEvent) => void>(() => {})
  // 選択肢を出して待っているとき、本人が選んだ id を実行役へ渡す口（1つの依頼に1つだけ）
  const chooserRef = useRef<((id: string) => void) | null>(null)

  const runOp = useCallback(async (op: ChatOp, values: Record<string, string>, id: number) => {
    const alive = () => runId.current === id
    const d = (ev: ChatEvent) => { if (!alive()) throw ABORTED; dispatchRef.current(ev) }
    const wait = async (ms: number) => { await sleep(ms); if (!alive()) throw ABORTED }
    try {
      clearMarks()
      d({ t: 'step', id: 'open-tool', status: 'run' }); await wait(paceMs()); d({ t: 'step', id: 'open-tool', status: 'done' })
      d({ t: 'step', id: 'open-form', status: 'run' })
      // 待ちが切れたときに、移動が終わっていないのか、別の画面へ送られたのかを見分けるために控える
      const startPath = window.location.pathname
      if (!onOpScreen(op, window.location.pathname)) router.push(op.path)
      let form = await waitForAgentForm(op.formKey)
      if (!alive()) throw ABORTED
      // 選択肢の画面（ワークスペースが複数ある、など）が出ているときは、AI に決めさせず、本人に選んでもらう。選んだら、その画面へ運んで本物のフォームを待つ
      const offer = form?.choices?.() ?? null
      if (form && offer && offer.options.length) {
        const picker = form
        d({ t: 'choices', prompt: offer.prompt, options: offer.options })
        const id = await new Promise<string>((resolve) => { chooserRef.current = resolve })
        chooserRef.current = null
        if (!alive()) throw ABORTED
        await picker.choose?.(id)
        if (!alive()) throw ABORTED
        form = await waitForAgentForm(op.formKey, 20_000, (h) => !h.choices?.())
        if (!alive()) throw ABORTED
      }
      if (!form) {
        // 移動が終わらないとき・画面まで来て準備が終わらないときは、「ツールを始めていない」とは言わない。保存はしていないことと、次にできることを出す
        if (window.location.pathname === startPath || onOpScreen(op, window.location.pathname) || getAgentForm(op.formKey)) {
          d({ t: 'run-failed', kind: 'other', error: `${op.label}の画面の準備に時間がかかっています。まだ何も保存していません。少し待ってから、もう一度お試しください。` })
          return
        }
        d({ t: 'run-failed', kind: 'not-started', error: `${op.label}の画面を開けませんでした。そのツールをまだ始めていない場合は、先に画面から始めてください。` })
        return
      }
      // 権限がないなど、今の人には操作できないとき（画面とサーバーの今の判定）は、値を入れる前に理由を出して止まる
      const blocked = form.blocked?.()
      if (blocked) { d({ t: 'run-failed', kind: 'blocked', error: blocked }); return }
      // ダイアログを開くなど、欄を出す準備が要る画面は、ここで出す（値は入れない）
      await form.prepare?.()
      if (!alive()) throw ABORTED
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
      d({ t: 'ready', snap: review(form) })
    } catch (e) {
      clearStage()
      if (e !== ABORTED) dispatchRef.current({ t: 'run-failed', error: '画面の操作を進められませんでした。' })
    }
  }, [router, review])

  /** 確認カードのあとの金額の直し。画面の欄を、1字ずつ入れ直す（小計・売上予定のプレビューは画面の今の処理で変わる）。AI は呼ばない */
  const amend = useCallback(async (eff: Extract<ChatEffect, { k: 'amend' | 'amend-flag' }>, id: number) => {
    const alive = () => runId.current === id
    const op = stateRef.current.op
    const form = op ? getAgentForm(op.formKey) : undefined
    const receipt = reviewed.current
    const assertContext = () => {
      if (!alive()) throw ABORTED
      if (!op || !form || receipt?.form !== form || getAgentForm(op.formKey) !== form || !form.ready() || !onOpScreen(op, window.location.pathname)) {
        throw new Error('登録の画面が変わりました。依頼から始め直して、内容を確認してください。')
      }
    }
    try {
      assertContext()
      if (!form) return
      const before = { ...form.snapshot() }
      // 確認カードのあとに画面で直した欄があれば、直しのあとの案内で知らせる（確認カードに出ない欄もあるため）
      const edited = draftKey(form.draft()) !== receipt?.draft
      const plan = eff.k === 'amend' ? planIncomeAmountAmendment(before, eff.amount, eff.inclusive) : null
      const amount = plan ? plan.amount : eff.k === 'amend-flag' ? eff.amount : 0
      await focusField('amount')
      assertContext()
      if (JSON.stringify(form.snapshot()) !== JSON.stringify(before)) throw new Error('金額を直す前に内容が変わりました。画面を確認して、もう一度依頼してください。')
      if (!await form.setValue('amount', '')) throw new Error('金額の欄に入力できませんでした。')
      await typeInto(String(amount), (v) => { assertContext(); void form.setValue('amount', v) }, alive)
      assertContext()
      if (!await form.setValue('amount', String(amount))) throw new Error('金額の欄に入力できませんでした。')
      // あわせて入れる欄（例: 税込みの切り替え）。画面の本物の欄に入れる
      if (eff.k === 'amend-flag') for (const [k, v] of Object.entries(eff.set ?? {})) await form.setValue(k, v)
      await sleep(160)
      blurField('amount'); cursorOff()
      await nextFrames(3)
      assertContext()
      const snap = review(form)
      const lead = plan ? incomeAmountAmendmentMessage(plan, snap) : eff.k === 'amend-flag' ? eff.message : ''
      const message = edited ? `${lead} 画面で直した欄があります。確認カードに出ていない欄も確かめてください。` : lead
      dispatchRef.current({ t: 'ready', snap, message })
    } catch (e) {
      clearStage()
      if (e !== ABORTED && alive()) {
        reviewed.current = null
        dispatchRef.current({ t: 'confirmation-invalid', error: e instanceof Error ? e.message : '金額を直せませんでした。' })
      }
    }
  }, [review])

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
    } else if (eff.k === 'choose') {
      chooserRef.current?.(eff.id)
    } else if (eff.k === 'run') {
      void runOp(eff.op, eff.values, id)
    } else if (eff.k === 'amend' || eff.k === 'amend-flag') {
      void amend(eff, id)
    } else {
      void (async () => {
        const op = stateRef.current.op
        const form = op ? getAgentForm(op.formKey) : undefined
        const onScreen = op ? onOpScreen(op, window.location.pathname) : false
        if (!form) { if (runId.current === id) dispatchRef.current({ t: 'confirmation-invalid', why: onScreen ? 'form' : 'screen' }); return }
        // 成功すると画面が移ってフォームが消えるので、確認カードの値はここで読んでおく
        const snap = { ...form.snapshot() }
        const draft = draftKey(form.draft())
        const blocked = form.blocked?.() ?? null
        // 確認カードを出したあとに画面が変わっていたら、保存しない（確認していない内容を保存しない）
        const verdict = judgeReview({ receipt: reviewed.current, form, onScreen, ready: form.ready(), blocked: Boolean(blocked), shown: stateRef.current.snap, snap, draft })
        if (verdict !== 'same') {
          if (runId.current !== id) return
          if (verdict === 'shown' || verdict === 'hidden') {
            // 同じフォームの中で本人が直した。今の内容で確認カードを出し直し、本人がもう一度押すのを待つ
            reviewed.current = { form, draft }
            dispatchRef.current({ t: 'changed', snap, hidden: verdict === 'hidden' })
          } else if (verdict === 'busy') dispatchRef.current({ t: 'not-ready' })
          else if (verdict === 'blocked') dispatchRef.current({ t: 'submitted', ok: false, error: blocked ?? '今の権限では保存できません。', kind: 'blocked' })
          else { reviewed.current = null; dispatchRef.current({ t: 'confirmation-invalid', why: verdict }) }
          return
        }
        let r: Awaited<ReturnType<typeof form.submit>>
        try { r = await runAgentSubmit(() => form.submit()) } catch { r = { ok: false, error: '登録できませんでした。通信を確かめて、もう一度お試しください。' } }
        if (runId.current !== id) return
        dispatchRef.current(r.ok ? { t: 'submitted', ok: true, snap, href: r.href } : { t: 'submitted', ok: false, error: r.error, kind: r.kind })
        // 完了を出してから、できた物の画面へ移る（フォームは、会話からの保存では自分で移らない）
        if (r.ok) { const to = r.href; window.setTimeout(() => { if (runId.current === id && window.location.pathname !== to) router.push(to) }, 700) }
      })()
    }
  }, [runOp, amend, router])

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
