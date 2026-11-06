'use client'

// 単発の支出を追加するモーダル
import { useEffect, useState, type MutableRefObject } from 'react'
import toast from 'react-hot-toast'
import { failKindOf, isAgentSubmit, type AgentFormHandler, type SubmitResult } from '@/components/agent-chat/form-bus'
import { CATEGORIES, CATEGORY_LABEL } from '@/lib/expense/constants'
import { expenseApi, jsonInit, useBusyAction } from './api'
import { Btn, Check, Field, Modal, inputCls, todayYmd } from './ui'

/** 会話（AgentDock）が、開いているこの窓の欄を動かすための口。窓が開いている間だけ入る（登録は支払予定の画面が持つ） */
export type OneOffAgentBridge = MutableRefObject<Pick<AgentFormHandler, 'setValue' | 'snapshot' | 'submit'> | null>

export default function OneOffModal({ orgSlug, defaultDate, onClose, onSaved, bridge }: { orgSlug: string; defaultDate: string; onClose: () => void; onSaved: () => void; bridge?: OneOffAgentBridge }) {
  const [f, setF] = useState({ title: '', category: 'other', amount: '', taxRate: '10', taxIncluded: false, payDate: defaultDate || todayYmd(), withholding: false, note: '' })
  // 二度押しで同じ支出が2件できないよう、実行中は次の押下を無視する
  const { busy, run } = useBusyAction()
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  /**
   * 追加する。画面のボタンも、会話（AgentDock）の確認ボタンも、この処理を通る（保存の処理はここ1つだけ）。
   * 会話からの保存では、通知（toast）を出さない。会話が完了を出してから、会話が移る。
   */
  const persist = async (): Promise<SubmitResult> => {
    // 画面のボタンが押せない状態（必要な項目が足りない）では、会話からも保存しない
    if (!f.title.trim() || !f.amount || !f.payDate) return { ok: false, error: '必要な項目（内容・金額・支払日）が足りないため、追加できません。' }
    const byAgent = isAgentSubmit()
    try {
      await expenseApi('/api/expense/schedules', orgSlug, jsonInit('POST', { ...f, amount: Number(f.amount), taxRate: Number(f.taxRate) }))
      if (!byAgent) toast.success('単発の支出を追加しました')
      onSaved()
      onClose()
      return { ok: true, href: `/expense/${encodeURIComponent(orgSlug)}/payables?month=${f.payDate.slice(0, 7)}` }
    } catch (e) {
      if (!byAgent) toast.error((e as Error).message)
      return { ok: false, error: (e as Error).message, kind: failKindOf(e) }
    }
  }
  const save = () => run('save', async () => { await persist() })

  // ---- 会話（AgentDock）から操作される口。欄の名前は src/lib/agent-chat/ops.ts の EXPENSE_ONEOFF_ADD ----
  if (bridge) {
    bridge.current = {
      setValue: (key, value) => {
        switch (key) {
          case 'title': set('title', value); return true
          case 'amount': set('amount', value); return true
          case 'payDate': if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; set('payDate', value); return true
          case 'taxIncluded': set('taxIncluded', value === 'true'); return true
          default: return false
        }
      },
      snapshot: () => ({
        title: f.title.trim(),
        amount: f.amount,
        category: CATEGORY_LABEL[f.category as keyof typeof CATEGORY_LABEL] ?? f.category,
        payDate: f.payDate,
        taxRate: f.taxRate === '0' ? '非課税・不課税' : `${f.taxRate}%`,
        taxIncluded: f.taxIncluded ? 'true' : 'false',
        withholding: f.withholding ? 'true' : 'false',
      }),
      submit: async () => {
        let r: SubmitResult = { ok: false, error: '前の操作が終わっていません。少し待って、もう一度お試しください。' }
        await run('agent', async () => { r = await persist() })
        return r
      },
    }
  }
  useEffect(() => () => { if (bridge) bridge.current = null }, [bridge])

  return (
    <Modal title="単発の支出を追加" onClose={onClose}>
      <div className="space-y-3">
        <Field label="内容"><input className={inputCls} data-agent-field="title" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="例: 会議室の利用料" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="カテゴリ">
            <select className={inputCls} value={f.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </Field>
          <Field label="支払日"><input type="date" className={inputCls} data-agent-field="payDate" value={f.payDate} onChange={(e) => set('payDate', e.target.value)} /></Field>
          <Field label="金額（円）"><input type="number" min={0} className={inputCls} data-agent-field="amount" value={f.amount} onChange={(e) => set('amount', e.target.value)} /></Field>
          <Field label="税率">
            <select className={inputCls} value={f.taxRate} onChange={(e) => set('taxRate', e.target.value)}>
              <option value="10">10%</option><option value="8">8%</option><option value="0">非課税・不課税</option>
            </select>
          </Field>
        </div>
        <Check checked={f.taxIncluded} onChange={(v) => set('taxIncluded', v)} label="入力した金額は税込です" />
        <Check checked={f.withholding} onChange={(v) => set('withholding', v)} label="源泉徴収の対象にする" hint="判断に迷う場合は税理士に確認してください。" />
        <Field label="メモ"><textarea className={inputCls} rows={2} value={f.note} onChange={(e) => set('note', e.target.value)} /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <Btn variant="secondary" onClick={onClose}>キャンセル</Btn>
          <Btn variant="secondary" onClick={save} busy={!!busy} disabled={!f.title.trim() || !f.amount || !f.payDate}>追加する</Btn>
        </div>
      </div>
    </Modal>
  )
}
