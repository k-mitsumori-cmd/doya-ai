'use client'

// ============================================
// サイドバーの「作った数 / 残り」パネル（全サービス共通）
// ============================================
// ⚠️ 数字は /api/usage/[service] から受け取るだけ。ここに上限を書かないこと。
// ⚠️ 読み込めるまで何も描かない。空の枠や 0/0 が一瞬出ると
//    「使い切った」と誤解されるため。
import React, { useEffect, useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'

interface Meter {
  label: string
  used: number
  limit: number | null
}

interface Summary {
  title: string
  unit: string
  total: number | null
  meters: Meter[]
  planLabel: string
}

/** 「今日 1 / 3枚（あと2枚）」の1行。残りが尽きたら赤で知らせる */
function UsageBar({ meter, unit }: { meter: Meter; unit: string }) {
  if (meter.limit == null) return null
  const rest = Math.max(0, meter.limit - meter.used)
  const pct = Math.min(100, Math.round((meter.used / Math.max(1, meter.limit)) * 100))
  const empty = rest === 0
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] font-bold text-white/80">{meter.label}</span>
        <span className="text-[11px] font-black text-white tabular-nums">
          {meter.used} / {meter.limit}
          {unit}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${empty ? 'bg-rose-300' : 'bg-white'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`mt-1 text-[10px] font-bold ${empty ? 'text-rose-200' : 'text-white/70'}`}>
        {empty ? `${meter.label}の枠を使い切りました` : `あと${rest}${unit}使えます`}
      </p>
    </div>
  )
}

/**
 * @param service /api/usage/[service] のサービスID
 * @param refreshEvent 生成完了などで数字を取り直すための window イベント名。
 *                     画面が移動しないまま数字が変わる画面では必ず渡すこと。
 */
export function SidebarUsagePanel({
  service,
  show,
  refreshEvent,
  organizationSlug,
}: {
  service: string
  show: boolean
  refreshEvent?: string
  organizationSlug?: string
}) {
  const requestUrl = `/api/usage/${service}${organizationSlug ? `?org=${encodeURIComponent(organizationSlug)}` : ''}`
  const [loaded, setLoaded] = useState<{ url: string; summary: Summary | null } | null>(null)
  const summary = loaded?.url === requestUrl ? loaded.summary : null

  useEffect(() => {
    let alive = true
    let sequence = 0
    const load = () => {
      const current = ++sequence
      // ⚠️ useSession の status でゲートしない。Cookie認証なので未確定でも応答する
      fetch(requestUrl, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && current === sequence) setLoaded({ url: requestUrl, summary: d?.summary || null })
        })
        .catch(() => {
          if (alive && current === sequence) setLoaded({ url: requestUrl, summary: null })
        })
    }
    load()
    window.addEventListener('focus', load)
    if (refreshEvent) window.addEventListener(refreshEvent, load)
    return () => {
      alive = false
      window.removeEventListener('focus', load)
      if (refreshEvent) window.removeEventListener(refreshEvent, load)
    }
  }, [requestUrl, refreshEvent])

  if (!show || !summary) return null

  const capped = summary.meters.some((m) => m.limit != null)

  return (
    <div className="mx-3 md:mx-4 mt-2 p-3 md:p-4 rounded-xl md:rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md">
      <div className="flex items-center gap-2 mb-3">
        <ImageIcon className="w-4 h-4 text-white/90 flex-shrink-0" />
        <p className="text-xs font-black text-white">{summary.title}</p>
      </div>

      {summary.total != null && (
        <div className="flex items-end gap-1.5 mb-3">
          <span className="text-3xl font-black text-white leading-none tabular-nums">
            {summary.total}
          </span>
          <span className="text-[11px] font-bold text-white/70 pb-0.5">{summary.unit}</span>
        </div>
      )}

      {capped ? (
        <div className="space-y-2.5">
          {summary.meters.map((m) => (
            <UsageBar key={m.label} meter={m} unit={summary.unit} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] font-bold text-white/85 leading-relaxed">
          {summary.planLabel}プランのため<span className="text-white">上限はありません</span>
        </p>
      )}
    </div>
  )
}
