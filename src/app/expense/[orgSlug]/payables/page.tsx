'use client'

import { Suspense, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import { CATEGORY_LABEL } from '@/lib/expense/constants'
import { expenseApi, jsonInit, useExpenseQuery } from '@/components/expense/api'
import type { Schedule } from '@/components/expense/types'
import OneOffModal from '@/components/expense/OneOffModal'
import {
  Badge, BigYen, Btn, Card, EmptyState, ErrorBox, Field, Loading, MonthSwitcher, PageBody, PageHeader, StatusBadge, TableWrap,
  currentYm, fmtDate, fmtMonthDay, formatYen, inputCls, isYm, tableCls, tbodyCls, tdCls, theadCls, thCls, todayYmd, trCls, useConfirm, useExpenseOrg,
} from '@/components/expense/ui'

type Mode = 'bill' | 'pay' | 'skip' | null

function RowForm({ s, mode, orgSlug, onDone, onCancel }: { s: Schedule; mode: Exclude<Mode, null>; orgSlug: string; onDone: () => void; onCancel: () => void }) {
  const [excl, setExcl] = useState(String(s.amountExclTax))
  const [tax, setTax] = useState(String(s.taxAmount))
  const [paidOn, setPaidOn] = useState(todayYmd())
  const [paidAmount, setPaidAmount] = useState(String(s.netPayAmount))
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const body: Record<string, unknown> =
      mode === 'bill' ? { status: 'billed', amountExclTax: Number(excl), taxAmount: Number(tax) }
      : mode === 'pay' ? { status: 'paid', paidOn, paidAmount: Number(paidAmount) }
      : { status: 'skipped', skipReason: reason }
    setBusy(true)
    try {
      await expenseApi(`/api/expense/schedules/${s.id}`, orgSlug, jsonInit('PATCH', body))
      toast.success('更新しました')
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-[var(--r-sm)] bg-[var(--bg)] p-3">
      {mode === 'bill' && (
        <>
          <Field label="請求の税抜金額（円）" className="w-44"><input type="number" min={0} className={inputCls} value={excl} onChange={(e) => setExcl(e.target.value)} /></Field>
          <Field label="消費税（円）" className="w-36"><input type="number" min={0} className={inputCls} value={tax} onChange={(e) => setTax(e.target.value)} /></Field>
          <p className="text-xs font-bold text-[var(--sub)]">源泉と出金額は自動で計算し直します。</p>
        </>
      )}
      {mode === 'pay' && (
        <>
          <Field label="支払日" className="w-44"><input type="date" className={inputCls} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></Field>
          <Field label="支払額（円）" className="w-44"><input type="number" min={0} className={inputCls} value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} /></Field>
        </>
      )}
      {mode === 'skip' && <Field label="発生しない理由" className="w-72"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例: 今月は稼働なし" /></Field>}
      <div className="flex gap-2">
        <Btn size="sm" variant="secondary" onClick={submit} busy={busy} disabled={mode === 'skip' && !reason.trim()}>{mode === 'bill' ? '請求書を受領にする' : mode === 'pay' ? '支払済みにする' : '発生なしにする'}</Btn>
        <Btn size="sm" variant="secondary" onClick={onCancel}>やめる</Btn>
      </div>
    </div>
  )
}

function PayablesInner() {
  const { orgSlug } = useParams() as { orgSlug: string }
  const { canManage } = useExpenseOrg()
  const router = useRouter()
  const sp = useSearchParams()
  const q = sp.get('month')
  const month = isYm(q) ? q : currentYm()
  const { data, error, forbidden, loading, reload } = useExpenseQuery<{ schedules: Schedule[]; totals: { all: number; paid: number; unpaid: number } }>(`/api/expense/schedules?month=${month}`, orgSlug)
  const [open, setOpen] = useState<{ id: string; mode: Mode } | null>(null)
  const [adding, setAdding] = useState(false)
  const { ask, dialog } = useConfirm()

  const quick = async (s: Schedule, body: Record<string, unknown>, done: string) => {
    try {
      await expenseApi(`/api/expense/schedules/${s.id}`, orgSlug, jsonInit('PATCH', body))
      toast.success(done)
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  const remove = async (s: Schedule) => {
    if (!(await ask(`「${s.title}」を削除します。よろしいですか？`, '削除する'))) return
    try {
      await expenseApi(`/api/expense/schedules/${s.id}`, orgSlug, jsonInit('DELETE'))
      toast.success('削除しました')
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const actions = (s: Schedule) => {
    const out: React.ReactNode[] = []
    const b = (key: string, label: string, onClick: () => void, variant: 'primary' | 'secondary' | 'danger' = 'secondary') => (
      <Btn key={key} size="sm" variant={variant} onClick={onClick}>{label}</Btn>
    )
    const openMode = (mode: Mode) => setOpen({ id: s.id, mode })
    const isTax = s.kind === 'withholding_tax'
    if (isTax) {
      if (s.status === 'planned') out.push(b('pay', '支払済みにする', () => openMode('pay')))
      if (s.status === 'paid') out.push(b('back', '予定に戻す', () => quick(s, { status: 'planned' }, '予定に戻しました')))
      return out
    }
    if (s.status === 'planned') {
      out.push(b('bill', '請求書を受領', () => openMode('bill')))
      out.push(b('pay', '支払済みにする', () => openMode('pay')))
      if (s.kind === 'contract') out.push(b('skip', '発生なし', () => openMode('skip')))
    }
    if (s.status === 'billed') {
      out.push(b('appr', '承認', () => quick(s, { status: 'approved' }, '承認しました')))
      out.push(b('pay', '支払済みにする', () => openMode('pay')))
      out.push(b('bill', '金額を直す', () => openMode('bill')))
    }
    if (s.status === 'approved') out.push(b('pay', '支払済みにする', () => openMode('pay')))
    if (s.status !== 'planned') out.push(b('back', '予定に戻す', () => quick(s, { status: 'planned' }, '予定に戻しました')))
    if (s.kind === 'one_time' && s.status !== 'paid') out.push(b('del', '削除', () => remove(s), 'danger'))
    return out
  }

  return (
    <PageBody>
      <PageHeader
        title="支払予定"
        sub="その月に口座から出る予定を、出金日の順に表示します。"
        actions={
          <>
            <MonthSwitcher value={month} onChange={(m) => router.replace(`?month=${m}`)} />
            {canManage && <Btn variant={open?.mode ? 'secondary' : 'primary'} onClick={() => setAdding(true)}><Plus className="h-4 w-4" />単発の支出を追加</Btn>}
          </>
        }
      />
      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card><p className="text-xs font-bold text-[var(--sub)]">出金合計</p><BigYen value={data.totals.all} /></Card>
          <Card><p className="text-xs font-bold text-[var(--sub)]">支払済</p><BigYen value={data.totals.paid} /></Card>
          <Card><p className="text-xs font-bold text-[var(--sub)]">これから払う</p><BigYen value={data.totals.unpaid} /></Card>
        </div>
      )}
      <Card>
        {loading && !data ? <Loading /> : error ? <ErrorBox forbidden={forbidden} onRetry={reload} /> : !data || data.schedules.length === 0 ? <EmptyState
            image="/expense/empty-payables.webp"
            alt="この月の支払予定は空です"
            text="この月の支払予定はまだありません。契約を登録すると、出金日と金額が自動で作成されます。"
            actionLabel={canManage ? '契約を登録する' : undefined}
            href={`/expense/${orgSlug}/contracts/new`}
          /> : (
          <TableWrap>
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr>
                  {['支払日', '内容', '取引先', 'カテゴリ', '税抜', '源泉', '出金額', '状態'].map((h, i) => <th key={h} className={`${thCls} ${i >= 4 && i <= 6 ? 'text-right' : ''}`}>{h}</th>)}
                  {canManage && <th className={thCls}>操作</th>}
                </tr>
              </thead>
              <tbody className={tbodyCls}>
                {data.schedules.map((s) => {
                  const isOpen = open?.id === s.id && open.mode
                  const out = s.status === 'paid' && s.paidAmount != null ? s.paidAmount : s.netPayAmount
                  return (
                    <FragmentRows key={s.id}>
                      <tr className={`${trCls} ${s.status === 'skipped' ? 'opacity-50' : ''}`}>
                        <td data-label="支払日" className={`${tdCls} whitespace-nowrap`}>{fmtMonthDay(s.status === 'paid' && s.paidOn ? s.paidOn : s.plannedPayDate)}</td>
                        <td data-label="内容" className={`${tdCls} md:min-w-[220px]`}>
                          {s.title} {s.estimated && s.status === 'planned' && <Badge tone="slate">見込み</Badge>}
                          {s.skipReason && <p className="text-xs font-bold text-[var(--muted)]">{s.skipReason}</p>}
                          {s.status === 'paid' && s.paidOn && <p className="text-xs font-bold text-[var(--muted)]">{fmtDate(s.paidOn)} 支払</p>}
                        </td>
                        <td data-label="取引先" className={`${tdCls} md:min-w-[160px]`}>{s.vendorName ?? '-'}</td>
                        <td data-label="カテゴリ" className={`${tdCls} whitespace-nowrap`}>{s.kind === 'withholding_tax' ? CATEGORY_LABEL.withholding_tax : CATEGORY_LABEL[s.category] ?? s.category}</td>
                        <td data-label="税抜" className={`${tdCls} whitespace-nowrap text-right`}>{s.kind === 'withholding_tax' ? '-' : formatYen(s.amountExclTax)}</td>
                        <td data-label="源泉" className={`${tdCls} whitespace-nowrap text-right`}>{s.withholdingAmount > 0 ? formatYen(s.withholdingAmount) : '-'}</td>
                        <td data-label="出金額" className={`${tdCls} whitespace-nowrap text-right font-bold`}>{formatYen(out)}</td>
                        <td data-label="状態" className={`${tdCls} whitespace-nowrap`}><StatusBadge status={s.status} /></td>
                        {canManage && <td data-label="操作" className="block pt-2 md:table-cell md:border-b md:border-[var(--line)] md:px-3 md:py-2.5"><div className="flex flex-wrap gap-2 [&>button]:flex-1 md:[&>button]:flex-none md:flex-nowrap md:gap-1">{actions(s)}</div></td>}
                      </tr>
                      {isOpen && open?.mode && (
                        <tr className="block md:table-row">
                          <td colSpan={canManage ? 9 : 8} className="block border-b border-[var(--line)] px-3 py-2 md:table-cell">
                            <RowForm s={s} mode={open.mode} orgSlug={orgSlug} onCancel={() => setOpen(null)} onDone={() => { setOpen(null); reload() }} />
                          </td>
                        </tr>
                      )}
                    </FragmentRows>
                  )
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
      {adding && <OneOffModal orgSlug={orgSlug} defaultDate={`${month}-${month === currentYm() ? todayYmd().slice(8) : '01'}`} onClose={() => setAdding(false)} onSaved={reload} />}
    {dialog}
    </PageBody>
  )
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export default function PayablesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PayablesInner />
    </Suspense>
  )
}
