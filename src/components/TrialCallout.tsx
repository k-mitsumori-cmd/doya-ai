'use client'
// ============================================
// 初月無料（30日トライアル）訴求の単一ソースUI
// 文言・日数は src/lib/unified-plan.ts の UNIFIED_TRIAL_DAYS を唯一の真実として参照する。
// 料金ページ・ペイウォール・アップセルなど全箇所でこのコンポーネントを使い、デザインを統一する。
//
// 表示の出し分け: 「再契約者(過去にサブスク履歴のある既存顧客=トライアル対象外)」には訴求を出さない。
// /api/stripe/trial-eligibility で eligibility を判定し、対象外なら各UIは何も描画しない。
// 既定は非表示（false）にし、対象だと確定したときだけ表示する。これにより既存顧客に一瞬でも
// 「初月無料」が出ることを防ぐ（サーバの fail-closed と整合）。新規/未ログインは確定後すぐ表示される。
// ============================================
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Gift, Sparkles } from 'lucide-react'
import { UNIFIED_TRIAL_DAYS } from '@/lib/unified-plan'

const BRAND = '#7f19e6'

export const TRIAL_DAYS = UNIFIED_TRIAL_DAYS
export const TRIAL_LABEL = `${UNIFIED_TRIAL_DAYS}日間無料`
export const TRIAL_HEADLINE = `初月無料・${UNIFIED_TRIAL_DAYS}日間0円ではじめる`
export const TRIAL_SUBTEXT = `期間中はいつでも解約でき、料金は一切かかりません。`

type Tone = 'light' | 'dark'

// Cache only confirmed responses, scoped to account and plan. Unknown eligibility stays hidden.
const eligibilityCache = new Map<string, { value: boolean; expires: number }>()
const eligibilityRequests = new Map<string, Promise<boolean>>()
function fetchEligibility(key: string): Promise<boolean> {
  const cached = eligibilityCache.get(key)
  if (cached && cached.expires > Date.now()) return Promise.resolve(cached.value)
  const pending = eligibilityRequests.get(key)
  if (pending) return pending
  const request = fetch('/api/stripe/trial-eligibility', { cache: 'no-store' })
    .then(async (r) => {
      if (!r.ok) return false
      const data = await r.json()
      const value = data?.eligible === true
      eligibilityCache.set(key, { value, expires: Date.now() + 60000 })
      return value
    })
    .catch(() => false)
    .finally(() => eligibilityRequests.delete(key))
  eligibilityRequests.set(key, request)
  return request
}

export function useTrialEligible(): boolean {
  const { data: session, status } = useSession()
  const user = session?.user as { id?: string; email?: string; plan?: string } | undefined
  const key = status === 'loading' ? '' : status === 'authenticated' ? `${user?.id || user?.email}:${user?.plan}` : 'guest'
  const [result, setResult] = useState<{ key: string; eligible: boolean }>({ key: '', eligible: false })
  useEffect(() => {
    if (!key) return
    let mounted = true
    fetchEligibility(key).then((eligible) => { if (mounted) setResult({ key, eligible }) })
    return () => { mounted = false }
  }, [key])
  return !!key && result.key === key && result.eligible
}

/**
 * 価格ブロックの横に置く小さなピル。「初月無料」。
 * tone='dark'（濃色カード上）はアンバー、'light'（白背景）はブランド紫。
 */
export function TrialBadge({ tone = 'light', className = '' }: { tone?: Tone; className?: string }) {
  const eligible = useTrialEligible()
  if (!eligible) return null
  const style =
    tone === 'dark'
      ? 'bg-amber-400 text-amber-950'
      : 'bg-violet-100 text-violet-700 ring-1 ring-violet-200'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black ${style} ${className}`}>
      <Gift className="h-3 w-3" />
      初月無料
    </span>
  )
}

/** 1行の注記。「今なら30日間無料。期間中いつでも解約できます。」 */
export function TrialNote({ tone = 'light', className = '' }: { tone?: Tone; className?: string }) {
  const eligible = useTrialEligible()
  if (!eligible) return null
  const color = tone === 'dark' ? 'text-amber-200' : 'text-violet-600'
  return (
    <p className={`text-[11px] font-bold leading-relaxed ${color} ${className}`}>
      今なら{UNIFIED_TRIAL_DAYS}日間無料。{TRIAL_SUBTEXT}
    </p>
  )
}

/** サイドバー等の価格テキスト末尾に添える小さな「・初月無料」。対象外なら何も出さない。 */
export function TrialInlineSuffix({ className = '' }: { className?: string }) {
  const eligible = useTrialEligible()
  if (!eligible) return null
  return <span className={className}>・初月無料</span>
}

/**
 * ペイウォール／アップセルの上部に置く目立つ訴求バナー。
 * 「有料機能を30日間無料でお試しいただけます」。
 */
export function TrialCallout({ className = '' }: { className?: string }) {
  const eligible = useTrialEligible()
  if (!eligible) return null
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${className}`}
      style={{ borderColor: `${BRAND}33`, background: `${BRAND}0f` }}
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white"
        style={{ background: BRAND }}
      >
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black" style={{ color: BRAND }}>
          有料機能を{UNIFIED_TRIAL_DAYS}日間無料でお試し
        </p>
        <p className="text-[11px] font-bold text-gray-500">
          初月0円。{TRIAL_SUBTEXT}
        </p>
      </div>
    </div>
  )
}
