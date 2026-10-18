'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import { BILLING_MODEL_LABEL, CONTRACT_STATUS_LABEL, FREQUENCY_LABEL, type BillingModel } from '@/lib/expense/constants'
import { expenseApi, jsonInit, useExpenseQuery } from '@/components/expense/api'
import type { Contract, Schedule, Vendor } from '@/components/expense/types'
import VendorFields, { draftToPayload, vendorToDraft, type VendorDraft } from '@/components/expense/VendorForm'
import {
  Badge, Btn, Card, EmptyState, ErrorBox, Loading, PageBody, PageHeader, StatusBadge, TableWrap,
  fmtDate, formatYen, priceSummary, tableCls, tbodyCls, tdCls, theadCls, thCls, trCls, useExpenseOrg,
} from '@/components/expense/ui'

interface Detail {
  vendor: Vendor
  contracts: Contract[]
  schedules: Schedule[]
  yearToDate: { year: string; amountExclTax: number; withholding: number; paid: number }
}

function Dl({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[13px] font-medium text-[var(--sub)]">{k}</dt>
          <dd className="text-[15px] text-[var(--ink)]">{v || '-'}</dd>
        </div>
      ))}
    </dl>
  )
}
const dayText = (d: number) => (d === 31 ? '月末' : `${d}日`)
const monthsText = (n: number) => (['当月', '翌月', '翌々月', '3か月後'][n] ?? `${n}か月後`)

