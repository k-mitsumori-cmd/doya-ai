'use client'

// ドヤ社内インタビュー 画面の共通部品
import { useEffect, useState, type ReactNode } from 'react'
import { Check, Loader2 } from 'lucide-react'

export const ACCENT = 'var(--blue)'

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: '下書き',
  COLLECTING: '素材を集めています',
  FACTS: '事実の抽出待ち',
  WRITING: '記事の作成待ち',
  DONE: '記事ができました',
}

export function StatusBadge({ status }: { status: string }) {
  const done = status === 'DONE'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-black ${
        done ? 'border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok-ink)]' : 'border-[var(--blue-line)] bg-[var(--blue-soft)] text-[var(--blue-deep)]'
      }`}
    >
      {done && <span className="h-1.5 w-1.5 rounded-full bg-[var(--ok-bg)]0" />}
      {STATUS_LABEL[status] || status}
    </span>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[var(--r)] border border-[var(--line)] bg-[var(--paper)] p-5 sm:p-6 ${className}`}>{children}</div>
}

export function SectionTitle({ step, title, desc }: { step?: string; title: string; desc?: string }) {
  return (
    <div className="mb-4">
      {step && <p className="text-[11px] font-black tracking-wide text-[var(--blue-deep)]">{step}</p>}
      <h2 className="text-lg font-black text-[var(--ink)]">{title}</h2>
      {desc && <p className="mt-1 text-sm font-bold leading-relaxed text-[var(--sub)]">{desc}</p>}
    </div>
  )
}

type BtnProps = {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  type?: 'button' | 'submit'
  className?: string
}

export function Button({ children, onClick, disabled, loading, variant = 'primary', type = 'button', className = '' }: BtnProps) {
  const cls =
    variant === 'primary'
      ? 'bg-[var(--blue)] text-white hover:bg-[var(--blue-deep)] disabled:bg-[var(--line-strong)]'
      : variant === 'danger'
        ? 'bg-[var(--paper)] text-rose-600 border border-rose-200 hover:bg-rose-50 disabled:text-[var(--muted)]'
        : variant === 'ghost'
          ? 'text-[var(--sub)] hover:bg-[var(--bg)] disabled:text-[var(--muted)]'
          : 'bg-[var(--paper)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--bg)] disabled:text-[var(--muted)]'
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--r-sm)] px-4 py-2.5 text-sm font-black transition-colors disabled:cursor-not-allowed ${cls} ${className}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-black text-[var(--sub)]">{label}</span>
      {hint && <span className="ml-2 text-[11px] font-bold text-[var(--muted)]">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  )
}

export const inputCls =
  'w-full rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm font-bold text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--blue)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-line)]'

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error'; children: ReactNode }) {
  const cls =
    tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : tone === 'warn' ? 'border-[var(--note-ink)] bg-[var(--note-bg)] text-[var(--note-ink)]' : 'border-[var(--blue-line)] bg-[var(--blue-soft)] text-[var(--blue-deep)]'
  return <div className={`rounded-[var(--r-sm)] border px-4 py-3 text-sm font-bold leading-relaxed ${cls}`}>{children}</div>
}

/** JSON API を呼ぶ。失敗時はサーバーの日本語メッセージを Error にして投げる */
export async function api<T = any>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers || {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.success === false) {
    const err = new Error(data?.error || `通信に失敗しました（${res.status}）`) as Error & { data?: any; status?: number }
    err.data = data
    err.status = res.status
    throw err
  }
  return data as T
}

/**
 * 録音・写真のアップロード。署名付きURLへブラウザから直接送る（Vercel の本文サイズ上限を通さない）。
 * 戻り値は confirm-upload の応答（更新後のインタビュー）。
 */
export async function uploadToInterview(interviewId: string, kind: 'audio' | 'photo', file: File, onProgress?: (pct: number) => void) {
  const prepared = await api<{ signedUrl: string; path: string }>(`/api/shanai/interviews/${interviewId}/upload-url`, {
    method: 'POST',
    json: { kind, fileName: file.name, mimeType: file.type, fileSize: file.size },
  })
  const url = new URL(prepared.signedUrl)
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('アップロード先が正しくありません。')
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`アップロードに失敗しました（${xhr.status}）`))))
    xhr.addEventListener('error', () => reject(new Error('ネットワークエラーでアップロードできませんでした。')))
    const form = new FormData()
    form.append('cacheControl', '3600')
    form.append('', file, file.name)
    xhr.timeout = 3600000
    xhr.open('PUT', prepared.signedUrl)
    xhr.setRequestHeader('x-upsert', 'true')
    xhr.send(form)
  })
  return api(`/api/shanai/interviews/${interviewId}/confirm-upload`, { method: 'POST', json: { kind, path: prepared.path, mimeType: file.type } })
}

export function charCount(text: string | undefined | null) {
  return [...String(text || '').replace(/\s+/g, '')].length
}

// ---------- 状態表示（統合仕様 §11。段0の ds/Skeleton・ds/EmptyState が入ったら差し替える） ----------

