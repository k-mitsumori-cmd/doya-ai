'use client'

import { useState } from 'react'
import { parseSfaAmount } from '@/lib/sfa/amount'
import { useSfaDraftSnapshot, type useSfaClientMutations } from '@/lib/sfa/use-client-mutations'

export interface ConversionLead {
  id: string; name: string; contactName: string | null; email: string | null; phone: string | null
  corporateNumber: string | null; note: string | null; updatedAt: string; raw?: unknown
}
const FIELDS = [
  ['dealName', '商談名', 200], ['accountName', '取引先名', 200], ['contactName', '担当者名', 80],
  ['corporateNumber', '法人番号', 20], ['email', 'メール', 200], ['phone', '電話番号', 40],
  ['industry', '業界', 80], ['prefecture', '都道府県', 40], ['url', 'URL', 300], ['note', 'メモ', 2000],
] as const
type Field = typeof FIELDS[number][0]
type Draft = Record<Field, string> & { amount: string }
function initialDraft(lead: ConversionLead): Draft {
  const raw = lead.raw && typeof lead.raw === 'object' && !Array.isArray(lead.raw) ? lead.raw as Record<string, unknown> : {}
  const proposed = `${lead.name} 新規商談`
  return { accountName: lead.name, dealName: proposed.length <= 200 ? proposed : lead.name, amount: '0',
    contactName: lead.contactName || '', corporateNumber: lead.corporateNumber || '', email: lead.email || '',
    phone: lead.phone || '', note: lead.note || '', industry: typeof raw.industry === 'string' ? raw.industry : '',
    prefecture: typeof raw.prefecture === 'string' ? raw.prefecture : '', url: typeof raw.url === 'string' ? raw.url : '' }
}

export default function LeadConversionForm({ lead, mutations, recovered, onClose, onConverted }: {
  lead: ConversionLead; recovered: boolean; mutations: ReturnType<typeof useSfaClientMutations>; onClose: () => void; onConverted: () => void
}) {
  const [draft, setDraft] = useState(() => initialDraft(lead))
  const [error, setError] = useState('')
  const [completed, setCompleted] = useState(false)
  const snapshot = useSfaDraftSnapshot(draft)
  const blocked = mutations.creationBlocked('conversion')
  const submit = async () => {
    if (!mutations.active() || completed || recovered || mutations.creationBlocked('conversion')) return
    if (!draft.dealName.trim() || !draft.accountName.trim()) { setError('商談名と取引先名を入力してください。'); return }
    for (const [key, label, max] of FIELDS) if (draft[key].trim().length > max) { setError(`${label}は${max}文字以内で入力してください。`); return }
    if (parseSfaAmount(draft.amount) === null) { setError('金額は0以上の有効な数値で入力してください。'); return }
    setError('')
    const revision = snapshot.current.revision
    const result = await mutations.convertLead(lead.id, { ...draft, expectedUpdatedAt: lead.updatedAt })
    if (!result || !mutations.active()) return
    onConverted()
    if (revision === snapshot.current.revision) onClose()
    else setCompleted(true)
  }
  return <section aria-label="リード転換の確認" className="mb-5 rounded-2xl border border-green-200 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-bold text-slate-900">取引先・商談に転換</h2>
    <p className="my-2 text-sm text-slate-600">「{lead.name}」から取引先・商談を1件ずつ作成します。担当者名があれば担当者も作成します。元のリードの入力内容は保持します。</p>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {FIELDS.map(([key, label, max]) => <label key={key} className="text-sm font-bold text-slate-700">
        {label}（{max}文字以内）
        {key === 'note' ? <textarea aria-label={label} value={draft[key]} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          : <input aria-label={label} value={draft[key]} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />}
      </label>)}
      <label className="text-sm font-bold text-slate-700">商談金額（円）<input aria-label="商談金額（円）" inputMode="decimal" value={draft.amount} onChange={e => setDraft(d => ({ ...d, amount: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
    </div>
    <p className="mt-2 text-xs text-slate-500">商談金額の小数点以下は四捨五入します。</p>
    {error && <p role="alert" className="my-3 text-sm text-red-700">{error}</p>}
    {(completed || recovered) && <p role="status" className="my-3 text-sm text-green-800">転換は完了しました。送信後に変更した入力は保存せず、この画面に保持しています。一覧で作成済みの取引先・商談をご確認ください。</p>}
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" onClick={() => void submit()} disabled={!mutations.allowed || blocked || completed || recovered} className="rounded-xl bg-green-600 px-5 py-2.5 font-bold text-white disabled:opacity-50">取引先・商談を作成する</button>
      <button type="button" onClick={onClose} disabled={blocked} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold disabled:opacity-50">閉じて一覧を確認</button>
    </div>
  </section>
}
