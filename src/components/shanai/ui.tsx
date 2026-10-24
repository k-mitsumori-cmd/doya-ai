'use client'

// ドヤ社内インタビュー 画面の共通部品
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Button as DsButton, EmptyState as DsEmptyState, ErrorNotice } from '@/components/ds'
import { useInShanaiShell } from './shell-context'

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
  // 新しい見た目では、キーボードで移ったときに枠を出す・短いラベルを途中で折り返さない
  const next = ' whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] focus-visible:ring-offset-2'
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
      className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--r-sm)] px-4 py-2.5 text-sm font-black transition-colors disabled:cursor-not-allowed ${cls}${next} ${className}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
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

/**
 * 空・エラー・権限なし。イラスト＋一文＋次にやるボタン1つ。
 * 中身は段0の ds の EmptyState。共通の絵（public/empty 配下の SVG）は kind で、ツール固有の絵は art で渡す
 */
const EMPTY_KINDS = ['not-generated', 'zero', 'no-results', 'error', 'forbidden', 'preparing'] as const
type EmptyKind = (typeof EMPTY_KINDS)[number]

export function EmptyState({ image, title, desc, action }: { image: string; title: string; desc?: string; action?: ReactNode }) {
  const m = image.match(/^\/empty\/([a-z-]+)\.svg$/)
  const kind = m && (EMPTY_KINDS as readonly string[]).includes(m[1]) ? (m[1] as EmptyKind) : undefined
  return <DsEmptyState kind={kind ?? 'zero'} art={kind ? undefined : image} title={title} description={desc} action={action} />
}

// ---------- 失敗の伝え方（チェックリスト §11） ----------
// ⚠️ 生のエラー文（err.message・ステータス番号・英語の技術的な文）は画面に出さない。
//    サーバーの 4xx の日本語文（入力の誤りなど、利用者向けに書いたもの）だけはそのまま使う

export type ShanaiErrorKind = 'auth' | 'forbidden' | 'limit' | 'busy' | 'other'
export interface ShanaiUserError {
  kind: ShanaiErrorKind
  /** 何が起きたか */
  what: string
  /** どうすればよいか */
  how?: string
}

const RETRY_LATER = '通信が混み合っているか、一時的な不具合が起きています。少し時間をおいてから、もう一度お試しください。'

/** サーバーの文が、そのまま利用者に見せてよい日本語の文か（URL は除いて判定する） */
function userText(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const s = raw.replace(/https?:\/\/\S+/g, '')
  if (!/[ぁ-んァ-ヶ]/.test(s)) return null
  if (/[A-Za-z]{5,}/.test(s) || /[（(]\d{3}[）)]/.test(s)) return null
  return raw.trim()
}

/**
 * 失敗を「何が起きたか・どうすればよいか」に置き換える。
 * scene='load' は画面の読み込み（404 も「表示できない」に寄せる）、'action' はボタンを押したときの処理
 */
export function describeError(e: unknown, scene: 'load' | 'action' = 'action'): ShanaiUserError {
  const err = (e ?? {}) as { status?: number; data?: any }
  const status = err.status
  const data = err.data
  if (status === 401) return { kind: 'auth', what: 'ログインの有効期限が切れました。', how: 'もう一度ログインし直してください。' }
  if (status === 403 || (scene === 'load' && status === 404)) {
    return { kind: 'forbidden', what: 'このページを表示する権限がありません。', how: '削除されたか、別のアカウントで作成されたインタビューです。作成した方に共有を依頼するか、管理者にお問い合わせください。' }
  }
  if (data?.limitReached || data?.upgradeUrl) {
    return {
      kind: 'limit',
      what: typeof data?.limit === 'number' ? `今月の利用上限（${data.limit}回）に達しました。` : '今月の利用上限に達しました。',
      how: '料金プランを見直すと、続けて使えます。来月になると、また使えるようになります。',
    }
  }
  const text = userText(data?.error)
  if (status === 429) return text ? { kind: 'busy', what: text } : { kind: 'busy', what: '短い時間に続けて操作したため、受け付けられませんでした。', how: '少し時間をおいてから、もう一度お試しください。' }
  if (status && status >= 400 && status < 500) return text ? { kind: 'other', what: text } : { kind: 'other', what: '処理できませんでした。', how: '入力した内容を確かめて、もう一度お試しください。' }
  return { kind: 'other', what: scene === 'load' ? '読み込めませんでした。' : '処理できませんでした。', how: RETRY_LATER }
}

