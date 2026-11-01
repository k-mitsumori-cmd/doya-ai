'use client'

// ドヤ支出管理: 共通の見た目の部品と整形関数
import React, { createContext, useCallback, useContext, useEffect, useId, useRef } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Badge as DsBadge, Button as DsButton, Card as DsCard, EmptyState as DsEmpty, Skeleton as DsSkeleton } from '@/components/ds'
import { confirmDialog } from '@/components/ds/dialog'
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
// 入れた字は 600 の太さ・16px。金額（type=number）は 18px の太字で桁をそろえる（2026-10-27 ユーザー「入力するときのフォントが細い」）
export const inputCls =
  'w-full rounded-[var(--r-sm)] border-[1.5px] border-[var(--line-strong)] bg-[var(--paper)] px-3 py-2 min-h-[48px] text-[16px] font-semibold text-[var(--ink)] outline-none transition-[border-color,box-shadow] placeholder:font-medium placeholder:text-[var(--muted)] hover:border-[var(--blue-line)] focus:border-[var(--blue)] focus:shadow-[0_0_0_4px_var(--blue-soft)] disabled:bg-[var(--bg)] disabled:text-[var(--muted)] [&[type=number]]:text-[18px] [&[type=number]]:font-bold [&[type=number]]:tabular-nums'

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <DsCard className={className}>{children}</DsCard>
}

/** 画面内の見出し行（h1 は ToolFrame が出すため、ここは h2） */
export function PageHeader({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[18px] font-bold leading-[1.4] text-[var(--ink)]">{title}</h2>
        {sub && <div className="mt-1 text-[13px] font-medium leading-[1.5] text-[var(--sub)]">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function PageBody({ children }: { children: React.ReactNode }) {
  // ⚠️ ToolFrame は本文の余白を持たない。見出し（ToolFrame の .head）と同じ左右の余白をここで付ける
  return <div className="space-y-4 px-4 pb-8 pt-4 md:px-8 md:pt-6">{children}</div>
}

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export function Btn({ variant = 'primary', size = 'md', busy, disabled, onClick, children }: {
  variant?: BtnVariant
  size?: 'sm' | 'md'
  busy?: boolean
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <DsButton variant={variant === 'danger' ? 'secondary' : variant} size={size} onClick={onClick} disabled={disabled || busy}>
      {children}
    </DsButton>
  )
}

export type Tone = 'slate' | 'teal' | 'amber' | 'red' | 'blue' | 'green'
const TONE: Record<Tone, 'neutral' | 'blue' | 'ok' | 'note'> = { slate: 'neutral', teal: 'blue', blue: 'blue', green: 'ok', amber: 'note', red: 'note' }
export function Badge({ tone = 'slate', children }: { tone?: Tone; children: React.ReactNode }) {
  return <DsBadge tone={TONE[tone]}>{children}</DsBadge>
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
      <span className="mb-1.5 block text-[14px] font-bold text-[var(--ink)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] font-bold text-[var(--sub)]">{hint}</span>}
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

/** 読込中: ds の Skeleton（300ms 未満なら出さない） */
export const Loading = ({ rows = 3 }: { label?: string; rows?: number; kpi?: boolean }) => (
  <Card><DsSkeleton lines={rows + 1} height={18} /></Card>
)

type EmptyKind = 'zero' | 'error' | 'forbidden'
export function EmptyState({ image, text, actionLabel, onAction, href, kind = 'zero' }: { image?: string; alt?: string; text: string; actionLabel?: string; onAction?: () => void; href?: string; kind?: EmptyKind }) {
  const action = actionLabel
    ? href ? <DsButton variant="secondary" href={href}>{actionLabel}</DsButton> : <DsButton variant="secondary" onClick={onAction}>{actionLabel}</DsButton>
    : undefined
  return <DsEmpty kind={kind} title={text} art={image} action={action} />
}
/** 空の一覧 */
export const Empty = ({ children }: { children: React.ReactNode }) => <EmptyState text={typeof children === 'string' ? children : ''} />

/** forbidden=true（HTTP 403 または画面側の権限判定）で権限なし表示にする。メッセージ文では判定しない */
export function ErrorBox({ onRetry, forbidden }: { message?: string; onRetry?: () => void; forbidden?: boolean }) {
  if (forbidden) {
    return <EmptyState kind="forbidden" text="この操作を行う権限がありません。組織の管理者に権限の変更を依頼してください。" />
  }
  return <EmptyState kind="error" text="読み込めませんでした。通信の状態を確認して、もう一度お試しください。" actionLabel="もう一度" onAction={onRetry} />
}

/** 画面内の確認ダイアログ（alert / confirm は使わない） */
/** 確認の窓（共通のダイアログ）。ask(本文, ボタンの文字, { title, danger }) で開き、決めたら true。
 *  dialog は互換のために残す（共通のダイアログは自分で描くので、ここは null） */
export function useConfirm() {
  const ask = useCallback(
    (message: string, confirmLabel = '実行する', opts: { title?: string; danger?: boolean } = {}) =>
      confirmDialog({
        title: opts.title ?? 'この操作を実行しますか？',
        message,
        confirmLabel,
        tone: (opts.danger ?? /削除|外す|取り消/.test(confirmLabel)) ? 'danger' : 'primary',
      }),
    []
  )
  const dialog: React.ReactNode = null
  return { ask, dialog }
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    // 開いたら窓に移り、Esc で閉じ、閉じたら元のボタンに戻す
    const prev = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--r)] bg-[var(--paper)] p-5 shadow-[var(--shadow-lg)] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-bold text-[var(--ink)]">{title}</h2>
          <button type="button" aria-label="閉じる" onClick={onClose} className="rounded-[var(--r-sm)] p-1.5 text-[var(--sub)] hover:bg-[var(--bg)]">
            <X className="h-5 w-5" aria-hidden="true" />
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
