'use client'

// ============================================
// ドヤポップアップ 画面の共通部品（統合仕様 R-3 / §11）
// ============================================
// ⚠️ 色・角丸・影・余白は popup-ds.css のトークン（.pd-*）だけで描く。色を直書きしない。
// ⚠️ 段0の ds/*（Skeleton / EmptyState / StatTile など）が main に入ったら、ここを ds の部品に置き換える。
// ⚠️ alert() / confirm() は使わない（確認は ConfirmDialog、結果は Toast）。
import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Check, Copy, RotateCcw } from 'lucide-react'
import type { PopupDto } from '@/lib/popup/dto'
import {
  KIND_LABEL,
  LAYOUT_LABEL,
  STATUS_LABEL,
  type PopupFrequency,
  type PopupStatus,
  type PopupTargeting,
  type PopupTrigger,
} from '@/lib/popup/schema'

// ---------- 文言の組み立て ----------

export function triggerText(t: PopupTrigger): string {
  if (t.type === 'scroll') return `${t.scrollPct}%スクロールしたら`
  if (t.type === 'exit') return `離脱しそうなとき（スマホは${t.delaySec}秒後）`
  return t.delaySec === 0 ? 'ページを開いたらすぐ' : `${t.delaySec}秒後`
}

export function targetingText(t: PopupTargeting): string {
  const device = t.device === 'pc' ? 'PCのみ' : t.device === 'sp' ? 'スマホのみ' : 'PC・スマホ'
  const pages = t.pathMode === 'include' ? `${t.paths.length}件のページ` : 'すべてのページ'
  return `${device} / ${pages}`
}

export function frequencyText(f: PopupFrequency): string {
  const days = f.hideDays === 0 ? '閉じても次のページでまた表示' : `閉じたら${f.hideDays}日表示しない`
  return f.oncePerSession ? `${days}・1回の訪問で1度まで` : days
}

export function summaryText(p: PopupDto): string {
  return `${LAYOUT_LABEL[p.creative.layout]}・${triggerText(p.trigger)}`
}

export function fmt(n: number): string {
  return n.toLocaleString('ja-JP')
}

