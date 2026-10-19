'use client'
// ============================================
// ds — 全ツール共通の画面部品（クリア）
// ============================================
// ⚠️ 数字やデータは props で受け取るだけ。部品の中で取得しない。
// ⚠️ アイコンは名前の文字列で受け取る（例: icon="FileText"）。部品（関数）はサーバーから渡せないため（src/components/shell/icons.tsx）。
// ⚠️ AppShell（.ds）の中で使う前提。外で使うときは tokens.module.css の .ds を親に当てる。
// 仕様: docs/architecture/management-agent/ADDON-SERVICES-2026-10-18.md §11
import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { ShellIcon, type ShellIconName } from '@/components/shell/icons'
import type { EmptyStateKind } from '@/components/EmptyState'
import styles from './ds.module.css'

export { default as tokens } from './tokens.module.css'
// 使い方・生成中・完了・エラーの表示（UI 品質 S-16・S-18・S-19・S-20）
export { FirstSteps, GenerationProgress, DoneBanner, ErrorNotice } from './feedback'

/* ---- Card ---- */
export function Card({ title, meta, icon, children, className }: {
  title?: ReactNode
  meta?: ReactNode
  icon?: ShellIconName
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`${styles.card} ${className ?? ''}`}>
      {title || meta ? (
        <div className={styles.cardHead}>
          {title ? <h2 className={styles.cardTitle}>{icon ? <ShellIcon name={icon} size={18} /> : null}{title}</h2> : <span />}
          {meta ? <span className={styles.cardMeta}>{meta}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

/* ---- StatTile ---- */
export function StatTile({ label, value, unit, sub, icon, href, muted }: {
  label: string
  value: ReactNode
  unit?: string
  sub?: ReactNode
  icon?: ShellIconName
  href?: string
  muted?: boolean
}) {
  const body = (
    <>
      {icon ? <span className={styles.statIcon}><ShellIcon name={icon} size={18} /></span> : null}
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}{unit ? <span className={styles.statUnit}>{unit}</span> : null}</span>
      {sub ? <span className={styles.statSub}>{sub}</span> : null}
    </>
  )
  return href
    ? <Link href={href} className={styles.stat} data-muted={muted ? 'true' : undefined}>{body}</Link>
    : <div className={styles.stat} data-muted={muted ? 'true' : undefined}>{body}</div>
}

/* ---- Badge ---- */
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'blue' | 'ok' | 'note' }) {
  return <span className={styles.badge} data-tone={tone}>{children}</span>
}

/* ---- Button ---- */
type ButtonBase = { children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost'; size?: 'md' | 'sm'; icon?: ShellIconName }
export function Button(props: ButtonBase & (
  | { href: string; onClick?: never; type?: never; disabled?: never }
  | { href?: undefined; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean }
)) {
  const { children, variant = 'primary', size = 'md', icon } = props
  const inner = <>{icon ? <ShellIcon name={icon} size={size === 'sm' ? 15 : 17} /> : null}{children}</>
  if (props.href !== undefined) {
    // API 経由のリダイレクト（決済ポータル等）は通常のリンクで開く
    if (props.href.startsWith('/api/')) {
      return <a href={props.href} className={styles.button} data-variant={variant} data-size={size}>{inner}</a>
    }
    return <Link href={props.href} className={styles.button} data-variant={variant} data-size={size}>{inner}</Link>
  }
  return (
    <button type={props.type ?? 'button'} onClick={props.onClick} disabled={props.disabled} className={styles.button} data-variant={variant} data-size={size}>
      {inner}
    </button>
  )
}

/* ---- EmptyState（空・エラー・権限なし） ---- */
// ⚠️ 絵は既存の public/empty/*.svg（src/components/EmptyState.tsx と同じ組）を使う。種類も揃える。
const ART: Record<EmptyStateKind, string> = {
  'not-generated': '/empty/not-generated.svg',
  zero: '/empty/zero.svg',
  'no-results': '/empty/no-results.svg',
  error: '/empty/error.svg',
  forbidden: '/empty/forbidden.svg',
  preparing: '/empty/preparing.svg',
}

export function EmptyState({ kind = 'zero', title, description, action, art }: {
  kind?: EmptyStateKind
  title: string
  description?: ReactNode
  /** 次にやることは 1 つだけ */
  action?: ReactNode
  /** ツール固有の空状態の画像（public/<svc>/empty-*.webp）。無ければ共通の絵 */
  art?: string
}) {
  return (
    <div className={styles.empty} role={kind === 'error' ? 'alert' : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={art ?? ART[kind]} alt="" className={styles.emptyArt} width={240} height={192} />
      <p className={styles.emptyTitle}>{title}</p>
      {description ? <p className={styles.emptyText}>{description}</p> : null}
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </div>
  )
}

/* ---- Skeleton（300ms 未満で終わる読み込みでは出さない） ---- */
export function Skeleton({ lines = 3, height = 14, delayMs = 300 }: { lines?: number; height?: number; delayMs?: number }) {
  const [show, setShow] = useState(delayMs <= 0)
  useEffect(() => {
    if (delayMs <= 0) return
    const t = setTimeout(() => setShow(true), delayMs)
    return () => clearTimeout(t)
  }, [delayMs])
  if (!show) return null
  return (
    <div className={styles.skeletonLines} aria-busy="true" aria-label="読み込み中">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={styles.skeleton} style={{ height, width: i === lines - 1 && lines > 1 ? '60%' : '100%' }} />
      ))}
    </div>
  )
}

/* ---- ToolHero（ツールの最初の帯: キービジュアル・一言の説明・主ボタン） ---- */
// ⚠️ 主ボタンは1つ（ブランドの青）。見出しは ToolFrame と重ならないよう、ツール名ではなく「何ができるか」を書く。
export function ToolHero({ title, lead, action, art, artAlt = '' }: {
  title: ReactNode
  lead?: ReactNode
  /** 主ボタン（<Button> を1つ） */
  action?: ReactNode
  /** キービジュアル（public/ui-renewal/mascots/<id>.webp など） */
  art?: string
  artAlt?: string
}) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroText}>
        <h2 className={styles.heroTitle}>{title}</h2>
        {lead ? <p className={styles.heroLead}>{lead}</p> : null}
        {action ? <div className={styles.heroAction}>{action}</div> : null}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {art ? <img src={art} alt={artAlt} className={styles.heroArt} width={200} height={167} /> : null}
    </section>
  )
}
