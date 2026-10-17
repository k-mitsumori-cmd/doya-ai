'use client'

// ドヤ収入管理 ds 部品（ds のクリアと同じ見た目の写し。ds/* が main に入ったら import を差し替える）
// ⚠️ 色・角丸・影は ds.module.css で src/components/ds/tokens.module.css の変数だけを使う（ADDON-SERVICES D-2）
import Link from 'next/link'
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

import s from './ds.module.css'

export { s }

// ---------- Button ----------

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'dangerSolid'

const VARIANT_CLS: Record<ButtonVariant, string> = {
  primary: s.primary,
  secondary: s.secondary,
  danger: s.danger,
  dangerSolid: s.dangerSolid,
}

/** クラス名だけ欲しいとき（Link など別要素に当てる） */
export function buttonClass(variant: ButtonVariant = 'secondary', size: 'md' | 'sm' = 'md'): string {
  return [s.btn, VARIANT_CLS[variant], size === 'sm' ? s.sm : ''].filter(Boolean).join(' ')
}

type ButtonProps = {
  variant?: ButtonVariant
  size?: 'md' | 'sm'
  loading?: boolean
  href?: string
  children: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

/** primary は 1 画面 1 つ。2 つ目以降は secondary（枠線） */
export function Button({ variant = 'secondary', size = 'md', loading, href, children, className = '', disabled, type = 'button', ...rest }: ButtonProps) {
  const cls = `${buttonClass(variant, size)} ${className}`.trim()
  if (href && !disabled) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    )
  }
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <span className={s.spin} aria-hidden="true" />}
      {children}
    </button>
  )
}

// ---------- Card ----------

export function Card({ title, right, children, className = '', flush = false }: { title?: string; right?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`${s.card} ${flush ? s.cardFlush : ''} ${className}`.trim()}>
      {(title || right) && (
        <div className={s.cardHead}>
          {title && <h2 className={s.h2}>{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

// ---------- StatTile ----------

export function StatTile({ label, value, unit, sub, tone = 'default' }: { label: string; value: string; unit?: string; sub?: string; tone?: 'default' | 'bad' | 'ok' }) {
  return (
    <div className={`${s.stat} ${tone === 'bad' ? s.toneBad : tone === 'ok' ? s.toneOk : ''}`.trim()}>
      <p className={s.statLabel} style={{ margin: 0 }}>{label}</p>
      <p className={s.statValue} style={{ marginBottom: 0 }}>
        {value}
        {unit && value !== '—' && <span className={s.statUnit}>{unit}</span>}
      </p>
      {sub && <p className={s.statSub} style={{ marginBottom: 0 }}>{sub}</p>}
    </div>
  )
}

// ---------- Skeleton（実物と同じ形で出す） ----------

export function Skeleton({ w = '100%', h = 16, className = '' }: { w?: number | string; h?: number | string; className?: string }) {
  return <span aria-hidden="true" className={`${s.skel} ${className}`.trim()} style={{ width: w, height: h }} />
}

/** 一覧（カード行）の形 */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className={s.stackY} role="status" aria-label="読み込み中です">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={s.card} style={{ display: 'grid', gap: 8 }}>
          <Skeleton w="45%" h={18} />
          <Skeleton w="75%" h={14} />
        </div>
      ))}
    </div>
  )
}

/** 概要タイル列の形 */
export function StatsSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="読み込み中です">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className={s.stat} style={{ display: 'grid', gap: 8 }}>
          <Skeleton w="50%" h={14} />
          <Skeleton w="70%" h={32} />
          <Skeleton w="40%" h={14} />
        </div>
      ))}
    </div>
  )
}

/** 詳細（見出し＋フォームカード）の形 */
export function DetailSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div className={s.stackY} role="status" aria-label="読み込み中です">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className={s.card} style={{ display: 'grid', gap: 12 }}>
          <Skeleton w="30%" h={18} />
          <Skeleton h={44} />
          <Skeleton h={44} />
          <Skeleton w="60%" h={44} />
        </div>
      ))}
    </div>
  )
}

