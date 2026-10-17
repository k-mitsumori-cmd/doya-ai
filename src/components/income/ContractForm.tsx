'use client'

// 契約の入力フォーム（新規・編集で共用）。下に売上予定のプレビューを出す
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addMonthsYm, daysInMonth, formatYmd, isYmd, parseYmd, todayJst } from '@/lib/income/dates'
import { buildSchedule } from '@/lib/income/schedule'
import {
  BILLING_CYCLE_LABEL, CONTRACT_STATUS_LABEL, CONTRACT_STATUS_ORDER, CONTRACT_TYPE_LABEL, ISSUE_TIMING_LABEL, PRORATE_LABEL,
  btnPrimary, Card, emptyLine, ErrorText, Field, inputCls, LineItemsEditor, linesToPayload, Spinner, errMsg, fetchJson, periodText, yen, ymd,
  type LineRow,
} from './ui'

export type ContractDto = {
  id: string
  clientId: string
  title: string
  contractNo: string | null
  type: string
  status: string
  startDate: string
  endDate: string | null
  autoRenew: boolean
  renewalNoticeDays: number | null
  billingCycle: string
  issueTiming: string
  prorate: string
  memo: string | null
  items: { name: string; quantity: number; unitPrice: number; taxRate: number }[]
}

type ClientOpt = { id: string; name: string }

function horizonEndOf(today: string): string {
  const t = parseYmd(today)
  const h = addMonthsYm(t.y, t.m, 12)
  return formatYmd(h.y, h.m, daysInMonth(h.y, h.m))
}

