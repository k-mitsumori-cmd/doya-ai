'use client'

// ドヤ収入管理 画面の共通部品
// 注意: lib/income のうちクライアントで使ってよいのは dates / schedule / tax だけ（他はサーバー専用の import を含む）
import { useEffect, type ReactNode } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, Plus, Trash2, X } from 'lucide-react'
import { MONTH_END, describePaymentTerms, weekdayJa } from '@/lib/income/dates'
import { TAX_RATES, computeInvoiceTotals } from '@/lib/income/tax'

export const ACCENT = '#0f9f6e'

// ---------- 表示ヘルパー ----------

export function yen(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return `${n < 0 ? '-' : ''}¥${Math.abs(n).toLocaleString('ja-JP')}`
}

/** @db.Date の ISO 文字列を 'YYYY-MM-DD' にする（タイムゾーン変換しない） */
export function ymd(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : ''
}

/** 'YYYY-MM-DD（月）' */
export function ymdW(iso: string | null | undefined): string {
  const s = ymd(iso)
  if (!s) return '—'
  try {
    return `${s}（${weekdayJa(s)}）`
  } catch {
    return s
  }
}

/** '2026-11' → '2026年11月' */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  return `${y}年${Number(m)}月`
}

/** 計上月（月初日）→ '2026年11月分' */
export function periodText(iso: string): string {
  return `${monthLabel(ymd(iso).slice(0, 7))}分`
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const idx = y * 12 + (m - 1) + delta
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`
}

/** 金額入力（カンマ・全角を許容）。空は NaN */
export function parseYenInput(s: string): number {
  const t = s.normalize('NFKC').replace(/[,\s]/g, '')
  if (t === '' || t === '-') return NaN
  return /^-?\d+$/.test(t) ? Number(t) : NaN
}

// ---------- ラベル ----------

export const CONTRACT_STATUS_LABEL: Record<string, string> = { draft: '下書き', active: '有効', paused: '停止中', ended: '終了', cancelled: '解約' }
export const CONTRACT_STATUS_ORDER = ['draft', 'active', 'paused', 'ended', 'cancelled'] as const
export const INVOICE_STATUS_LABEL: Record<string, string> = { draft: '下書き', confirmed: '確定', sent: '送付済み', void: '取消' }
export const SCHEDULE_STATUS_LABEL: Record<string, string> = { planned: '未請求', invoiced: '請求済み', skipped: '請求しない' }
export const BILLING_CYCLE_LABEL: Record<string, string> = { monthly: '毎月', quarterly: '四半期ごと', yearly: '毎年' }
export const ISSUE_TIMING_LABEL: Record<string, string> = { arrears: '後払い（当月末に請求）', advance: '前払い（前月末に請求）' }
export const PRORATE_LABEL: Record<string, string> = { none: '初月から満額', daily: '日割り' }
export const CONTRACT_TYPE_LABEL: Record<string, string> = { recurring: '継続（定期請求）', one_time: '単発' }
export const PAYMENT_STATUS_LABEL: Record<string, string> = { unmatched: '未消込', partial: '一部消込', matched: '消込済み' }
export const ACCOUNT_TYPE_LABEL: Record<string, string> = { ordinary: '普通', checking: '当座' }

// ---------- 通信 ----------

export async function fetchJson<T = any>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const hasBody = init.body !== undefined
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })
  let data: any = null
  try {
    data = await res.json()
  } catch {
    // JSON でない応答
  }
  if (!res.ok) throw new Error(data?.error || `エラーが発生しました（${res.status}）`)
  return data as T
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : '通信に失敗しました'
}

// ---------- スタイル ----------

export const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-[#0f9f6e] focus:outline-none focus:ring-2 focus:ring-[#0f9f6e]/30 disabled:bg-slate-50 disabled:text-slate-500'
export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0f9f6e] px-4 py-2 text-sm font-black text-white transition-colors hover:bg-[#0b7f58] disabled:cursor-not-allowed disabled:opacity-50'
export const btnSecondary =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
export const btnDanger =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-black text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50'
export const btnSmall = 'px-3 py-1.5 text-xs'

// ---------- 小さな部品 ----------

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">{children}</div>
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-black text-slate-900 sm:text-2xl">{title}</h1>
        {sub && <p className="mt-1 text-xs font-bold text-slate-500">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ title, children, className = '', right }: { title?: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-sm font-black text-slate-900">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

export function ErrorText({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return (
    <p role="alert" className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 break-words">{message}</span>
    </p>
  )
}

export function Loading({ label = '読み込み中です' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm font-bold text-slate-500">{children}</div>
}

export function Spinner() {
  return <Loader2 className="h-4 w-4 animate-spin" />
}

export function Field({ label, children, hint, className = '' }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-black text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] font-bold text-slate-400">{hint}</span>}
    </label>
  )
}

export function StatTile({ label, value, sub, tone = 'default' }: { label: string; value: string; sub?: string; tone?: 'default' | 'red' | 'green' }) {
  const color = tone === 'red' ? 'text-red-600' : tone === 'green' ? 'text-[#0f9f6e]' : 'text-slate-900'
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-black text-slate-500">{label}</p>
      <p className={`mt-0.5 break-words text-xl font-black tabular-nums sm:text-2xl ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] font-bold text-slate-500">{sub}</p>}
    </div>
  )
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="no-print fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-black text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="閉じる" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ---------- バッジ ----------

