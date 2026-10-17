'use client'

// 設定画面の各セクション（組織・支払方法・為替レート・メンバー）
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  EXPENSE_ROLES, PAYMENT_METHOD_LABEL, PAYMENT_METHOD_TYPES, ROLE_LABEL, WITHHOLDING_MODES, WITHHOLDING_MODE_LABEL,
  type ExpenseRole, type PaymentMethodType, type WithholdingMode,
} from '@/lib/expense/constants'
import { expenseApi, jsonInit, useExpenseQuery } from './api'
import type { PaymentMethod } from './types'
import { Btn, Card, ErrorBox, Field, Loading, currentYm, fmtMonthLabel, inputCls, tableCls, tbodyCls, tdCls, theadCls, thCls, trCls, TableWrap, useConfirm, useExpenseOrg } from './ui'

const H = ({ children }: { children: React.ReactNode }) => <h2 className="mb-4 text-[18px] font-bold text-[var(--ink)]">{children}</h2>
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)
const dayLabel = (d: number) => (d === 31 ? '月末' : `${d}日`)

// ---------- 組織 ----------
export function OrgSection() {
  const { orgSlug } = useExpenseOrg()
  const { data, error, forbidden, loading, reload } = useExpenseQuery<{ organization: { name: string; withholdingMode: WithholdingMode; slackWebhookUrl: string | null; hasSlack: boolean } }>('/api/expense/organization', orgSlug)
  const [name, setName] = useState('')
  const [mode, setMode] = useState<WithholdingMode>('monthly')
  const [slack, setSlack] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!data) return
    setName(data.organization.name)
    setMode(data.organization.withholdingMode)
    setSlack(data.organization.slackWebhookUrl ?? '')
  }, [data])

  const save = async () => {
    setBusy(true)
    try {
      await expenseApi('/api/expense/organization', orgSlug, jsonInit('PATCH', { name, withholdingMode: mode, slackWebhookUrl: slack.trim() || null }))
      toast.success('保存しました')
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <H>組織</H>
      {loading && !data ? <Loading rows={3} /> : error ? <ErrorBox forbidden={forbidden} onRetry={reload} /> : (
        <div className="max-w-xl space-y-4">
          <Field label="組織名"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="源泉所得税の納付方法" hint="納付の予定日が変わります。納期の特例を使っているかは、税理士にご確認ください。">
            <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as WithholdingMode)}>{WITHHOLDING_MODES.map((m) => <option key={m} value={m}>{WITHHOLDING_MODE_LABEL[m]}</option>)}</select>
          </Field>
          <Field label="Slack の通知先（Incoming Webhook URL）" hint="請求書待ちや支払期限を通知します。空にすると通知しません。">
            <input className={inputCls} value={slack} onChange={(e) => setSlack(e.target.value)} placeholder="https://hooks.slack.com/services/..." />
          </Field>
          <Btn onClick={save} busy={busy} disabled={!name.trim()}>保存する</Btn>
        </div>
      )}
    </Card>
  )
}

// ---------- 支払方法 ----------
interface PmDraft { id?: string; type: PaymentMethodType; label: string; closingDay: string; withdrawalMonths: string; withdrawalDay: string }
const pmEmpty = (): PmDraft => ({ type: 'card', label: '', closingDay: '15', withdrawalMonths: '1', withdrawalDay: '10' })