export default function ContractForm({ initial, defaultClientId, onSaved }: { initial?: ContractDto; defaultClientId?: string; onSaved?: () => void }) {
  const router = useRouter()
  const [clients, setClients] = useState<ClientOpt[]>([])
  const [f, setF] = useState({
    clientId: initial?.clientId ?? defaultClientId ?? '',
    title: initial?.title ?? '',
    contractNo: initial?.contractNo ?? '',
    type: initial?.type ?? 'recurring',
    status: initial?.status ?? 'active',
    startDate: ymd(initial?.startDate) || todayJst().slice(0, 8) + '01',
    endDate: ymd(initial?.endDate),
    autoRenew: initial?.autoRenew ?? false,
    renewalNoticeDays: initial?.renewalNoticeDays != null ? String(initial.renewalNoticeDays) : '',
    billingCycle: initial?.billingCycle ?? 'monthly',
    issueTiming: initial?.issueTiming ?? 'arrears',
    prorate: initial?.prorate ?? 'none',
    memo: initial?.memo ?? '',
  })
  const [rows, setRows] = useState<LineRow[]>(
    initial?.items.length
      ? initial.items.map((i) => ({ name: i.name, quantity: String(i.quantity), unitPrice: String(i.unitPrice), taxRate: i.taxRate }))
      : [emptyLine()],
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchJson<{ clients: ClientOpt[] }>('/api/income/clients')
      .then((d) => setClients(d.clients))
      .catch((e) => setError(errMsg(e)))
  }, [])

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const oneTime = f.type === 'one_time'

  const preview = useMemo(() => {
    try {
      if (!isYmd(f.startDate)) return { rows: [] as ReturnType<typeof buildSchedule>, note: '開始日を入力すると、売上予定のプレビューが出ます' }
      if (f.endDate && !isYmd(f.endDate)) return { rows: [], note: '終了日の形式が正しくありません' }
      const items = linesToPayload(rows)
      const amount = items.reduce((a, i) => a + (Number.isFinite(i.quantity * i.unitPrice) ? i.quantity * i.unitPrice : 0), 0)
      if (!(amount > 0)) return { rows: [], note: '金額を入力すると、売上予定のプレビューが出ます' }
      const out = buildSchedule(
        {
          type: f.type as 'recurring' | 'one_time',
          startDate: f.startDate,
          endDate: f.endDate || null,
          autoRenew: f.autoRenew,
          billingCycle: f.billingCycle as 'monthly',
          issueTiming: f.issueTiming as 'arrears',
          prorate: f.prorate as 'none',
          amountExclTax: amount,
        },
        horizonEndOf(todayJst()),
      )
      return { rows: out.slice(0, 6), note: out.length > 6 ? `ほか ${out.length - 6} 件（今日から12か月先まで作られます）` : '' }
    } catch (e) {
      return { rows: [], note: errMsg(e) }
    }
  }, [f.type, f.startDate, f.endDate, f.autoRenew, f.billingCycle, f.issueTiming, f.prorate, rows])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const body = {
        ...f,
        renewalNoticeDays: f.renewalNoticeDays.trim() === '' ? null : Number(f.renewalNoticeDays),
        endDate: f.endDate || null,
        items: linesToPayload(rows).map(({ name, quantity, unitPrice, taxRate }) => ({ name, quantity, unitPrice, taxRate })),
      }
      if (initial) {
        await fetchJson(`/api/income/contracts/${initial.id}`, { method: 'PATCH', body })
        setSaved(true)
        onSaved?.()
      } else {
        const d = await fetchJson<{ id: string }>('/api/income/contracts', { method: 'POST', body })
        router.push(`/income/contracts/${d.id}`)
      }
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card title="契約の内容">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="取引先（必須）">
            <select className={inputCls} value={f.clientId} onChange={set('clientId')} required>
              <option value="">選択してください</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="契約名（必須）">
            <input className={inputCls} value={f.title} onChange={set('title')} maxLength={120} required placeholder="例: 保守運用契約" />
          </Field>
          <Field label="契約番号">
            <input className={inputCls} value={f.contractNo} onChange={set('contractNo')} maxLength={60} />
          </Field>
          <Field label="種類">
            <select className={inputCls} value={f.type} onChange={set('type')}>
              {Object.entries(CONTRACT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="状態" hint="「有効」にすると売上予定が自動で作られます">
            <select className={inputCls} value={f.status} onChange={set('status')}>
              {CONTRACT_STATUS_ORDER.map((s) => <option key={s} value={s}>{CONTRACT_STATUS_LABEL[s]}</option>)}
            </select>
          </Field>
          <div />
          <Field label="開始日（必須）">
            <input type="date" className={inputCls} value={f.startDate} onChange={set('startDate')} required />
          </Field>
          <Field label="終了日" hint={oneTime ? undefined : '空欄は期間の定めなし'}>
            <input type="date" className={inputCls} value={f.endDate} onChange={set('endDate')} />
          </Field>
          {!oneTime && (
            <>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={f.autoRenew} onChange={(e) => setF({ ...f, autoRenew: e.target.checked })} className="h-4 w-4 accent-[#0f9f6e]" />
                自動更新する（終了日が更新日）
              </label>
              <Field label="解約予告の日数" hint="更新日の何日前までに通知が必要か">
                <input className={inputCls} inputMode="numeric" value={f.renewalNoticeDays} onChange={set('renewalNoticeDays')} placeholder="30" />
              </Field>
            </>
          )}
        </div>
      </Card>

      <Card title="請求のルール">
        <div className="grid gap-3 sm:grid-cols-3">
          {!oneTime && (
            <Field label="請求サイクル">
              <select className={inputCls} value={f.billingCycle} onChange={set('billingCycle')}>
                {Object.entries(BILLING_CYCLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          )}
          <Field label="請求のタイミング">
            <select className={inputCls} value={f.issueTiming} onChange={set('issueTiming')}>
              {Object.entries(ISSUE_TIMING_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          {!oneTime && (
            <Field label="初月・最終月の扱い" hint="日割りは毎月払いのときだけ使えます（円未満切り捨て）">
              <select className={inputCls} value={f.prorate} onChange={set('prorate')}>
                {Object.entries(PRORATE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          )}
        </div>
      </Card>

      <Card title="請求内容（1回の請求あたり・税抜）">
        <LineItemsEditor rows={rows} onChange={setRows} hint="1つの契約では税率をそろえてください（税率が違う場合は契約を分けます）。" />
      </Card>

      <Card title="売上予定のプレビュー（先頭6件）">
        {preview.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] font-black text-slate-500">
                  <th className="py-1.5 pr-3">計上月</th><th className="py-1.5 pr-3">請求予定日</th><th className="py-1.5 text-right">金額（税抜）</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.period} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3 font-bold text-slate-800">{periodText(r.period)}</td>
                    <td className="py-1.5 pr-3 font-bold text-slate-600">{r.plannedIssueDate}</td>
                    <td className="py-1.5 text-right font-bold tabular-nums text-slate-900">{yen(r.amountExclTax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {preview.note && <p className="mt-1 text-[11px] font-bold text-slate-500">{preview.note}</p>}
        {f.status !== 'active' && <p className="mt-1 text-[11px] font-bold text-amber-700">状態が「有効」ではないため、保存しても売上予定は作られません。</p>}
      </Card>

      <Card>
        <Field label="メモ">
          <textarea className={inputCls} rows={3} value={f.memo} onChange={set('memo')} maxLength={2000} />
        </Field>
      </Card>

      <ErrorText message={error} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy && <Spinner />}
          {initial ? '保存する' : '契約を登録する'}
        </button>
        {saved && <span className="text-xs font-black text-[#0f9f6e]">保存しました</span>}
      </div>
    </form>
  )
}
