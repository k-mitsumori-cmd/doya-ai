'use client'

// ドヤ社内インタビュー 画面の共通部品
import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export const ACCENT = '#c026d3'

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
        done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700'
      }`}
    >
      {done && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
      {STATUS_LABEL[status] || status}
    </span>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 ${className}`}>{children}</div>
}

export function SectionTitle({ step, title, desc }: { step?: string; title: string; desc?: string }) {
  return (
    <div className="mb-4">
      {step && <p className="text-[11px] font-black tracking-wide text-fuchsia-600">{step}</p>}
      <h2 className="text-lg font-black text-slate-900">{title}</h2>
      {desc && <p className="mt-1 text-sm font-bold leading-relaxed text-slate-500">{desc}</p>}
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
      ? 'bg-[#c026d3] text-white hover:bg-[#a21caf] disabled:bg-slate-300'
      : variant === 'danger'
        ? 'bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 disabled:text-slate-300'
        : variant === 'ghost'
          ? 'text-slate-600 hover:bg-slate-100 disabled:text-slate-300'
          : 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 disabled:text-slate-300'
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-black transition-colors disabled:cursor-not-allowed ${cls} ${className}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-black text-slate-600">{label}</span>
      {hint && <span className="ml-2 text-[11px] font-bold text-slate-400">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  )
}

export const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-100'

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error'; children: ReactNode }) {
  const cls =
    tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-fuchsia-100 bg-fuchsia-50 text-fuchsia-800'
  return <div className={`rounded-xl border px-4 py-3 text-sm font-bold leading-relaxed ${cls}`}>{children}</div>
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
