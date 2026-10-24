'use client'

// ドヤ収入管理 画面の共通部品（見た目の土台は ds.tsx / ds.module.css）
// 注意: lib/income のうちクライアントで使ってよいのは dates / schedule / tax / roles だけ（他はサーバー専用の import を含む）
import {
  Children, cloneElement, isValidElement, useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode,
} from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import { MONTH_END, describePaymentTerms, weekdayJa } from '@/lib/income/dates'
import { TAX_RATES, computeInvoiceTotals } from '@/lib/income/tax'
import { hasMinRole, type IncomeRole } from '@/lib/income/roles'
import { Button, EmptyState, FORBIDDEN_MESSAGE, s } from './ds'

export {
  Button, Card, DetailSkeleton, EmptyState, ListSkeleton, PageHeader, PageShell, Skeleton, StatTile, StatsSkeleton, buttonClass, toast, useToast,
} from './ds'
export { s }

// ---------- 表示ヘルパー ----------

export function yen(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return `${n < 0 ? '-' : ''}¥${Math.abs(n).toLocaleString('ja-JP')}`
}

/** 桁区切りの数字だけ（StatTile 用。単位は別に渡す） */
export function num(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('ja-JP')
}

/** @db.Date の ISO 文字列を 'YYYY-MM-DD' にする（タイムゾーン変換しない） */
export function ymd(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : ''
}