// ---------- EmptyState ----------

type EmptyAction = { label: string; href?: string; onClick?: () => void }

export function EmptyState({
  variant = 'empty', image, message, action,
}: { variant?: 'empty' | 'error' | 'forbidden' | 'unauth'; image?: string; message: string; action?: EmptyAction }) {
  const [here, setHere] = useState('/income')
  useEffect(() => { setHere(window.location.pathname + window.location.search) }, [])

  const src = image ?? (variant === 'error' ? '/empty/error.svg' : variant === 'empty' ? undefined : '/empty/forbidden.svg')
  let act = action
  if (variant === 'error' && !act) act = { label: 'もう一度' }
  if (variant === 'unauth') act = { label: 'ログインする', href: `/auth/signin?callbackUrl=${encodeURIComponent(here)}` }

  return (
    <div className={s.empty} role={variant === 'error' ? 'alert' : undefined}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={200} height={200} className={s.emptyImg} />
      )}
      <p className={s.emptyMsg}>{message}</p>
      {act && (act.href ? (
        <Button variant="primary" href={act.href}>{act.label}</Button>
      ) : (
        <Button variant="primary" onClick={act.onClick}>{act.label}</Button>
      ))}
    </div>
  )
}

export const FORBIDDEN_MESSAGE = '組織の管理者（オーナー）に権限の変更を依頼してください'

// ---------- Toast（画面上部・3 秒） ----------

type ToastItem = { id: number; text: string; tone: 'ok' | 'bad' }
let toasts: ToastItem[] = []
let seq = 0
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

/** どの画面からでも呼べる。表示は PageShell が持つ ToastHost */
export function toast(text: string, tone: 'ok' | 'bad' = 'ok') {
  const id = ++seq
  toasts = [...toasts, { id, text, tone }]
  emit()
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    emit()
  }, 3000)
}

export function useToast() {
  return toast
}

export function ToastHost() {
  const [list, setList] = useState<ToastItem[]>([])
  useEffect(() => {
    const f = () => setList(toasts)
    subs.add(f)
    f()
    return () => { subs.delete(f) }
  }, [])
  return (
    <div className={`no-print ${s.toastHost}`} aria-live="polite" role="status">
      {list.map((t) => (
        <div key={t.id} className={`${s.toast} ${t.tone === 'bad' ? s.toastBad : ''}`.trim()}>{t.text}</div>
      ))}
    </div>
  )
}

// ---------- PageHeader / PageShell ----------

export type Crumb = { label: string; href?: string }

/** パンくず・タイトル・主ボタン 1 つ（actions の先頭だけ primary にする） */
export function PageHeader({ crumbs: allCrumbs, title, sub, actions }: { crumbs?: Crumb[]; title: string; sub?: string; actions?: ReactNode }) {
  // ToolFrame が「経営ホーム > 収入管理」を出すので、先頭の「収入管理」は出さない。残りが今の画面だけなら出さない
  const crumbs = (allCrumbs ?? []).filter((c, i) => !(i === 0 && c.label === '収入管理'))
  return (
    <header className={s.header}>
      {crumbs.length > 1 && (
        <nav aria-label="パンくず">
          <ol className={s.crumbs}>
            {crumbs.map((c, i) => (
              <li key={`${c.label}-${i}`}>
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
                {i < crumbs.length - 1 && <span aria-hidden="true">/</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className={s.titleRow}>
        <div style={{ minWidth: 0 }}>
          {/* h1 は ToolFrame（ツール名）が持つので、画面の見出しは h2 */}
          <h2 className={s.title}>{title}</h2>
          {sub && <p className={s.sub} style={{ margin: '4px 0 0' }}>{sub}</p>}
        </div>
        {actions && <div className={s.actions}>{actions}</div>}
      </div>
    </header>
  )
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className={s.page}>
      {children}
      <ToastHost />
    </div>
  )
}
