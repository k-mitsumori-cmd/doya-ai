'use client'

// ドヤ支出管理: 共通の見た目の部品と整形関数
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import styles from './tokens.module.css'
import { ROLE_RANK, SCHEDULE_STATUS_LABEL, type ExpenseRole } from '@/lib/expense/constants'

// ---------- 組織・権限 ----------
export interface OrgState {
  orgSlug: string
  role: ExpenseRole | null
}
export const OrgContext = createContext<OrgState>({ orgSlug: '', role: null })
export function useExpenseOrg() {
  const { orgSlug, role } = useContext(OrgContext)
  const can = (min: ExpenseRole) => !!role && ROLE_RANK[role] >= ROLE_RANK[min]
  return { orgSlug, role, base: `/expense/${orgSlug}`, canManage: can('manager'), canAdmin: can('admin') }
}

// ---------- 整形 ----------
export const formatYen = (n: number | null | undefined) => `${(n ?? 0).toLocaleString('ja-JP')}円`

/** USD は金額をセントで持つ */
export function formatMoney(amount: number, currency: string) {
  if (currency === 'USD') return `$${(amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return formatYen(amount)
}
export const fmtDate = (d: string | null | undefined) => (d ? d.replace(/-/g, '/') : '-')
export const fmtMonthDay = (d: string | null | undefined) => (d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : '-')
export const fmtMonthLabel = (ym: string) => `${ym.slice(0, 4)}年${Number(ym.slice(5, 7))}月`

export function currentYm() {
  const d = new Date(Date.now() + 9 * 3600 * 1000)
  return d.toISOString().slice(0, 7)
}
export function todayYmd() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}
export function addMonths(ym: string, n: number) {
  const y = Number(ym.slice(0, 4))
  const m = Number(ym.slice(5, 7)) - 1 + n
  const yy = y + Math.floor(m / 12)
  const mm = ((m % 12) + 12) % 12
  return `${yy}-${String(mm + 1).padStart(2, '0')}`
}
export const isYm = (v: string | null | undefined): v is string => !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)

// ---------- 見た目 ----------
export const inputCls =
  'w-full rounded-[var(--r-sm)] border border-[var(--line-strong)] bg-[var(--paper)] px-3 py-2 min-h-[44px] text-[15px] font-medium text-[var(--ink)] outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/20 disabled:bg-[var(--bg)] disabled:text-[var(--muted)]'

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[var(--r)] border border-[var(--line)] bg-[var(--paper)] p-4 shadow-[var(--shadow)] md:p-6 ${className}`}>{children}</div>
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-bold leading-[1.3] text-[var(--ink)] md:text-[28px]">{title}</h1>
        {sub && <div className="mt-1 text-[13px] font-medium text-[var(--sub)]">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6">{children}</div>
}

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-[var(--blue)] text-white hover:bg-[var(--blue-deep)]',
  secondary: 'border border-[var(--line-strong)] bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--bg)]',
  danger: 'border border-[var(--pink)] bg-[var(--paper)] text-[var(--pink)] hover:bg-[var(--bg)]',
  ghost: 'text-[var(--blue)] hover:bg-[var(--blue-soft)]',
}
export function Btn({
  variant = 'primary',
  size = 'md',
  busy,
  className = '',
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; busy?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || busy}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--r-sm)] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        size === 'sm' ? 'min-h-[44px] px-3 py-1 text-xs md:min-h-[32px]' : 'min-h-[44px] px-4 py-2 text-sm'
      } ${BTN[variant]} ${className}`}
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  )
}

export type Tone = 'slate' | 'teal' | 'amber' | 'red' | 'blue' | 'green'
const TONE: Record<Tone, string> = {
  slate: 'bg-[var(--bg)] text-[var(--sub)]',
  teal: 'bg-[var(--blue-soft)] text-[var(--blue-deep)]',
  amber: 'bg-[var(--note-bg)] text-[var(--note-ink)]',
  red: 'bg-[var(--pink)]/10 text-[var(--pink)]',
  blue: 'bg-[var(--blue-soft)] text-[var(--blue-deep)]',
  green: 'bg-[var(--ok-bg)] text-[var(--ok-ink)]',
}
export function Badge({ tone = 'slate', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${TONE[tone]}`}>{children}</span>
}

