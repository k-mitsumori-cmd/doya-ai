'use client'

// 単発の支出を追加するモーダル
import { useState } from 'react'
import toast from 'react-hot-toast'
import { CATEGORIES, CATEGORY_LABEL } from '@/lib/expense/constants'
import { expenseApi, jsonInit, useBusyAction } from './api'
import { Btn, Check, Field, Modal, inputCls, todayYmd } from './ui'

export default function OneOffModal({ orgSlug, defaultDate, onClose, onSaved }: { orgSlug: string; defaultDate: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: '', category: 'other', amount: '', taxRate: '10', taxIncluded: false, payDate: defaultDate || todayYmd(), withholding: false, note: '' })
  // 二度押しで同じ支出が2件できないよう、実行中は次の押下を無視する
  const { busy, run } = useBusyAction()
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  const save = () => run('save', async () => {
    try {
      await expenseApi('/api/expense/schedules', orgSlug, jsonInit('POST', { ...f, amount: Number(f.amount), taxRate: Number(f.taxRate) }))
      toast.success('単発の支出を追加しました')
      onSaved()
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    }
  })

  return (
    <Modal title="単発の支出を追加" onClose={onClose}>
      <div className="space-y-3">
        <Field label="内容"><input className={inputCls} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="例: 会議室の利用料" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="カテゴリ">
            <select className={inputCls} value={f.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </Field>
          <Field label="支払日"><input type="date" className={inputCls} value={f.payDate} onChange={(e) => set('payDate', e.target.value)} /></Field>
          <Field label="金額（円）"><input type="number" min={0} className={inputCls} value={f.amount} onChange={(e) => set('amount', e.target.value)} /></Field>
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