/** ボタンを押した処理の失敗（新しい見た目）。上限のときは料金プランへの道を出す */
export function ActionError({ error, onRetry }: { error: ShanaiUserError | null; onRetry?: () => void }) {
  if (!error) return null
  if (error.kind === 'limit') return <LimitState what={error.what} how={error.how} />
  if (error.kind === 'auth') {
    return (
      <div className="space-y-3">
        <ErrorNotice what={error.what} how={error.how} />
        <DsButton variant="secondary" href="/auth/signin?callbackUrl=/shanai" icon="DoorOpen">ログインし直す</DsButton>
      </div>
    )
  }
  return <ErrorNotice what={error.what} how={error.how} onRetry={onRetry} />
}

/** 今月の上限に達したとき（新しい見た目）。料金プランへの道を1つ出す */
export function LimitState({ what = '今月の利用上限に達しました。', how = '料金プランを見直すと、続けて使えます。来月になると、また使えるようになります。' }: { what?: string; how?: string }) {
  return (
    <div className="space-y-3">
      <ErrorNotice what={what} how={how} />
      <DsButton variant="secondary" href="/shanai/pricing" icon="CreditCard">料金プランを見る</DsButton>
    </div>
  )
}

/**
 * 画面の読み込みに失敗したとき。
 * 新しい見た目では ds の ErrorNotice（何が起きたか・どうすればよいか・やり直す）。生の文は出さず error（status 付き）から組み立てる。
 * 今までの見た目では、これまで通り message をそのまま出す
 */
export function ErrorState({ message, onRetry, error }: { message?: string; onRetry?: () => void; error?: unknown }) {
  const d = describeError(error, 'load')
  if (d.kind === 'forbidden') return <ForbiddenState />
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <ActionError error={d} onRetry={onRetry} />
    </div>
  )
}

export function ForbiddenState({ backHref = '/shanai' }: { backHref?: string }) {
  // 新しい見た目: ErrorNotice と同じ形（何が起きたか・どうすればよいか）＋戻る道を1つ
  return (
    <div className="mx-auto max-w-3xl space-y-3 px-4 py-8 sm:px-6 sm:py-10">
      <ErrorNotice
        what="このインタビューを表示する権限がありません。"
        how="削除されたか、別のアカウントで作成されたインタビューです。作成した方に共有を依頼するか、管理者にお問い合わせください。"
      />
      <DsButton variant="secondary" href={backHref} icon="List">インタビュー一覧に戻る</DsButton>
    </div>
  )
}

/** AI 生成など長い処理の段階表示。途中で閉じても結果はサーバーに残る */
export function ProgressSteps({ steps, current, note }: { steps: string[]; current: number; note?: string }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-4 rounded-[var(--r)] border border-[var(--blue-line)] bg-[var(--blue-soft)] p-5 sm:flex-row sm:items-start" role="status" aria-live="polite">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/shanai/working.webp" alt="" aria-hidden className="h-24 w-auto shrink-0 mix-blend-multiply" />
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
  const boxRef = useRef<HTMLDivElement>(null)
  // 新しい見た目: 開いたらダイアログに移す（キーボード・読み上げで、いま何を聞かれているかが分かるように）
  useEffect(() => {
    if (open) boxRef.current?.focus()
  }, [open])
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
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shanai-confirm-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-[var(--r)] bg-[var(--paper)] p-6 shadow-[var(--shadow-lg)] focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="shanai-confirm-title" className="text-[18px] font-bold text-[var(--ink)]">
          {title}
        </p>
        {body && <p className="mt-2 text-[14px] font-medium leading-[1.7] text-[var(--sub)]">{body}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
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

/**
 * ページの見出し。共通シェルの中では ToolFrame が h1 を出すので、ここは h2 にする（見出しを1つにする）
 */
export function PageTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  const inShell = useInShanaiShell()
  if (inShell) return <h2 className={`text-[18px] font-bold leading-[1.4] text-[var(--ink)] ${className}`}>{children}</h2>
  return <h1 className={`text-[22px] font-bold leading-[1.3] text-[var(--ink)] sm:text-[28px] ${className}`}>{children}</h1>
}