const STATUS_TONE: Record<string, Tone> = { planned: 'slate', billed: 'blue', approved: 'teal', paid: 'green', skipped: 'amber' }
export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs font-bold text-[var(--muted)]">支払なし</span>
  return <Badge tone={STATUS_TONE[status] ?? 'slate'}>{SCHEDULE_STATUS_LABEL[status as keyof typeof SCHEDULE_STATUS_LABEL] ?? status}</Badge>
}

export function MonthSwitcher({ value, onChange }: { value: string; onChange: (ym: string) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--paper)] p-1">
      <button type="button" aria-label="前の月" onClick={() => onChange(addMonths(value, -1))} className="rounded-[var(--r-sm)] p-1.5 text-[var(--sub)] hover:bg-[var(--bg)]">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <input
        type="month"
        value={value}
        onChange={(e) => isYm(e.target.value) && onChange(e.target.value)}
        className="w-36 bg-transparent text-center text-sm font-bold text-[var(--ink)] outline-none"
      />
      <button type="button" aria-label="次の月" onClick={() => onChange(addMonths(value, 1))} className="rounded-[var(--r-sm)] p-1.5 text-[var(--sub)] hover:bg-[var(--bg)]">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="md:overflow-x-auto">{children}</div>
}
/** 375px では行を縦積みのカードにする。td には data-label を付けること */
export const tableCls = 'block w-full border-collapse md:table md:min-w-[1100px]'
export const theadCls = 'hidden md:table-header-group'
export const tbodyCls = 'block md:table-row-group'
export const trCls = 'mb-3 block rounded-[var(--r-sm)] border border-[var(--line)] p-3 md:mb-0 md:table-row md:rounded-none md:border-0 md:p-0'
export const thCls = 'whitespace-nowrap border-b border-[var(--line)] px-3 py-2 text-left text-[13px] font-medium text-[var(--sub)]'
export const tdCls =
  'flex items-center justify-between gap-3 py-1.5 text-[15px] text-[var(--ink)] before:text-[13px] before:font-medium before:text-[var(--sub)] before:content-[attr(data-label)] md:table-cell md:border-b md:border-[var(--line)] md:px-3 md:py-2.5 md:before:content-none'

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[13px] font-medium text-[var(--sub)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] font-bold text-[var(--muted)]">{hint}</span>}
    </label>
  )
}

export function Check({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className="flex items-start gap-2">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--blue)]" />
      <span>
        <span className="text-sm font-bold text-[var(--ink)]">{label}</span>
        {hint && <span className="block text-[11px] font-bold text-[var(--muted)]">{hint}</span>}
      </span>
    </label>
  )
}

/** 読込中: 実物に近い形のスケルトン。300ms 未満で終わるなら出さない */
export function ExpenseSkeleton({ rows = 4, kpi = false }: { rows?: number; kpi?: boolean }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300)
    return () => clearTimeout(t)
  }, [])
  if (!show) return <div className="min-h-[200px]" aria-hidden />
  return (
    <div className="space-y-4" role="status" aria-label="読み込み中">
      {kpi && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className={`${styles.skel} h-24 rounded-[var(--r)]`} />)}
        </div>
      )}
      <div className="space-y-3 rounded-[var(--r)] border border-[var(--line)] bg-[var(--paper)] p-4 md:p-6">
        {Array.from({ length: rows }).map((_, i) => <div key={i} className={`${styles.skel} h-10 rounded-[var(--r-sm)]`} />)}
      </div>
    </div>
  )
}
export const Loading = ({ rows, kpi }: { label?: string; rows?: number; kpi?: boolean }) => <ExpenseSkeleton rows={rows} kpi={kpi} />

