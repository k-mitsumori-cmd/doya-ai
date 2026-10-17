'use client'

// ドヤポップアップ 画面の共通部品
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { PopupDto } from '@/lib/popup/dto'
import { KIND_LABEL, LAYOUT_LABEL, STATUS_LABEL, type PopupStatus, type PopupTrigger, type PopupTargeting, type PopupFrequency } from '@/lib/popup/schema'

export const ACCENT = '#ff5a36'

export function CopyButton({ text, label = 'コピー', className = '' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 1800)
    } catch {
      // クリップボードが使えない環境では選択して手でコピーしてもらう
      window.prompt('コピーしてお使いください', text)
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition-colors ${
        done ? 'bg-emerald-600 text-white' : 'bg-[#ff5a36] text-white hover:bg-[#e8482a]'
      } ${className}`}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? 'コピーしました' : label}
    </button>
  )
}

export function StatusBadge({ status }: { status: PopupStatus }) {
  const cls =
    status === 'live'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'paused'
        ? 'bg-slate-100 text-slate-600 border-slate-200'
        : 'bg-amber-50 text-amber-700 border-amber-200'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-black ${cls}`}>
      {status === 'live' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
      {STATUS_LABEL[status]}
    </span>
  )
}

export function KindBadge({ kind }: { kind: PopupDto['kind'] }) {
  return <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-black text-[#d9362b]">{KIND_LABEL[kind]}</span>
}

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

export function StatTile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-black text-slate-500">{label}</p>
      <p className={`mt-0.5 text-2xl font-black tabular-nums ${accent ? 'text-[#e0442c]' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}

export function DaysSwitch({ value, onChange }: { value: number; onChange: (d: 7 | 30 | 90) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 text-xs font-black">
      {([7, 30, 90] as const).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          className={`rounded-lg px-3 py-1.5 ${value === d ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}
        >
          {d}日
        </button>
      ))}
    </div>
  )
}