export default function ContractorDetailPage() {
  const { orgSlug, vendorId } = useParams() as { orgSlug: string; vendorId: string }
  const { canManage, base } = useExpenseOrg()
  const { data, error, forbidden, loading, reload } = useExpenseQuery<Detail>(`/api/expense/vendors/${vendorId}`, orgSlug)
  const [draft, setDraft] = useState<VendorDraft | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading && !data) return <PageBody><Loading /></PageBody>
  if (error || !data) return <PageBody><ErrorBox forbidden={forbidden} onRetry={reload} /></PageBody>
  const { vendor: v, contracts, schedules, yearToDate: y } = data

  const save = async () => {
    if (!draft) return
    setBusy(true)
    try {
      await expenseApi(`/api/expense/vendors/${v.id}`, orgSlug, jsonInit('PATCH', draftToPayload(draft, true)))
      toast.success('保存しました')
      setDraft(null)
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageBody>
      <Link href={`${base}/contractors`} className="inline-flex min-h-[44px] items-center gap-1 text-[13px] font-medium text-[var(--sub)] hover:text-[var(--ink)]"><ArrowLeft className="h-4 w-4" />業務委託の一覧へ</Link>
      <PageHeader title={`${v.name}さん`} sub={v.role ?? undefined} actions={canManage && !draft ? <Btn variant="secondary" onClick={() => setDraft(vendorToDraft(v))}>取引先情報を編集</Btn> : undefined} />

      {draft ? (
        <Card>
          <h2 className="mb-4 text-[18px] font-bold text-[var(--ink)]">取引先情報の編集</h2>
          <VendorFields value={draft} onChange={setDraft} showBank={canManage} />
          <p className="mt-3 text-[13px] text-[var(--sub)]">締め日や支払日を変更すると、この方の契約の出金日を再計算します。</p>
          <div className="mt-4 flex gap-2">
            <Btn onClick={save} busy={busy} disabled={!draft.name.trim()}>保存する</Btn>
            <Btn variant="secondary" onClick={() => setDraft(null)}>キャンセル</Btn>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <h2 className="mb-4 text-[18px] font-bold text-[var(--ink)]">取引先情報</h2>
            <Dl rows={[
              ['担当業務', v.role],
              ['インボイス登録番号', v.invoiceRegNo],
              ['源泉徴収の既定', v.withholdingDefault ? '対象にする' : '対象にしない'],
              ['支払条件', `${dayText(v.closingDay)}締め ${monthsText(v.paymentMonths)}${dayText(v.paymentDay)}払い`],
              ['メモ', v.note],
            ]} />
          </Card>
          {v.bank && (
            <Card>
              <h2 className="mb-4 text-[18px] font-bold text-[var(--ink)]">振込先</h2>
              {v.hasBank ? (
                <Dl rows={[
                  ['銀行・支店', [v.bank.bankName, v.bank.bankBranch].filter(Boolean).join(' ')],
                  ['口座', [v.bank.bankAccountType, v.bank.bankAccountNo].filter(Boolean).join(' ')],
                  ['口座名義', v.bank.bankAccountHolder],
                ]} />
              ) : <p className="text-[15px] text-[var(--sub)]">振込先はまだ登録されていません。「取引先情報を編集」から登録できます。</p>}
            </Card>
          )}
        </>
      )}

      <Card>
        <h2 className="mb-1 text-[18px] font-bold text-[var(--ink)]">{y.year}年の源泉の累計</h2>
        <p className="mb-4 text-[13px] text-[var(--sub)]">支払済みの分だけを集計しています。</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {[['支払った報酬（税抜）', y.amountExclTax], ['源泉徴収した額', y.withholding], ['実際に振り込んだ額', y.paid]].map(([k, n]) => (
            <div key={k as string}><p className="text-[13px] font-medium text-[var(--sub)]">{k}</p><p className="text-[24px] font-bold tabular-nums text-[var(--ink)]">{formatYen(n as number)}</p></div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-[18px] font-bold text-[var(--ink)]">契約</h2>
        {contracts.length === 0 ? (
          <EmptyState image="/expense/empty-contracts.webp" alt="契約はまだありません" text="この方との契約はまだ登録されていません。" actionLabel={canManage ? '契約を登録する' : undefined} href={`${base}/contracts/new?preset=contractor`} />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {contracts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <Link href={`${base}/contracts/${c.id}`} className="font-bold text-[var(--blue)] hover:underline">{c.title}</Link>
                <span className="text-[13px] text-[var(--sub)]">{BILLING_MODEL_LABEL[c.billingModel as BillingModel] ?? c.billingModel} / {FREQUENCY_LABEL[c.frequencyMonths]}</span>
                <span className="tabular-nums text-[15px]">{priceSummary(c)}</span>
                <Badge tone={c.status === 'active' ? 'green' : 'slate'}>{CONTRACT_STATUS_LABEL[c.status] ?? c.status}</Badge>
                <span className="text-[13px] text-[var(--sub)]">{c.autoRenew ? '自動更新' : c.endDate ? `${fmtDate(c.endDate)} まで` : '期限なし'}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-[18px] font-bold text-[var(--ink)]">支払の履歴と予定</h2>
        {schedules.length === 0 ? <p className="py-6 text-center text-[15px] text-[var(--sub)]">支払の予定はまだありません。契約を登録すると、自動で作成されます。</p> : (
          <TableWrap>
            <table className={tableCls}>
              <thead className={theadCls}><tr>{['計上月', '支払日', '内容', '税抜', '源泉', '出金額', '状態'].map((h, i) => <th key={h} className={`${thCls} ${i >= 3 && i <= 5 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
              <tbody className={tbodyCls}>
                {schedules.map((s) => (
                  <tr key={s.id} className={`${trCls} ${s.status === 'skipped' ? 'opacity-50' : ''}`}>
                    <td data-label="計上月" className={tdCls}>{s.period.slice(0, 7).replace('-', '/')}</td>
                    <td data-label="支払日" className={tdCls}>{fmtDate(s.status === 'paid' && s.paidOn ? s.paidOn : s.plannedPayDate)}</td>
                    <td data-label="内容" className={tdCls}>{s.title}{s.estimated && s.status === 'planned' && <Badge>見込み</Badge>}</td>
                    <td data-label="税抜" className={`${tdCls} md:text-right`}>{formatYen(s.amountExclTax)}</td>
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
    </PageBody>
  )
}
