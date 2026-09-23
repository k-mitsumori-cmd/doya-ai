'use client'
// ============================================
// 月次生成上限（429 / MONTHLY_LIMIT_REACHED）のアップセルモーダル
// ============================================
// ⚠️ これまで上限到達は toast.error だけで、数秒で消える赤いエラーしか出ていなかった。
//    サーバーは upgradeUrl を返していたのに UI 側が一切使っておらず、
//    「無料枠を使い切った＝一番アップグレードに近い利用者」を取り逃していた（2026-09-17 調査）。
//    ここは離脱の分岐点なので、必ずプランと初月無料を提示してから閉じさせる。
//
// 初月無料の文言・日数は src/components/TrialCallout.tsx（UNIFIED_TRIAL_DAYS）が唯一の真実。
// 再契約者はトライアル対象外なので、TrialBadge / TrialNote 側で自動的に非表示になる。
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Check, X, Rocket, CalendarClock } from 'lucide-react'
import { BANNER_PRICING, HIGH_USAGE_CONTACT_URL } from '@/lib/pricing'
import { TrialBadge, TrialNote, useTrialEligible, TRIAL_DAYS } from '@/components/TrialCallout'

export interface BannerLimitModalProps {
  isOpen: boolean
  onClose: () => void
  /** サーバーの usage.monthlyUsed */
  monthlyUsed?: number
  /** サーバーの usage.monthlyLimit */
  monthlyLimit?: number
  /** サーバーが返したエラーメッセージ（有料プランの上限到達など、文面が変わる場合に使う） */
  message?: string
  /** サーバーが返した導線。未指定ならプラン画面へ */
  upgradeUrl?: string
}

const priceOf = (id: string) => BANNER_PRICING.plans.find((p) => p.id === id)

export default function BannerLimitModal({
  isOpen,
  onClose,
  monthlyUsed,
  monthlyLimit,
  message,
  upgradeUrl,
}: BannerLimitModalProps) {
  const router = useRouter()
  const trialEligible = useTrialEligible()

  const panel = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const close = useRef(onClose)
  close.current = onClose

  // Remember the trigger before an async quota check disables it and moves focus to body.
  useEffect(() => {
    if (isOpen) return
    const remember = () => {
      const element = document.activeElement
      if (element instanceof HTMLElement && element !== document.body) returnFocus.current = element
    }
    remember()
    document.addEventListener('focusin', remember)
    return () => document.removeEventListener('focusin', remember)
  }, [isOpen])

  // ESC and keyboard focus remain inside the modal.
  useEffect(() => {
    if (!isOpen) return
    const previous = returnFocus.current || document.activeElement as HTMLElement | null
    panel.current?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current()
      if (e.key === 'Tab') {
        const buttons = panel.current?.querySelectorAll<HTMLElement>('button, a[href]')
        const first = buttons?.[0], last = buttons?.[buttons.length - 1]
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', handler)
    return () => { window.removeEventListener('keydown', handler); previous?.focus() }
  }, [isOpen])

  if (!isOpen) return null

  const pro = priceOf('banner-pro')

  // すでにPRO相当の枠を使い切っている人にアップグレードを勧めても意味がない。
  // その場合は相談導線だけを出す（サーバー側も upgradeUrl を相談先に切り替えている）。
  const isAtTopPlan = (monthlyLimit ?? 0) >= BANNER_PRICING.proLimit
  const destination = isAtTopPlan ? (HIGH_USAGE_CONTACT_URL || '/banner/pricing') : upgradeUrl?.startsWith('/banner/') ? upgradeUrl : '/banner/pricing'

  const remaining = monthlyUsed != null && monthlyLimit != null ? Math.max(0, monthlyLimit - monthlyUsed) : 0
  const title = remaining > 0 ? `今月はあと${remaining}枚生成できます` : monthlyLimit != null ? `今月の${monthlyLimit}枚を使い切りました` : '今月の生成上限に達しました'

  const usagePercent =
    monthlyUsed != null && monthlyLimit != null && monthlyLimit > 0
      ? Math.min(100, Math.round((monthlyUsed / monthlyLimit) * 100))
      : null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          ref={panel}
          tabIndex={-1}
          className="relative max-h-[90dvh] overflow-y-auto w-full max-w-md rounded-3xl border border-gray-700 bg-gray-900 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/10 to-transparent" />

          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-gray-300 transition-colors hover:bg-white/20"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative p-6 sm:p-7">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30">
              <Sparkles className="h-8 w-8 text-white" />
            </div>

            <h2 className="text-center text-lg font-black text-white sm:text-xl">{title}</h2>
            <p className="mt-2 text-center text-xs leading-relaxed text-gray-300 sm:text-sm">
              {remaining > 0 ? `生成枚数を${remaining}枚以下に減らすか、プランの変更をご検討ください。` : message || '作成済みのバナーは引き続きご利用いただけます。生成枠は来月1日にリセットされます。'}
            </p>

            {usagePercent !== null && (
              <div className="mt-5 rounded-xl border border-gray-700 bg-black/40 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    今月の使用状況
                  </span>
                  <span className="text-xs font-bold text-white">
                    {monthlyUsed} / {monthlyLimit} 枚
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-700">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${usagePercent}%` }}
                    transition={{ delay: 0.25, duration: 0.5, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                  />
                </div>
                <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-gray-400">
                  <CalendarClock className="h-3 w-3" />
                  来月1日にリセットされます
                </p>
              </div>
            )}

            {!isAtTopPlan && (
              <div className="mt-4 space-y-2">
                {pro && (
                  <div className="rounded-xl border border-blue-500/60 bg-gradient-to-r from-blue-600/20 to-purple-600/20 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-white">{pro.name}</p>
                          <TrialBadge tone="dark" />
                        </div>
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-blue-200">
                          <Check className="h-3 w-3 text-blue-300" />月{BANNER_PRICING.proLimit}枚まで生成
                        </p>
                      </div>
                      <p className="ml-3 shrink-0 text-sm font-black text-white">{pro.priceLabel}</p>
                    </div>
                    <TrialNote tone="dark" className="mt-2" />
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 space-y-2">
              <button
                onClick={() => {
                  onClose()
                  if (destination.startsWith('https://')) window.location.assign(destination)
                  else router.push(destination)
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3.5 font-bold text-white shadow-lg shadow-blue-600/30 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Rocket className="h-5 w-5" />
                {isAtTopPlan
                  ? '上限アップを相談する'
                  : trialEligible
                    ? `${TRIAL_DAYS}日間無料でプロを試す`
                    : 'プランをアップグレード'}
              </button>
              <button
                onClick={onClose}
                className="w-full rounded-2xl px-6 py-2.5 text-sm font-bold text-gray-400 transition-colors hover:bg-white/5 hover:text-gray-200"
              >
                後で
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