/** 'YYYY-MM-DD（月）' */
export function ymdW(iso: string | null | undefined): string {
  const v = ymd(iso)
  if (!v) return '—'
  try {
    return `${v}（${weekdayJa(v)}）`
  } catch {
    return v
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
export function parseYenInput(v: string): number {
  const t = v.normalize('NFKC').replace(/[,\s]/g, '')
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

/** status は 401 / 403 / 404 の出し分けに使う。画面には出さない */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export async function fetchJson<T = any>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const hasBody = init.body !== undefined
  let res: Response
  try {
    res = await fetch(url, {
      method: init.method ?? 'GET',
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    })
  } catch {
    throw new ApiError('通信に失敗しました。接続を確認して、もう一度お試しください。', 0)
  }
  let data: any = null
  try {
    data = await res.json()
  } catch {
    // JSON でない応答
  }
  if (!res.ok) throw new ApiError(data?.error || '処理に失敗しました。時間をおいて再度お試しください。', res.status)
  return data as T
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : '通信に失敗しました'
}

// ---------- 権限（ボタンの出し分け） ----------

/**
 * 画面でボタンを出し分けるための役割。役割は既存の GET /api/income/organization の role を使い、
 * 判定は API と同じ hasMinRole（lib/income/roles）を使う。表示だけの判定で、操作の可否は API が決める。
 * - pending: 読み込み中（ボタンは出すが押せない）
 * - allows(min): 役割が min 以上なら true。役割を読めなかったときは true（押せば API が判定する）
 */
export function useIncomePermission() {
  const [state, setState] = useState<{ pending: boolean; role: IncomeRole | null }>({ pending: true, role: null })
  useEffect(() => {
    let alive = true
    fetchJson<{ role?: string }>('/api/income/organization')
      .then((d) => { if (alive) setState({ pending: false, role: typeof d?.role === 'string' && hasMinRole(d.role, 'member') ? (d.role as IncomeRole) : null }) })
      .catch(() => { if (alive) setState({ pending: false, role: null }) })
    return () => { alive = false }
  }, [])
  const allows = useCallback((min: IncomeRole) => state.role === null || hasMinRole(state.role, min), [state.role])
  return { pending: state.pending, role: state.role, allows }
}

// ---------- 読み込みの 4 状態（読込・エラー・権限なし・未ログイン） ----------

export type Resource<T> = {
  data: T | null
  error: ApiError | null
  loading: boolean
  /** 読込が 300ms を超えたら true（短い読込でスケルトンを点滅させない） */
  slow: boolean
  /** 画面を維持したまま取り直す（操作のあとの更新）。失敗したらエラー状態になる */
  reload: () => Promise<void>
  /** 失敗後の「もう一度」。スケルトンから取り直す */
  retry: () => Promise<void>
}

export function useResource<T>(loader: () => Promise<T>, key: string): Resource<T> {
  const ref = useRef(loader)
  ref.current = loader
  const seq = useRef(0)
  const [st, setSt] = useState<{ data: T | null; error: ApiError | null; loading: boolean }>({ data: null, error: null, loading: true })
  const [slow, setSlow] = useState(false)

  const fetchNow = useCallback(async (reset: boolean) => {
    const n = ++seq.current
    setSt((p) => ({ data: reset ? null : p.data, error: null, loading: true }))
    try {
      const d = await ref.current()
      if (n === seq.current) setSt({ data: d, error: null, loading: false })
    } catch (e) {
      if (n === seq.current) setSt({ data: null, error: e instanceof ApiError ? e : new ApiError(errMsg(e), 0), loading: false })
    }
  }, [])

  useEffect(() => { fetchNow(true) }, [key, fetchNow])

  const waiting = st.loading && st.data === null
  useEffect(() => {
    if (!waiting) { setSlow(false); return }
    const t = setTimeout(() => setSlow(true), 300)
    return () => clearTimeout(t)
  }, [waiting])

  return { data: st.data, error: st.error, loading: st.loading, slow, reload: () => fetchNow(false), retry: () => fetchNow(true) }
}

/** 読込中はスケルトン、失敗・権限なし・未ログインは EmptyState、成功したら children に data を渡す */
export function Gate<T>({
  res, skeleton, listHref, listLabel, children,
}: { res: Resource<T>; skeleton: ReactNode; listHref?: string; listLabel?: string; children: (data: T) => ReactNode }) {
  if (res.data !== null) return <>{children(res.data)}</>
  const e = res.error
  if (e) {
    if (e.status === 403) return <EmptyState variant="forbidden" message={FORBIDDEN_MESSAGE} />
    if (e.status === 401) return <EmptyState variant="unauth" message="ログインの有効期限が切れました。もう一度ログインしてください。" />
    if (e.status === 404 && listHref) {
      return <EmptyState variant="error" message="この情報は見つかりませんでした。削除されたか、リンクが正しくない可能性があります。" action={{ label: `${listLabel ?? '一覧'}へ戻る`, href: listHref }} />
    }
    return <EmptyState variant="error" message="読み込めませんでした。通信状態を確認して、もう一度お試しください。" action={{ label: 'もう一度', onClick: () => { void res.retry() } }} />
  }
  return res.slow ? <>{skeleton}</> : null
}

// ---------- 入力中の離脱確認 ----------

/**
 * フォームの値が最初から変わっていたら、タブを閉じる・再読込の前に確認を出す（beforeunload）。
 * 保存できたら markClean() を呼ぶ。読み込み後に初期値が入る画面も、入ったあとに markClean() を呼ぶ。
 */
export function useUnsavedGuard(value: unknown) {
  const cur = JSON.stringify(value)
  const base = useRef(cur)
  const curRef = useRef(cur)
  curRef.current = cur
  const dirty = cur !== base.current
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [])
  const markClean = useCallback(() => { base.current = curRef.current }, [])
  return { dirty, markClean }
}

// ---------- 小さな部品 ----------

export const inputCls = s.input

export function ErrorText({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return (
    <p role="alert" className={s.errBox} style={{ margin: 0 }}>
      <AlertCircle size={18} aria-hidden="true" style={{ flex: 'none', marginTop: 3 }} />
      <span style={{ minWidth: 0 }}>{message}</span>
    </p>
  )
}

export function Field({
  label, children, hint, error, className = '',
}: { label: string; children: ReactNode; hint?: string; error?: string | null; className?: string }) {
  // 入力欄に aria-invalid を足す（エラー文は下に出す）
  const kids = Children.map(children, (c) => {
    if (isValidElement(c) && typeof c.type === 'string' && ['input', 'select', 'textarea'].includes(c.type)) {
      return cloneElement(c as ReactElement<Record<string, unknown>>, error ? { 'aria-invalid': true } : {})
    }
    return c
  })
  return (
    <label className={`${s.field} ${className}`.trim()}>
      <span className={s.label}>{label}</span>
      {kids}
      {error ? <span role="alert" className={s.fieldError}>{error}</span> : hint ? <span className={s.hint}>{hint}</span> : null}
    </label>
  )
}

export function CheckRow({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className={s.checkRow}>
      <input type="checkbox" className={s.check} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  )
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [onClose])
  return (
    <div className={`no-print ${s.overlay}`} onClick={onClose}>
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${s.modal} ${wide ? s.modalWide : ''}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={s.cardHead} style={{ marginBottom: 12, flexWrap: 'nowrap' }}>
          <h2 className={s.h2}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="閉じる" className={s.iconBtn}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** alert / confirm / prompt の代わり。理由の入力などは children に入れる */
export function ConfirmDialog({
  title, message, confirmLabel, cancelLabel = 'やめる', danger = false, busy = false, error, confirmDisabled = false, onConfirm, onClose, children,
}: {
  title: string
  message?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  error?: string | null
  confirmDisabled?: boolean
  onConfirm: () => void
  onClose: () => void
  children?: ReactNode
}) {
  return (
    <Modal title={title} onClose={() => !busy && onClose()}>
      {message && <p style={{ margin: '0 0 12px', fontSize: 15, lineHeight: 1.7, color: 'var(--sub)' }}>{message}</p>}
      {children}
      {error && <div style={{ marginTop: 12 }}><ErrorText message={error} /></div>}
      <div className={s.modalFoot}>
        <Button variant="secondary" onClick={onClose} disabled={busy}>{cancelLabel}</Button>
        <Button variant={danger ? 'dangerSolid' : 'primary'} onClick={onConfirm} loading={busy} disabled={confirmDisabled}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}

// ---------- バッジ（状態色: 請求漏れ・遅延=bad / 入金済み・成功=ok / 注意=note） ----------

type Tone = 'ok' | 'note' | 'bad' | 'info' | 'neutral'
const TONE_CLS: Record<Tone, string> = { ok: s.bOk, note: s.bNote, bad: s.bBad, info: s.bInfo, neutral: s.bNeutral }

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`${s.badge} ${TONE_CLS[tone]}`}>{children}</span>
}

export function ContractStatusBadge({ status }: { status: string }) {
  const tone: Tone = status === 'active' ? 'ok' : status === 'draft' ? 'note' : 'neutral'
  return <Badge tone={tone}>{CONTRACT_STATUS_LABEL[status] ?? status}</Badge>
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  const tone: Tone = status === 'draft' ? 'note' : status === 'confirmed' ? 'info' : status === 'sent' ? 'ok' : 'neutral'
  return <Badge tone={tone}>{INVOICE_STATUS_LABEL[status] ?? status}</Badge>
}

/** API の state.label（未入金/一部入金/入金済み/入金遅延）。取消・下書きは null */
export function PaymentStateBadge({ label }: { label: string | null | undefined }) {
  if (!label) return <span className={s.muted}>—</span>
  const tone: Tone = label === '入金遅延' ? 'bad' : label === '入金済み' ? 'ok' : label === '一部入金' ? 'note' : 'neutral'
  return <Badge tone={tone}>{label}</Badge>
}

export function ScheduleStatusBadge({ status }: { status: string }) {
  const tone: Tone = status === 'invoiced' ? 'ok' : status === 'skipped' ? 'neutral' : 'note'
  return <Badge tone={tone}>{SCHEDULE_STATUS_LABEL[status] ?? status}</Badge>
}

export function PaymentMatchBadge({ status }: { status: string }) {
  const tone: Tone = status === 'matched' ? 'ok' : status === 'partial' ? 'note' : 'neutral'
  return <Badge tone={tone}>{PAYMENT_STATUS_LABEL[status] ?? status}</Badge>
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
    <div className="space-y-3">
      {allowDefault && (
        <select
          className={inputCls}
          aria-label="支払条件の指定方法"
          value={isDefault ? 'default' : 'custom'}
          onChange={(e) => onChange(e.target.value === 'default' ? { closingDay: null, paymentMonths: null, paymentDay: null } : { closingDay: MONTH_END, paymentMonths: 1, paymentDay: MONTH_END })}
        >
          <option value="default">設定の既定を使う</option>
          <option value="custom">この取引先だけ個別に指定する</option>
        </select>
      )}
      {!isDefault && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          <p className={s.sub} style={{ margin: 0 }}>{describePaymentTerms({ closingDay: closing, paymentMonths: months, paymentDay: payDay })}</p>
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

/** 明細の入力ミスを文にして返す（空のものは返さない。保存時はサーバーも検証する） */
export function lineRowErrors(r: LineRow): { quantity?: string; unitPrice?: string } {
  const out: { quantity?: string; unitPrice?: string } = {}
  if (r.quantity.trim() !== '' && Number.isNaN(Number(r.quantity.normalize('NFKC').replace(/,/g, '')))) out.quantity = '数量は数字で入力してください'
  if (r.unitPrice.trim() !== '' && Number.isNaN(parseYenInput(r.unitPrice))) out.unitPrice = '単価は整数で入力してください'
  return out
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
      {hint && <p className={s.sub} style={{ margin: '0 0 12px' }}>{hint}</p>}
      <div className="space-y-3">
        {rows.map((r, i) => {
          const er = lineRowErrors(r)
          return (
            <div key={i} className={s.lineCard}>
              <div className="grid grid-cols-6 gap-3">
                <Field label="品目" className="col-span-6 sm:col-span-3">
                  <input className={inputCls} value={r.name} disabled={disabled} maxLength={120} placeholder={namePlaceholder} onChange={(e) => update(i, { name: e.target.value })} />
                </Field>
                <Field label="数量" error={er.quantity} className="col-span-2 sm:col-span-1">
                  <input className={inputCls} inputMode="numeric" value={r.quantity} disabled={disabled} onChange={(e) => update(i, { quantity: e.target.value })} />
                </Field>
                <Field label="単価（円）" error={er.unitPrice} className="col-span-4 sm:col-span-2">
                  <input className={inputCls} inputMode="text" value={r.unitPrice} disabled={disabled} placeholder="100000" onChange={(e) => update(i, { unitPrice: e.target.value })} />
                </Field>
                <Field label="税率" className="col-span-3 sm:col-span-2">
                  <select className={inputCls} value={r.taxRate} disabled={disabled} onChange={(e) => update(i, { taxRate: Number(e.target.value) })}>
                    {TAX_RATES.map((t) => <option key={t} value={t}>{t}%</option>)}
                  </select>
                </Field>
                <div className="col-span-3 flex flex-wrap items-end justify-between gap-2 sm:col-span-4">
                  <p className={s.sub} style={{ margin: 0, paddingBottom: 12 }}>
                    金額 <span className={`${s.num} ${s.strong}`}>{totals ? yen(totals.lineAmounts[i]) : '—'}</span>
                  </p>
                  {rows.length > 1 && !disabled && (
                    <Button variant="danger" size="sm" onClick={() => onChange(rows.filter((_, idx) => idx !== i))}>
                      <Trash2 size={14} aria-hidden="true" />削除
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {!disabled && (
        <div style={{ marginTop: 12 }}>
          <Button size="sm" onClick={() => onChange([...rows, emptyLine(rows[rows.length - 1]?.taxRate ?? 10)])}>
            <Plus size={14} aria-hidden="true" />行を追加
          </Button>
        </div>
      )}
      <div className={s.totals}>
        {totals ? (
          <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
            <dt>小計（税抜）</dt><dd className="m-0 text-right">{yen(totals.subtotalExclTax)}</dd>
            <dt>消費税</dt><dd className="m-0 text-right">{yen(totals.taxAmount)}</dd>
            <dt className={s.strong}>合計（税込）</dt><dd className={`m-0 text-right ${s.strong}`}>{yen(totals.totalInclTax)}</dd>
          </dl>
        ) : (
          <span className={totalError ? s.badText : s.muted}>{totalError ?? '数量と単価を入力すると合計が出ます'}</span>
        )}
      </div>
    </div>
  )
}

// ---------- 月の切替 ----------

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className={s.monthSw}>
      <button type="button" aria-label="前の月" onClick={() => onChange(shiftMonth(month, -1))} className={s.monthBtn}>
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <span className={`${s.monthLabel} ${s.num}`} aria-live="polite">{monthLabel(month)}</span>
      <button type="button" aria-label="次の月" onClick={() => onChange(shiftMonth(month, 1))} className={s.monthBtn}>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  )
}

// ---------- 切替タブ ----------

export function Tabs({ tabs, value, onChange }: { tabs: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className={s.tabs} role="group" aria-label="絞り込み">
      {tabs.map(([k, label]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)} className={`${s.tab} ${value === k ? s.tabOn : ''}`.trim()}>
          {label}
        </button>
      ))}
    </div>
  )
}
