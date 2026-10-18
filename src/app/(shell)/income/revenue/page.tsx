'use client'

// 月次売上: その月に請求すべき一覧。チェックして請求書を下書きでまとめて作る
import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { todayJst } from '@/lib/income/dates'
import {
  Button, Card, ConfirmDialog, EmptyState, ErrorText, Field, Gate, ListSkeleton, MonthSwitcher, PageHeader, PageShell, ScheduleStatusBadge, Skeleton,
  errMsg, fetchJson, inputCls, s, toast, useResource, ymd, ymdW, yen,
} from '@/components/income/ui'

type Sched = {
  id: string; period: string; plannedIssueDate: string; amountExclTax: number; status: string; skipReason: string | null
  client: { id: string; name: string }
  contract: { id: string; title: string; items: { taxRate: number }[] }
  invoiceItem: { invoice: { id: string; invoiceNo: string | null; status: string } } | null
}
type Data = { today: string; schedules: Sched[] }

function TableSkeleton() {
  return (
    <div className={s.card} style={{ display: 'grid', gap: 12 }} role="status" aria-label="読み込み中です">
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={44} />)}
    </div>
  )
}

function Inner() {
  const router = useRouter()
  const sp = useSearchParams()
  const initial = sp.get('month')
  const [month, setMonth] = useState(initial && /^\d{4}-(0[1-9]|1[0-2])$/.test(initial) ? initial : todayJst().slice(0, 7))
  const res = useResource(() => fetchJson<Data>(`/api/income/revenue?month=${month}`), month)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [issueDate, setIssueDate] = useState(todayJst())
  const [creating, setCreating] = useState(false)
  const [skipTarget, setSkipTarget] = useState<Sched | null>(null)
  const [reason, setReason] = useState('')
  const [skipBusy, setSkipBusy] = useState(false)
  const [skipError, setSkipError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => { setSelected(new Set()) }, [res.data])

  const changeMonth = (m: string) => {
    setMonth(m)
    router.replace(`/income/revenue?month=${m}`)
  }

  const data = res.data
  const rows = useMemo(() => data?.schedules ?? [], [data])
  const planned = rows.filter((r) => r.status === 'planned')
  const isLeak = (r: Sched) => r.status === 'planned' && !!data && ymd(r.plannedIssueDate) <= data.today
  const total = useMemo(() => rows.filter((r) => r.status !== 'skipped').reduce((a, r) => a + r.amountExclTax, 0), [rows])
  const selectedTotal = useMemo(() => rows.filter((r) => selected.has(r.id)).reduce((a, r) => a + r.amountExclTax, 0), [rows, selected])
  const toggle = (id: string) => setSelected((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allSelected = planned.length > 0 && planned.every((r) => selected.has(r.id))
  const issueDateError = !issueDate ? '請求日を入力してください' : undefined

  const create = async () => {
    setCreating(true)
    setError(null)
    try {
      const d = await fetchJson<{ invoiceIds: string[] }>('/api/income/invoices/bulk-create', { method: 'POST', body: { scheduleIds: Array.from(selected), issueDate } })
      toast(`請求書の下書きを${d.invoiceIds.length}件作成しました`)
      router.push(d.invoiceIds.length === 1 ? `/income/invoices/${d.invoiceIds[0]}` : '/income/invoices')
    } catch (e) {
      setError(errMsg(e))
      setCreating(false)
    }
  }

  const openSkip = (r: Sched) => { setReason(''); setSkipError(null); setSkipTarget(r) }
  const doSkip = async () => {
    if (!skipTarget) return
    setSkipBusy(true)
    setSkipError(null)
    try {
      await fetchJson(`/api/income/revenue/${skipTarget.id}`, { method: 'PATCH', body: { skip: true, reason: reason.trim() } })
      setSkipTarget(null)
      toast('請求しない月にしました')
      await res.reload()
    } catch (e) {
      setSkipError(errMsg(e))
    } finally {
      setSkipBusy(false)
    }
  }
  const restore = async (r: Sched) => {
    setBusyId(r.id)
    setError(null)
    try {
      await fetchJson(`/api/income/revenue/${r.id}`, { method: 'PATCH', body: { skip: false } })
      toast('未請求に戻しました')
      await res.reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PageShell>
      <PageHeader
        crumbs={[{ label: '収入管理', href: '/income' }, { label: '月次売上' }]}
        title="月次売上"
        sub="その月に計上する売上予定です。請求予定日を過ぎた未請求は請求漏れとして赤く表示します"
        actions={<MonthSwitcher month={month} onChange={changeMonth} />}
      />
      <ErrorText message={error} />
      <Gate res={res} skeleton={<TableSkeleton />}>
        {(d) =>
          d.schedules.length === 0 ? (
            <EmptyState
              image="/income/empty-revenue.webp"
              message="この月の売上予定はありません。有効な契約を登録すると、月ごとに自動で作られます。"
              action={{ label: '契約を確認する', href: '/income/contracts' }}
            />
          ) : (
            <div className={s.stackY} style={{ marginTop: error ? 16 : 0 }}>
              <Card flush>
                <div className={s.tableWrap}>
                  <table className={`${s.table} ${s.tableWide}`}>
                    <thead>
                      <tr>
                        <th style={{ width: 48 }}>
                          <input type="checkbox" aria-label="未請求をすべて選ぶ" className={s.check} checked={allSelected} disabled={planned.length === 0}
                            onChange={() => setSelected(allSelected ? new Set() : new Set(planned.map((r) => r.id)))} />
                        </th>
                        <th>取引先 / 契約</th><th>請求予定日</th><th className={s.r}>金額（税抜）</th><th>状態</th><th className={s.r}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.schedules.map((r) => {
                        const leak = isLeak(r)
                        return (
                          <tr key={r.id} className={`${leak ? s.rowBad : ''} ${r.status === 'skipped' ? s.rowDim : ''}`.trim()}>
                            <td data-label={r.status === 'planned' ? '選ぶ' : ''}>
                              {r.status === 'planned' && <input type="checkbox" aria-label={`${r.client.name}を選ぶ`} className={s.check} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />}
                            </td>
                            <td data-label="取引先 / 契約">
                              <span>
                                <Link href={`/income/clients/${r.client.id}`} className={s.strong} style={{ display: 'block' }}>{r.client.name}</Link>
                                <Link href={`/income/contracts/${r.contract.id}`} className={s.sub} style={{ display: 'block' }}>{r.contract.title}</Link>
                              </span>
                            </td>
                            <td data-label="請求予定日" className={leak ? s.badText : ''}>
                              <span>
                                {ymdW(r.plannedIssueDate)}
                                {leak && <span className={`${s.badge} ${s.bBad}`} style={{ marginLeft: 4 }}>請求漏れ</span>}
                              </span>
                            </td>
                            <td data-label="金額（税抜）" className={s.r} style={{ whiteSpace: 'nowrap' }}>{yen(r.amountExclTax)}</td>
                            <td data-label="状態">
                              <span>
                                <ScheduleStatusBadge status={r.status} />
                                {r.skipReason && <span className={s.sub} style={{ display: 'block' }}>{r.skipReason}</span>}
                                {r.invoiceItem && (
                                  <Link href={`/income/invoices/${r.invoiceItem.invoice.id}`} className={s.link} style={{ display: 'block' }}>{r.invoiceItem.invoice.invoiceNo ?? '下書きを開く'}</Link>
                                )}
                              </span>
                            </td>
                            <td data-label="" className={s.r}>
                              {r.status === 'planned' && <Button size="sm" onClick={() => openSkip(r)}>請求しない</Button>}
                              {r.status === 'skipped' && <Button size="sm" loading={busyId === r.id} onClick={() => restore(r)}>戻す</Button>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3}>合計（請求しないを除く）{d.schedules.length} 件</td>
                        <td className={s.r} style={{ whiteSpace: 'nowrap' }}>{yen(total)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>

              {creating ? (
                <Card>
                  <div className={s.done} role="status">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/income/working.webp" alt="" width={96} height={96} className={s.doneImg} />
                    <div>
                      <p className={s.strong} style={{ margin: 0 }}>請求書の下書きを作っています</p>
                      <p className={s.sub} style={{ margin: '4px 0 0' }}>{selected.size} 件の売上予定を、取引先ごとにまとめています。完了すると請求書の画面に移ります。</p>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card>
                  <div className="flex flex-wrap items-end gap-4">
                    <Field label="請求日" error={issueDateError} className="w-full sm:w-auto">
                      <input type="date" className={inputCls} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                    </Field>
                    <Button variant="primary" onClick={create} disabled={selected.size === 0 || !issueDate}>選んだ売上の請求書を作成</Button>
                  </div>
                  <p className={s.sub} style={{ margin: '12px 0 0' }}>選択中 {selected.size} 件 / <span className={s.num}>{yen(selectedTotal)}</span>（税抜）。取引先ごとに1枚の下書きを作ります。</p>
                </Card>
              )}
            </div>
          )
        }
      </Gate>

      {skipTarget && (
        <ConfirmDialog
          title="請求しない理由を入力"
          message={`${skipTarget.client.name} の「${skipTarget.contract.title}」を、この月は請求しないことにします。あとで「戻す」から未請求に戻せます。`}
          confirmLabel="請求しない月にする"
          busy={skipBusy}
          error={skipError}
          confirmDisabled={!reason.trim()}
          onConfirm={doSkip}
          onClose={() => setSkipTarget(null)}
        >
          <Field label="理由（必須）" error={reason.length > 0 && !reason.trim() ? '理由を入力してください' : undefined}>
            <textarea className={inputCls} rows={3} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </ConfirmDialog>
      )}
    </PageShell>
  )
}

export default function RevenuePage() {
  return (
    <Suspense fallback={<PageShell><ListSkeleton /></PageShell>}>
      <Inner />
    </Suspense>
  )
}