const BADGE = 'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-black'

export function ContractStatusBadge({ status }: { status: string }) {
  const cls =
    status === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'draft' ? 'border-amber-200 bg-amber-50 text-amber-700'
        : status === 'paused' ? 'border-slate-200 bg-slate-100 text-slate-600'
          : 'border-slate-200 bg-slate-50 text-slate-500'
  return <span className={`${BADGE} ${cls}`}>{CONTRACT_STATUS_LABEL[status] ?? status}</span>
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  const cls =
    status === 'draft' ? 'border-amber-200 bg-amber-50 text-amber-700'
      : status === 'confirmed' ? 'border-sky-200 bg-sky-50 text-sky-700'
        : status === 'sent' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-100 text-slate-500'
  return <span className={`${BADGE} ${cls}`}>{INVOICE_STATUS_LABEL[status] ?? status}</span>
}

/** API の state.label（未入金/一部入金/入金済み/入金遅延）。取消・下書きは null */
export function PaymentStateBadge({ label }: { label: string | null | undefined }) {
  if (!label) return <span className="text-xs text-slate-300">—</span>
  const cls =
    label === '入金遅延' ? 'border-red-200 bg-red-50 text-red-700'
      : label === '入金済み' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : label === '一部入金' ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-slate-50 text-slate-600'
  return <span className={`${BADGE} ${cls}`}>{label}</span>
}

export function ScheduleStatusBadge({ status }: { status: string }) {
  const cls =
    status === 'invoiced' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'skipped' ? 'border-slate-200 bg-slate-100 text-slate-500'
        : 'border-amber-200 bg-amber-50 text-amber-700'
  return <span className={`${BADGE} ${cls}`}>{SCHEDULE_STATUS_LABEL[status] ?? status}</span>
}

// ---------- 支払条件の選択 ----------

export type Terms = { closingDay: number | null; paymentMonths: number | null; paymentDay: number | null }

const DAY_OPTIONS = [5, 10, 15, 20, 25, MONTH_END]
const dayLabel = (d: number) => (d >= MONTH_END ? '月末' : `${d}日`)