/** 読込中。実物と同じ形の枠を並べる。300ms 未満で終わるなら何も出さない */
export function Skeleton({ className = '', delayMs = 300 }: { className?: string; delayMs?: number }) {
  const [show, setShow] = useState(delayMs === 0)
  useEffect(() => {
    if (delayMs === 0) return
    const t = setTimeout(() => setShow(true), delayMs)
    return () => clearTimeout(t)
  }, [delayMs])
  if (!show) return null
  return <div aria-hidden className={`shanai-skeleton ${className}`} />
}

/** 一覧・詳細の読込中のひな形 */
export function PageSkeleton({ variant = 'list' }: { variant?: 'list' | 'detail' | 'form' }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300)
    return () => clearTimeout(t)
  }, [])
  if (!show) return <div className="min-h-[60vh]" aria-busy="true" />
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10" aria-busy="true" aria-label="読み込んでいます">
      <div className="shanai-skeleton h-8 w-64" />
      <div className="shanai-skeleton mt-3 h-4 w-96 max-w-full" />
      {variant === 'list' ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="shanai-skeleton h-36 !rounded-[var(--r)]" />
          ))}
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`shanai-skeleton !rounded-[var(--r)] ${variant === 'form' ? 'h-40' : 'h-56'}`} />
          ))}
        </div>
      )}
    </div>
  )
}

/** 空・エラー・権限なし。イラスト＋一文＋次にやるボタン1つ */
export function EmptyState({
  image,
  title,
  desc,
  action,
}: {
  image: string
  title: string
  desc?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" aria-hidden className="h-40 w-auto max-w-full object-contain sm:h-48" />
      <p className="mt-4 text-[18px] font-bold leading-[1.4] text-[var(--ink)]">{title}</p>
      {desc && <p className="mt-1 max-w-md text-[13px] font-medium leading-[1.5] text-[var(--sub)]">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      image="/empty/error.svg"
      title="読み込めませんでした"
      desc={message || '通信が混み合っているか、一時的な不具合が起きています。少し時間をおいてお試しください。'}
      action={onRetry ? <Button onClick={onRetry}>もう一度読み込む</Button> : undefined}
    />
  )
}

export function ForbiddenState({ backHref = '/shanai' }: { backHref?: string }) {
  return (
    <EmptyState
      image="/empty/forbidden.svg"
      title="このページを表示できません"
      desc="削除されたか、別のアカウントで作成されたインタビューです。作成した方に共有を依頼するか、作成したアカウントでログインしてください。"
      action={
        <a href={backHref} className="inline-flex min-h-[44px] items-center rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--paper)] px-4 text-sm font-black text-[var(--ink)] hover:bg-[var(--bg)]">
          一覧に戻る
        </a>
      }
    />
  )
}

/** AI 生成など長い処理の段階表示。途中で閉じても結果はサーバーに残る */
export function ProgressSteps({ steps, current, note }: { steps: string[]; current: number; note?: string }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-4 rounded-[var(--r)] border border-[var(--blue-line)] bg-[var(--blue-soft)] p-5 sm:flex-row sm:items-start" role="status" aria-live="polite">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/shanai/working.webp" alt="" aria-hidden className="h-24 w-auto shrink-0" />
      <div className="w-full">
        <ol className="space-y-1.5">
          {steps.map((label, i) => (
            <li key={label} className="flex items-center gap-2 text-[13px] font-bold">
              {i < current ? (
                <Check className="h-4 w-4 text-[var(--ok-ink)]" />
              ) : i === current ? (
                <Loader2 className="h-4 w-4 animate-spin text-[var(--blue)]" />
              ) : (
                <span className="h-4 w-4 rounded-full border border-[var(--line-strong)]" />
              )}
              <span className={i <= current ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}>{label}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[12px] font-medium text-[var(--sub)]">
          {`あと${Math.max(steps.length - current, 1)}段階です。`}
          {note || 'この画面を閉じても、処理はサーバーで続き、結果は保存されます。'}
        </p>
      </div>
    </div>
  )
}

/** 段階表示の進み方（サーバーから途中経過が来ない処理を、経過時間で進める） */
export function useTimedStep(active: boolean, total: number, everyMs = 12000) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (!active) {
      setStep(0)
      return
    }
    const t = setInterval(() => setStep((s) => Math.min(s + 1, total - 1)), everyMs)
    return () => clearInterval(t)
  }, [active, total, everyMs])
  return step
}

/** 確認ダイアログ（window.confirm は使わない） */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'はい',
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  body?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(10,15,60,0.45)] p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shanai-confirm-title"
        className="w-full max-w-md rounded-[var(--r)] bg-[var(--paper)] p-6 shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="shanai-confirm-title" className="text-[18px] font-bold text-[var(--ink)]">
          {title}
        </p>
        {body && <p className="mt-2 text-[14px] font-medium leading-[1.7] text-[var(--sub)]">{body}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            やめる
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** 保存前に離れようとしたら確認を出す */
export function useLeaveGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])
}