export function EmptyState({
  image, alt = '', text, actionLabel, onAction, href,
}: { image: string; alt?: string; text: string; actionLabel?: string; onAction?: () => void; href?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={alt} width={160} height={160} className="h-40 w-40 object-contain" />
      <p className="max-w-sm text-[15px] leading-[1.7] text-[var(--sub)]">{text}</p>
      {actionLabel && (href ? (
        <Link href={href} className="inline-flex min-h-[44px] items-center rounded-[var(--r-sm)] border border-[var(--line-strong)] bg-[var(--paper)] px-4 text-sm font-bold text-[var(--ink)] hover:bg-[var(--bg)]">{actionLabel}</Link>
      ) : (
        <Btn variant="secondary" onClick={onAction}>{actionLabel}</Btn>
      ))}
    </div>
  )
}
/** 空の一覧（次の行動ボタンが無いときは文だけで済ませない: 呼び出し側で actionLabel を渡す） */
export const Empty = ({ children }: { children: React.ReactNode }) => (
  <EmptyState image="/empty/zero.svg" text={typeof children === 'string' ? children : ''} />
)

/** forbidden=true（HTTP 403 または画面側の権限判定）で権限なし表示にする。メッセージ文では判定しない */
export function ErrorBox({ onRetry, forbidden }: { message?: string; onRetry?: () => void; forbidden?: boolean }) {
  if (forbidden) {
    return <EmptyState image="/empty/forbidden.svg" text="この操作を行う権限がありません。組織の管理者に権限の変更を依頼してください。" />
  }
  return (
    <EmptyState
      image="/empty/error.svg"
      text="読み込めませんでした。通信の状態を確認して、もう一度お試しください。"
      actionLabel="もう一度"
      onAction={onRetry}
    />
  )
}

/** 画面内の確認ダイアログ（alert / confirm は使わない） */
export function useConfirm() {
  const [state, setState] = useState<{ message: string; confirmLabel: string; resolve: (v: boolean) => void } | null>(null)
  const ask = useCallback(
    (message: string, confirmLabel = '実行する') => new Promise<boolean>((resolve) => setState({ message, confirmLabel, resolve })),
    []
  )
  const close = (v: boolean) => {
    state?.resolve(v)
    setState(null)
  }
  const dialog = state ? (
    <Modal title="確認" onClose={() => close(false)}>
      <p className="text-[15px] leading-[1.7] text-[var(--ink)]">{state.message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Btn variant="secondary" onClick={() => close(false)}>キャンセル</Btn>
        <Btn variant="danger" onClick={() => close(true)}>{state.confirmLabel}</Btn>
      </div>
    </Modal>
  ) : null
  return { ask, dialog }
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--r)] bg-[var(--paper)] p-5 shadow-[var(--shadow-lg)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--ink)]">{title}</h2>
          <button type="button" aria-label="閉じる" onClick={onClose} className="rounded-[var(--r-sm)] p-1.5 text-[var(--sub)] hover:bg-[var(--bg)]">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** 現在の単価×数量の表示（通貨に合わせる） */
export function priceSummary(c: { currency: string; currentPrice: { unitPrice: number; quantity: number; taxIncluded: boolean } | null }) {
  const p = c.currentPrice
  if (!p) return '-'
  const total = p.unitPrice * p.quantity
  const base = formatMoney(total, c.currency)
  const detail = p.quantity !== 1 ? `（${formatMoney(p.unitPrice, c.currency)} × ${p.quantity}）` : ''
  return `${base}${detail}${p.taxIncluded ? ' 税込' : ' 税抜'}`
}

/** 大きい金額: 数字と「円」を分け、折り返さない。桁が多いときは数字を小さくする */
export function BigYen({ value }: { value: number }) {
  const n = (value ?? 0).toLocaleString('ja-JP')
  const size = n.length > 11 ? 'text-[20px] md:text-[24px]' : n.length > 9 ? 'text-[22px] md:text-[28px]' : 'text-[24px] md:text-[32px]'
  return (
    <span className="inline-flex items-baseline gap-0.5 whitespace-nowrap tabular-nums text-[var(--ink)]">
      <span className={`${size} font-bold leading-[1.1]`}>{n}</span>
      <span className="text-[14px] font-medium">円</span>
    </span>
  )
}
