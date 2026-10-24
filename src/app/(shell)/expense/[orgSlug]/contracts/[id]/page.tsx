'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import { BILLING_MODEL_LABEL, CATEGORY_LABEL, CONTRACT_STATUS_LABEL, FORECAST_MODE_LABEL, FREQUENCY_LABEL, type BillingModel, type ForecastMode } from '@/lib/expense/constants'
import { expenseApi, jsonInit, useBusyAction, useExpenseQuery } from '@/components/expense/api'
import type { Contract, Schedule } from '@/components/expense/types'
import ContractForm, { PriceFields, emptyPrice, priceToPayload, type PriceDraft } from '@/components/expense/ContractForm'
import {
  Badge, Btn, Card, ErrorBox, Loading, PageBody, PageHeader, StatusBadge, TableWrap, fmtDate, formatMoney, formatYen,
  tableCls, tbodyCls, tdCls, theadCls, thCls, trCls, todayYmd, useConfirm, useExpenseOrg,
} from '@/components/expense/ui'

export default function ContractDetailPage() {
  const { orgSlug, id } = useParams() as { orgSlug: string; id: string }
  const { canManage, canAdmin, base } = useExpenseOrg()
  const router = useRouter()
  const { data, error, forbidden, loading, reload } = useExpenseQuery<{ contract: Contract; schedules: Schedule[] }>(`/api/expense/contracts/${id}`, orgSlug)
  const [editing, setEditing] = useState(false)
  const [price, setPrice] = useState<PriceDraft | null>(null)
  // 金額の変更・削除は1つずつ。実行中はボタンを止め、二度押しで同じ処理が2回走らないようにする
  const { busy, run } = useBusyAction()
  const { ask, dialog } = useConfirm()

  if (loading && !data) return <PageBody><Loading /></PageBody>
  if (error || !data) return <PageBody><ErrorBox forbidden={forbidden} onRetry={reload} /></PageBody>
  const { contract: c, schedules } = data

  const addPrice = () => run('price', async () => {
    if (!price) return
    try {
      await expenseApi(`/api/expense/contracts/${id}/prices`, orgSlug, jsonInit('POST', priceToPayload(price, c.currency)))
      toast.success('金額の変更を登録しました')
      setPrice(null)
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  })
  const remove = async () => {
    if (busy) return
    if (!(await ask('未確定の支払予定も削除されます。請求書を受領した後の実績は残ります。', '削除する', { title: `契約「${c.title}」を削除しますか？` }))) return
    await run('delete', async () => {
      try {
        await expenseApi(`/api/expense/contracts/${id}`, orgSlug, jsonInit('DELETE'))
        toast.success('削除しました')
        router.replace(`${base}/contracts`)
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div><dt className="text-[13px] font-medium text-[var(--sub)]">{k}</dt><dd className="text-[15px] text-[var(--ink)]">{v || '-'}</dd></div>
  )

  return (
    <PageBody>
      <Link href={`${base}/contracts`} className="inline-flex min-h-[44px] items-center gap-1 text-[13px] font-medium text-[var(--sub)] hover:text-[var(--ink)]"><ArrowLeft className="h-4 w-4" />支出契約の一覧へ</Link>
      <PageHeader
        title={c.title}
        sub={<>{c.vendor.name} <Badge tone={c.status === 'active' ? 'green' : 'slate'}>{CONTRACT_STATUS_LABEL[c.status] ?? c.status}</Badge></>}
        actions={
          <>
            {canManage && !editing && <Btn variant="secondary" onClick={() => setEditing(true)} disabled={!!busy}>契約を編集する</Btn>}
            {canAdmin && <Btn variant="danger" onClick={remove} busy={busy === 'delete'} disabled={!!busy}>契約を削除する</Btn>}
          </>
        }
      />

      {editing ? (
        <ContractForm mode="edit" initial={c} onSaved={() => { setEditing(false); reload() }} />
      ) : (
        <Card>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            <Row k="カテゴリ" v={CATEGORY_LABEL[c.category] ?? c.category} />
            <Row k="契約の形" v={BILLING_MODEL_LABEL[c.billingModel as BillingModel] ?? c.billingModel} />
            <Row k="支払の周期" v={FREQUENCY_LABEL[c.frequencyMonths]} />
            <Row k="開始日" v={fmtDate(c.startDate)} />
            <Row k="終了日" v={c.endDate ? fmtDate(c.endDate) : '期限なし'} />
            <Row k="自動更新" v={c.autoRenew ? `あり（${c.renewalNoticeDays}日前に通知）` : 'なし'} />
            <Row k="支払方法" v={c.paymentMethod?.label ?? '取引先の支払条件（振込）'} />
            <Row k="源泉徴収" v={c.withholding ? '対象' : '対象外'} />
            {(c.billingModel === 'hourly' || c.billingModel === 'per_deliverable' || c.billingModel === 'variable') && <Row k="予定額の出し方" v={FORECAST_MODE_LABEL[c.forecastMode as ForecastMode]} />}
            <Row k="メモ" v={c.note} />
          </dl>
        </Card>
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[18px] font-bold text-[var(--ink)]">単価の履歴</h2>
          {canManage && !price && <Btn variant="secondary" onClick={() => setPrice(emptyPrice(todayYmd()))} disabled={!!busy}>金額を変更する（適用開始日つき）</Btn>}
        </div>
        {price && (
          <div className="mb-4 rounded-[var(--r-sm)] bg-[var(--bg)] p-4">
            <PriceFields value={price} onChange={setPrice} billingModel={c.billingModel} currency={c.currency} withDate />
            <p className="mt-2 text-[13px] text-[var(--sub)]">適用開始日以降の予定だけが、新しい金額になります。同じ日付で登録すると上書きされます。</p>
            <div className="mt-3 flex gap-2">
              <Btn variant={editing ? 'secondary' : 'primary'} onClick={addPrice} busy={busy === 'price'} disabled={price.unitPrice === '' || !!busy}>変更を登録する</Btn>
              <Btn variant="secondary" onClick={() => setPrice(null)} disabled={busy === 'price'}>キャンセル</Btn>
            </div>
          </div>
        )}
        <TableWrap>
          <table className={tableCls}>
            <thead className={theadCls}><tr>{['適用開始日', '単価', '数量', '上限', '税'].map((h, i) => <th key={h} className={`${thCls} ${i === 1 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
            <tbody className={tbodyCls}>
              {[...c.prices].reverse().map((p) => (
                <tr key={p.id} className={trCls}>
                  <td data-label="適用開始日" className={tdCls}>{fmtDate(p.effectiveFrom)}{p.id === c.currentPrice?.id && <Badge tone="green">現在</Badge>}</td>
                  <td data-label="単価" className={`${tdCls} md:text-right`}>{formatMoney(p.unitPrice, c.currency)}</td>
                  <td data-label="数量" className={tdCls}>{p.quantity}</td>
                  <td data-label="上限" className={tdCls}>{p.capQuantity ?? '-'}</td>
                  <td data-label="税" className={tdCls}>{p.taxRate}%（{p.taxIncluded ? '税込' : '税抜'}）</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Card>
        <h2 className="mb-4 text-[18px] font-bold text-[var(--ink)]">支払予定と実績</h2>
        {schedules.length === 0 ? <p className="py-6 text-center text-[15px] text-[var(--sub)]">支払の予定はまだありません。</p> : (
          <TableWrap>
            <table className={tableCls}>
              <thead className={theadCls}><tr>{['計上月', '支払日', '税抜', '源泉', '出金額', '状態'].map((h, i) => <th key={h} className={`${thCls} ${i >= 2 && i <= 4 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
              <tbody className={tbodyCls}>
                {schedules.map((s) => (
                  <tr key={s.id} className={`${trCls} ${s.status === 'skipped' ? 'opacity-50' : ''}`}>
                    <td data-label="計上月" className={tdCls}>{s.period.slice(0, 7).replace('-', '/')}</td>
                    <td data-label="支払日" className={tdCls}>{fmtDate(s.status === 'paid' && s.paidOn ? s.paidOn : s.plannedPayDate)}</td>
                    <td data-label="税抜" className={`${tdCls} md:text-right`}>{formatYen(s.amountExclTax)}{s.estimated && s.status === 'planned' && <Badge>見込み</Badge>}</td>
                    <td data-label="源泉" className={`${tdCls} md:text-right`}>{s.withholdingAmount ? formatYen(s.withholdingAmount) : '-'}</td>
                    <td data-label="出金額" className={`${tdCls} font-bold md:text-right`}>{formatYen(s.status === 'paid' && s.paidAmount != null ? s.paidAmount : s.netPayAmount)}</td>
                    <td data-label="状態" className={tdCls}><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
      {dialog}
    </PageBody>
  )
}