export function pct(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(1)}%`
}

// ---------- 小さな部品 ----------

export function CopyButton({ text, label = 'コピー', primary = false }: { text: string; label?: string; primary?: boolean }) {
  const [done, setDone] = useState(false)
  const [fallback, setFallback] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 1800)
    } catch {
      // クリップボードが使えない環境では、選択済みの欄を出して手でコピーしてもらう
      setFallback(true)
    }
  }
  return (
    <span className="inline-flex flex-col gap-2">
      <button type="button" onClick={copy} className={primary ? 'pd-btn' : 'pd-btn-outline'}>
        {done ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {done ? 'コピーしました' : label}
      </button>
      {fallback && (
        <input
          readOnly
          autoFocus
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="コピーする内容（選択済み）"
          className="pd-input"
        />
      )}
    </span>
  )
}

export function StatusBadge({ status }: { status: PopupStatus }) {
  const cls = status === 'live' ? 'pd-chip pd-chip-ok' : status === 'paused' ? 'pd-chip' : 'pd-chip pd-chip-note'
  return <span className={cls}>{STATUS_LABEL[status]}</span>
}

export function KindBadge({ kind }: { kind: PopupDto['kind'] }) {
  return <span className="pd-chip pd-chip-blue">{KIND_LABEL[kind]}</span>
}

export function StatTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="pd-card" style={{ padding: 16 }}>
      <p className="pd-label">{label}</p>
      <p className="mt-1">
        <span className="pd-num">{value}</span>
        {unit && <span className="ml-1 text-sm font-medium text-[color:var(--sub)]">{unit}</span>}
      </p>
    </div>
  )
}

export function DaysSwitch({ value, onChange }: { value: number; onChange: (d: 7 | 30 | 90) => void }) {
  return (
    <div className="pd-soft inline-flex p-1" role="group" aria-label="集計の期間">
      {([7, 30, 90] as const).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          aria-pressed={value === d}
          className={`min-h-[44px] min-w-[52px] rounded-[10px] px-3 text-[13px] font-bold ${
            value === d ? 'bg-[var(--paper)] text-[color:var(--ink)] shadow-[var(--shadow)]' : 'text-[color:var(--sub)]'
          }`}
        >
          {d}日
        </button>
      ))}
    </div>
  )
}

/** 見出し行（パンくず・タイトル・主ボタン1つ） */
export function PageHeader({
  back,
  title,
  sub,
  action,
}: {
  back?: { href: string; label: string }
  title: React.ReactNode
  sub?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <header>
      {back && (
        <Link href={back.href} className="pd-label inline-flex min-h-[44px] items-center gap-1 hover:text-[color:var(--ink)]">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="pd-h1 break-words">{title}</h1>
          {sub && <div className="pd-label mt-1 break-all">{sub}</div>}
        </div>
        {action}
      </div>
    </header>
  )
}

// ---------- 状態表示（§11。読込・空・エラー・権限なし・処理中） ----------

export function EmptyState({
  image,
  title,
  body,
  action,
}: {
  image: string
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="pd-card flex flex-col items-center px-6 py-12 text-center">
      <Image src={image} alt="" width={320} height={240} className="h-auto w-[240px] md:w-[320px]" />
      <p className="pd-h2 mt-4">{title}</p>
      <p className="pd-label mt-2 max-w-md">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="pd-card flex flex-col items-center px-6 py-12 text-center" role="alert">
      <Image src="/empty/error.svg" alt="" width={320} height={256} unoptimized className="h-auto w-[200px] md:w-[240px]" />
      <p className="pd-h2 mt-4">読み込めませんでした</p>
      <p className="pd-label mt-2 max-w-md">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="pd-btn mt-6">
          <RotateCcw className="h-4 w-4" aria-hidden />
          もう一度
        </button>
      )}
    </div>
  )
}

export function ForbiddenState({ what }: { what: string }) {
  return (
    <div className="pd-card flex flex-col items-center px-6 py-12 text-center">
      <Image src="/empty/forbidden.svg" alt="" width={320} height={256} unoptimized className="h-auto w-[200px] md:w-[240px]" />
      <p className="pd-h2 mt-4">この{what}は表示できません</p>
      <p className="pd-label mt-2 max-w-md">
        削除されたか、別のアカウントで作られた{what}です。作ったときのアカウントでログインしているか確かめてください。共有したい場合は、作った方に設置タグや内容を送ってもらってください。
      </p>
      <Link href="/popup" className="pd-btn mt-6">
        サイト一覧へ
      </Link>
    </div>
  )
}

/** 長い処理の段階表示（何をしているか・あと何段） */
export function ProcessingSteps({ steps, current, note }: { steps: string[]; current: number; note?: string }) {
  return (
    <div className="pd-card flex flex-col items-center gap-4 px-6 py-8 text-center md:flex-row md:text-left" role="status" aria-live="polite">
      <Image src="/popup/working.webp" alt="" width={320} height={240} className="h-auto w-[200px] shrink-0" />
      <div className="min-w-0">
        <p className="pd-h2">{steps[current]}</p>
        <p className="pd-label mt-1">
          {current + 1} / {steps.length} 段目{current < steps.length - 1 ? `（あと${steps.length - current - 1}段）` : ''}
          {note ? `。${note}` : ''}
        </p>
        <ol className="mt-4 space-y-2">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-2 text-sm">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  i < current ? 'bg-[var(--blue)] text-[color:var(--paper)]' : i === current ? 'bg-[var(--blue-soft)] text-[color:var(--blue-deep)]' : 'bg-[var(--track)] text-[color:var(--muted)]'
                }`}
              >
                {i < current ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
              </span>
              <span className={i <= current ? 'text-[color:var(--ink)]' : 'text-[color:var(--muted)]'}>{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

// ---------- トーストと確認ダイアログ ----------

export interface ToastState {
  message: string
  undo?: () => void
}

/** 画面上部のトースト（3秒）。取り消せる操作には「元に戻す」を付ける */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const show = useCallback((t: ToastState) => {
    if (timer.current) clearTimeout(timer.current)
    setToast(t)
    timer.current = setTimeout(() => setToast(null), 3000)
  }, [])
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  const node = toast ? (
    <div className="pd-toast" role="status" aria-live="polite">
      <span>{toast.message}</span>
      {toast.undo && (
        <button
          type="button"
          onClick={() => {
            toast.undo?.()
            setToast(null)
          }}
        >
          元に戻す
        </button>
      )}
    </div>
  ) : null
  return { show, node }
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])
  return (
    <div className="pd-scrim" onClick={onCancel}>
      <div className="pd-dialog" role="alertdialog" aria-modal="true" aria-labelledby="pd-confirm-title" onClick={(e) => e.stopPropagation()}>
        <p id="pd-confirm-title" className="pd-h2">
          {title}
        </p>
        <p className="mt-2 text-[15px] text-[color:var(--sub)]">{body}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="pd-btn-outline">
            やめる
          </button>
          <button type="button" onClick={onConfirm} className={danger ? 'pd-btn-outline !border-[color:var(--err-ink)] !text-[color:var(--err-ink)]' : 'pd-btn'}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- 骨組み（読込中。実物と同じ形） ----------

export function SkeletonSiteCards({ count = 2 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="pd-card space-y-3">
          <div className="pd-skel h-5 w-1/2" />
          <div className="pd-skel h-4 w-1/3" />
          <div className="pd-skel h-6 w-2/5" />
          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="pd-skel h-12" />
            <div className="pd-skel h-12" />
            <div className="pd-skel h-12" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonDetail() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="pd-skel h-8 w-1/3" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="pd-skel h-[88px]" />
        ))}
      </div>
      <div className="pd-skel h-40" />
      <div className="pd-skel h-64" />
    </div>
  )
}
