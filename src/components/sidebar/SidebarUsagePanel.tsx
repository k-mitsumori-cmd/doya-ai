'use client'

// ============================================
// サイドバーの「作った数 / 残り」パネル（全サービス共通）
// ============================================
// ⚠️ 数字は /api/usage/[service] から受け取るだけ。ここに上限を書かないこと。
// ⚠️ 読み込めるまで何も描かない。空の枠や 0/0 が一瞬出ると
//    「使い切った」と誤解されるため。
import React, { useEffect, useRef, useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { readBillingResponse } from '@/lib/billing-response-client'

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

/** Treat missing/malformed allowance data as unknown, never as unlimited. */
export function parseSidebarUsageSummary(value: unknown): Summary | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  if (body.signedIn !== true || body.error !== undefined || body.code !== undefined) return null
  const summary = body.summary as Summary | undefined
  const text = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max
  const quantity = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER
  if (!summary || Array.isArray(summary) || !text(summary.title, 120) || !text(summary.unit, 16) || !text(summary.planLabel, 60) ||
    (summary.total !== null && (!Number.isSafeInteger(summary.total) || summary.total < 0)) ||
    !Array.isArray(summary.meters) || summary.meters.length < 1 || summary.meters.length > 8) return null
  const labels = new Set<string>()
  for (const meter of summary.meters) {
    if (!meter || !text(meter.label, 60) || labels.has(meter.label) || !quantity(meter.used) ||
      (meter.limit !== null && (!Number.isSafeInteger(meter.limit) || meter.limit < 0))) return null
    labels.add(meter.label)
  }
  return summary
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
  pricingHref,
}: {
  service: string
  show: boolean
  refreshEvent?: string
  organizationSlug?: string | null
  pricingHref?: string
}) {
  const requestUrl = `/api/usage/${service}${organizationSlug ? `?org=${encodeURIComponent(organizationSlug)}` : ''}`
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const user = session?.user as { id?: string; email?: string; plan?: string; bannerPlan?: string; seoPlan?: string } | undefined
  const actor = user?.id || user?.email || ''
  const allowed = status === 'authenticated' && Boolean(actor) && organizationSlug !== null
  const servicePlan = service === 'banner' ? user?.bannerPlan : service === 'seo' ? user?.seoPlan : undefined
  const scope = JSON.stringify([status, actor, user?.plan, servicePlan, pathname, requestUrl, refreshEvent, allowed, organizationSlug])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version])
  const context = useRef(key)
  context.current = key
  const [loaded, setLoaded] = useState<{ key: string; summary: Summary | null } | null>(null)
  const summary = allowed && loaded?.key === key ? loaded.summary : null

  useEffect(() => {
    if (!allowed) return
    let alive = true
    let sequence = 0
    let pending: AbortController | null = null
    const load = (force = false) => {
      if (!alive || context.current !== key || (pending && !force)) return
      pending?.abort()
      const controller = new AbortController()
      pending = controller
      const currentSequence = ++sequence
      const current = () => alive && context.current === key && currentSequence === sequence && !controller.signal.aborted
      setLoaded({ key, summary: null })
      // StrictMode cleanup must finish before the request starts.
      void Promise.resolve().then(async () => {
        if (!current()) return
        try {
          const response = await readBillingResponse(requestUrl, { method: 'GET' }, controller.signal)
          if (current()) setLoaded({ key, summary: response.ok ? parseSidebarUsageSummary(response.data) : null })
        } catch {
          if (current()) setLoaded({ key, summary: null })
        } finally {
          if (pending === controller) pending = null
          controller.abort()
        }
      })
    }
    const focus = () => load()
    const refresh = (event: Event) => {
      // These notifications originate from actor-scoped quota responses.
      if ((refreshEvent === 'banner:usage-changed' || refreshEvent === 'persona:usage-changed') && (event as CustomEvent<{ actor?: string }>).detail?.actor !== actor) return
      if (refreshEvent === 'shodan:usage-changed' || refreshEvent === 'quote:usage-changed') {
        const detail = (event as CustomEvent<{ actor?: string; organizationSlug?: string }>).detail
        if (detail?.actor !== actor || detail.organizationSlug !== organizationSlug) return
      }
      load(true)
    }
    load()
    window.addEventListener('focus', focus)
    if (refreshEvent) window.addEventListener(refreshEvent, refresh)
    return () => {
      alive = false
      pending?.abort()
      window.removeEventListener('focus', focus)
      if (refreshEvent) window.removeEventListener(refreshEvent, refresh)
    }
  }, [allowed, key, requestUrl, refreshEvent, actor, organizationSlug])

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
      {pricingHref && (
        <Link href={pricingHref} className="mt-3 block rounded-lg bg-white px-3 py-2 text-center text-[11px] font-black text-slate-800 hover:bg-slate-100">
          組織のプランと利用枠を確認
        </Link>
      )}
    </div>
  )
}