export function PaymentMethodsSection() {
  const { orgSlug } = useExpenseOrg()
  const { data, error, forbidden, loading, reload } = useExpenseQuery<{ paymentMethods: PaymentMethod[] }>('/api/expense/payment-methods', orgSlug)
  const [draft, setDraft] = useState<PmDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const { ask, dialog } = useConfirm()
  const set = <K extends keyof PmDraft>(k: K, v: PmDraft[K]) => setDraft((p) => (p ? { ...p, [k]: v } : p))

  const save = async () => {
    if (!draft) return
    setBusy(true)
    const body = { type: draft.type, label: draft.label, closingDay: Number(draft.closingDay), withdrawalMonths: Number(draft.withdrawalMonths), withdrawalDay: Number(draft.withdrawalDay) }
    try {
      await expenseApi(draft.id ? `/api/expense/payment-methods/${draft.id}` : '/api/expense/payment-methods', orgSlug, jsonInit(draft.id ? 'PATCH' : 'POST', body))
      toast.success('保存しました')
      setDraft(null)
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const remove = async (m: PaymentMethod) => {
    if (!(await ask(`支払方法「${m.label}」を削除します。この支払方法を使っている契約は、取引先の支払条件（振込）に戻ります。削除してよろしいですか？`, '削除する'))) return
    try {
      await expenseApi(`/api/expense/payment-methods/${m.id}`, orgSlug, jsonInit('DELETE'))
      toast.success('削除しました')
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  const detail = (m: PaymentMethod) =>
    m.type === 'card' ? `${dayLabel(m.closingDay ?? 31)}締め ${m.withdrawalMonths === 0 ? '当月' : `${m.withdrawalMonths}か月後`}${dayLabel(m.withdrawalDay ?? 31)}引落`
    : m.type === 'debit' ? `毎月${dayLabel(m.withdrawalDay ?? 31)}引落` : '取引先の締め日・支払日で計算'

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-[18px] font-bold text-[var(--ink)]">支払方法</h2>
        {!draft && <Btn variant="secondary" onClick={() => setDraft(pmEmpty())}>支払方法を追加</Btn>}
      </div>
      {draft && (
        <div className="mb-4 space-y-3 rounded-[var(--r-sm)] bg-[var(--bg)] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="種類">
              <select className={inputCls} value={draft.type} onChange={(e) => set('type', e.target.value as PaymentMethodType)}>{PAYMENT_METHOD_TYPES.map((t) => <option key={t} value={t}>{PAYMENT_METHOD_LABEL[t]}</option>)}</select>
            </Field>
            <Field label="名前"><input className={inputCls} value={draft.label} onChange={(e) => set('label', e.target.value)} placeholder="例: 法人カード" /></Field>
            {draft.type === 'card' && (
              <>
                <Field label="締め日"><select className={inputCls} value={draft.closingDay} onChange={(e) => set('closingDay', e.target.value)}>{DAYS.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}</select></Field>
                <Field label="引落月"><select className={inputCls} value={draft.withdrawalMonths} onChange={(e) => set('withdrawalMonths', e.target.value)}><option value="0">当月</option><option value="1">翌月</option><option value="2">翌々月</option></select></Field>
              </>
            )}
            {draft.type !== 'transfer' && (
              <Field label="引落日"><select className={inputCls} value={draft.withdrawalDay} onChange={(e) => set('withdrawalDay', e.target.value)}>{DAYS.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}</select></Field>
            )}
          </div>
          {draft.type === 'transfer' && <p className="text-[13px] text-[var(--sub)]">振込の出金日は取引先の締め日と支払日で計算するため、追加の設定は不要です。</p>}
          <div className="flex gap-2"><Btn onClick={save} busy={busy} disabled={!draft.label.trim()} variant="secondary">保存する</Btn><Btn variant="secondary" onClick={() => setDraft(null)}>キャンセル</Btn></div>
        </div>
      )}
      {loading && !data ? <Loading rows={2} /> : error ? <ErrorBox forbidden={forbidden} onRetry={reload} /> : !data || data.paymentMethods.length === 0 ? (
        <p className="py-4 text-[15px] text-[var(--sub)]">支払方法はまだ登録されていません。カードや口座振替で払う契約がある場合は、「支払方法を追加」から登録してください。</p>
      ) : (
        <ul className="divide-y divide-[var(--line)]">
          {data.paymentMethods.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1"><p className="text-[15px] font-bold text-[var(--ink)]">{m.label}（{PAYMENT_METHOD_LABEL[m.type]}）</p><p className="text-[13px] text-[var(--sub)]">{detail(m)}</p></div>
              <Btn size="sm" variant="secondary" onClick={() => setDraft({ id: m.id, type: m.type, label: m.label, closingDay: String(m.closingDay ?? 15), withdrawalMonths: String(m.withdrawalMonths ?? 1), withdrawalDay: String(m.withdrawalDay ?? 10) })}>編集</Btn>
              <Btn size="sm" variant="secondary" onClick={() => remove(m)}>削除</Btn>
            </li>
          ))}
        </ul>
      )}
      {dialog}
    </Card>
  )
}

// ---------- 為替レート ----------
export function FxSection() {
  const { orgSlug } = useExpenseOrg()
  const { data, error, forbidden, loading, reload } = useExpenseQuery<{ rates: { month: string; currency: string; rate: number }[] }>('/api/expense/fx-rates', orgSlug)
  const [month, setMonth] = useState(currentYm())
  const [rate, setRate] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try {
      await expenseApi('/api/expense/fx-rates', orgSlug, jsonInit('PUT', { month, currency: 'USD', rate: Number(rate) }))
      toast.success('為替レートを保存しました。ドル建ての予定を再計算しました')
      setRate('')
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <H>為替レート（USD）</H>
      <p className="mb-4 text-[13px] text-[var(--sub)]">ドル建ての契約を円に換算するレートです。その月のレートがない場合は、それより前の最新のレートを使います。</p>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="月" className="w-44"><input type="month" className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
        <Field label="1ドルあたりの円" className="w-44"><input type="number" min={0} step="0.01" className={inputCls} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="例: 150.25" /></Field>
        <Btn variant="secondary" onClick={save} busy={busy} disabled={!month || !rate}>登録・更新</Btn>
      </div>
      {loading && !data ? <Loading rows={2} /> : error ? <ErrorBox forbidden={forbidden} onRetry={reload} /> : !data || data.rates.length === 0 ? (
        <p className="text-[15px] text-[var(--sub)]">為替レートはまだ登録されていません。ドル建ての契約がある場合は、上の欄から登録してください。</p>
      ) : (
        <TableWrap>
          <table className={tableCls}>
            <thead className={theadCls}><tr><th className={thCls}>月</th><th className={`${thCls} text-right`}>1ドルあたり</th></tr></thead>
            <tbody className={tbodyCls}>
              {data.rates.map((r) => (
                <tr key={`${r.month}${r.currency}`} className={trCls}>
                  <td data-label="月" className={tdCls}>{fmtMonthLabel(r.month)}</td>
                  <td data-label="1ドルあたり" className={`${tdCls} md:text-right`}>{r.rate.toLocaleString('ja-JP')}円</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </Card>
  )
}

// ---------- メンバー ----------
interface Member { id: string; name: string; role: ExpenseRole; email: string | null; isMe: boolean }

export function MembersSection() {
  const { orgSlug, role: myRole } = useExpenseOrg()
  const { data, error, forbidden, loading, reload } = useExpenseQuery<{ members: Member[] }>('/api/expense/members', orgSlug)
  const [f, setF] = useState({ email: '', name: '', role: 'member' as ExpenseRole })
  const [busy, setBusy] = useState(false)
  const { ask, dialog } = useConfirm()
  const roles = EXPENSE_ROLES.filter((r) => r !== 'owner')

  const add = async () => {
    setBusy(true)
    try {
      await expenseApi('/api/expense/members', orgSlug, jsonInit('POST', f))
      toast.success('メンバーを追加しました')
      setF({ email: '', name: '', role: 'member' })
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const changeRole = async (m: Member, role: ExpenseRole) => {
    try {
      await expenseApi(`/api/expense/members/${m.id}`, orgSlug, jsonInit('PATCH', { role }))
      toast.success('権限を変更しました')
    } catch (e) {
      toast.error((e as Error).message)
    }
    reload()
  }
  const remove = async (m: Member) => {
    if (!(await ask(`${m.name}さんを組織から外します。よろしいですか？`, '外す'))) return
    try {
      await expenseApi(`/api/expense/members/${m.id}`, orgSlug, jsonInit('DELETE'))
      toast.success('外しました')
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  return (
    <Card>
      <H>メンバー</H>
      <p className="mb-4 text-[13px] text-[var(--sub)]">承認者は、契約の登録と支払状態の更新ができます。メンバーは閲覧のみです。追加できるのは、ドヤAIにログイン済みの方です。</p>
      <div className="mb-5 grid gap-3 rounded-[var(--r-sm)] bg-[var(--bg)] p-4 sm:grid-cols-4">
        <Field label="メールアドレス" className="sm:col-span-2"><input type="email" className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="氏名"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="権限"><select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as ExpenseRole })}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
        <div className="sm:col-span-4"><Btn variant="secondary" onClick={add} busy={busy} disabled={!f.email.trim() || !f.name.trim()}>メンバーを追加</Btn></div>
      </div>
      {loading && !data ? <Loading rows={3} /> : error ? <ErrorBox forbidden={forbidden} onRetry={reload} /> : (
        <ul className="divide-y divide-[var(--line)]">
          {(data?.members ?? []).map((m) => {
            const locked = (m.role === 'owner' || false) && myRole !== 'owner'
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1"><p className="text-[15px] font-bold text-[var(--ink)]">{m.name}{m.isMe && '（あなた）'}</p><p className="truncate text-[13px] text-[var(--sub)]">{m.email ?? ''}</p></div>
                <select aria-label={`${m.name}さんの権限`} className={`${inputCls} !w-40`} value={m.role} disabled={locked} onChange={(e) => changeRole(m, e.target.value as ExpenseRole)}>
                  {EXPENSE_ROLES.filter((r) => r !== 'owner' || myRole === 'owner' || m.role === 'owner').map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
                <Btn size="sm" variant="secondary" disabled={locked || m.isMe} onClick={() => remove(m)}>外す</Btn>
              </li>
            )
          })}
        </ul>
      )}
      {dialog}
    </Card>
  )
}