export function PaymentTermsFields({ value, onChange, allowDefault }: { value: Terms; onChange: (t: Terms) => void; allowDefault: boolean }) {
  const isDefault = allowDefault && value.closingDay === null
  const set = (patch: Partial<Terms>) => onChange({ ...value, ...patch })
  const closing = value.closingDay ?? MONTH_END
  const months = value.paymentMonths ?? 1
  const payDay = value.paymentDay ?? MONTH_END
  // 既存値が選択肢にないとき（例: 末日以外の 7 日）も表示できるように足す
  const withCurrent = (v: number) => (DAY_OPTIONS.includes(v) ? DAY_OPTIONS : [...DAY_OPTIONS, v].sort((a, b) => a - b))
  return (
    <div className="space-y-2">
      {allowDefault && (
        <select
          className={inputCls}
          value={isDefault ? 'default' : 'custom'}
          onChange={(e) => onChange(e.target.value === 'default' ? { closingDay: null, paymentMonths: null, paymentDay: null } : { closingDay: MONTH_END, paymentMonths: 1, paymentDay: MONTH_END })}
        >
          <option value="default">設定の既定を使う</option>
          <option value="custom">この取引先だけ個別に指定する</option>
        </select>
      )}
      {!isDefault && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Field label="締め日">
              <select className={inputCls} value={closing} onChange={(e) => set({ closingDay: Number(e.target.value), paymentMonths: months, paymentDay: payDay })}>
                {withCurrent(closing).map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
              </select>
            </Field>
            <Field label="支払月">
              <select className={inputCls} value={months} onChange={(e) => set({ closingDay: closing, paymentMonths: Number(e.target.value), paymentDay: payDay })}>
                <option value={0}>当月</option>
                <option value={1}>翌月</option>
                <option value={2}>翌々月</option>
              </select>
            </Field>
            <Field label="支払日">
              <select className={inputCls} value={payDay} onChange={(e) => set({ closingDay: closing, paymentMonths: months, paymentDay: Number(e.target.value) })}>
                {withCurrent(payDay).map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
              </select>
            </Field>
          </div>
          <p className="text-[11px] font-bold text-slate-500">{describePaymentTerms({ closingDay: closing, paymentMonths: months, paymentDay: payDay })}</p>
        </>
      )}
    </div>
  )
}

// ---------- 明細エディタ ----------

export type LineRow = { name: string; quantity: string; unitPrice: string; taxRate: number; scheduleId?: string | null }

export const emptyLine = (taxRate = 10): LineRow => ({ name: '', quantity: '1', unitPrice: '', taxRate })

export function linesToPayload(rows: LineRow[]) {
  return rows.map((r) => ({
    name: r.name.trim(),
    quantity: Number(r.quantity.normalize('NFKC').replace(/,/g, '')),
    unitPrice: parseYenInput(r.unitPrice),
    taxRate: r.taxRate,
    ...(r.scheduleId ? { scheduleId: r.scheduleId } : {}),
  }))
}

/** 計算できないとき null（エラー文は返さない。サーバーが最終的に検証する） */
export function safeTotals(rows: LineRow[]) {
  try {
    const p = linesToPayload(rows)
    if (p.some((l) => Number.isNaN(l.quantity) || Number.isNaN(l.unitPrice))) return null
    return computeInvoiceTotals(p)
  } catch {
    return null
  }
}

export function LineItemsEditor({
  rows, onChange, disabled, hint, namePlaceholder = '例: 月額利用料',
}: { rows: LineRow[]; onChange: (rows: LineRow[]) => void; disabled?: boolean; hint?: string; namePlaceholder?: string }) {
  const update = (i: number, patch: Partial<LineRow>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const totals = safeTotals(rows)
  let totalError: string | null = null
  if (!totals) {
    try {
      const p = linesToPayload(rows)
      if (!p.some((l) => Number.isNaN(l.quantity) || Number.isNaN(l.unitPrice))) computeInvoiceTotals(p)
    } catch (e) {
      totalError = errMsg(e)
    }
  }
  return (
    <div>
      {hint && <p className="mb-2 text-[11px] font-bold text-slate-500">{hint}</p>}
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="grid grid-cols-6 gap-2">
              <Field label="品目" className="col-span-6 sm:col-span-3">
                <input className={inputCls} value={r.name} disabled={disabled} maxLength={120} placeholder={namePlaceholder} onChange={(e) => update(i, { name: e.target.value })} />
              </Field>
              <Field label="数量" className="col-span-2 sm:col-span-1">
                <input className={inputCls} inputMode="numeric" value={r.quantity} disabled={disabled} onChange={(e) => update(i, { quantity: e.target.value })} />
              </Field>
              <Field label="単価（円）" className="col-span-4 sm:col-span-2">
                <input className={inputCls} inputMode="text" value={r.unitPrice} disabled={disabled} placeholder="100000" onChange={(e) => update(i, { unitPrice: e.target.value })} />
              </Field>
              <Field label="税率" className="col-span-3 sm:col-span-2">
                <select className={inputCls} value={r.taxRate} disabled={disabled} onChange={(e) => update(i, { taxRate: Number(e.target.value) })}>
                  {TAX_RATES.map((t) => <option key={t} value={t}>{t}%</option>)}
                </select>
              </Field>
              <div className="col-span-3 flex items-end justify-between gap-2 sm:col-span-4">
                <p className="pb-2 text-xs font-bold text-slate-500">
                  金額 <span className="tabular-nums text-slate-800">{totals ? yen(totals.lineAmounts[i]) : '—'}</span>
                </p>
                {rows.length > 1 && !disabled && (
                  <button type="button" onClick={() => onChange(rows.filter((_, idx) => idx !== i))} className="mb-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-black text-red-600 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                    削除
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {!disabled && (
        <button type="button" onClick={() => onChange([...rows, emptyLine(rows[rows.length - 1]?.taxRate ?? 10)])} className={`${btnSecondary} ${btnSmall} mt-2`}>
          <Plus className="h-3.5 w-3.5" />
          行を追加
        </button>
      )}
      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
        {totals ? (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 tabular-nums">
            <dt>小計（税抜）</dt><dd className="text-right">{yen(totals.subtotalExclTax)}</dd>
            <dt>消費税</dt><dd className="text-right">{yen(totals.taxAmount)}</dd>
            <dt className="text-slate-900">合計（税込）</dt><dd className="text-right text-slate-900">{yen(totals.totalInclTax)}</dd>
          </dl>
        ) : (
          <span className={totalError ? 'text-red-600' : 'text-slate-400'}>{totalError ?? '数量と単価を入力すると合計が出ます'}</span>
        )}
      </div>
    </div>
  )
}

// ---------- 月の切替 ----------

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
      <button type="button" aria-label="前の月" onClick={() => onChange(shiftMonth(month, -1))} className="rounded-lg px-2.5 py-1.5 text-sm font-black text-slate-600 hover:bg-slate-100">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[6.5rem] text-center text-sm font-black text-slate-900">{monthLabel(month)}</span>
      <button type="button" aria-label="次の月" onClick={() => onChange(shiftMonth(month, 1))} className="rounded-lg px-2.5 py-1.5 text-sm font-black text-slate-600 hover:bg-slate-100">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
