'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { AnimatePresence, motion } from 'framer-motion'
import { ExternalLink, Loader2, RefreshCcw, Shield, Sparkles, Timer, X } from 'lucide-react'
import { SEO_PRICING, getFreeHourRemainingMs, isWithinFreeHour } from '@/lib/pricing'
import { higherPlan, tierFrom } from '@/lib/plan-utils'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'
import SeoCancelScheduleNotice from '@/components/SeoCancelScheduleNotice'
import { useSubscriptionManagement } from '@/hooks/useSubscriptionManagement'

function formatRemainingDays(unixSeconds: number) {
  const end = unixSeconds * 1000
  const diff = Math.max(0, end - Date.now())
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000))
  return days
}

export default function SeoPlanPage() {
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user?.email
  const seoPlanRaw = isLoggedIn ? higherPlan((session?.user as any)?.seoPlan, (session?.user as any)?.plan) : 'GUEST'
  const tier = tierFrom(seoPlanRaw)
  const firstLoginAt = (session?.user as any)?.firstLoginAt as string | null | undefined
  const isFreeHourActive = isLoggedIn && isWithinFreeHour(firstLoginAt)
  const [freeHourRemainingMs, setFreeHourRemainingMs] = useState(() => getFreeHourRemainingMs(firstLoginAt))

  const management = useSubscriptionManagement('seo')
  const sub = management.data?.hasSubscription ? management.data : null
  const busy = management.busy
  const error = management.message
  const [cancelConfirmKey, setCancelConfirmKey] = useState<string | null>(null)
  const [resumeConfirmKey, setResumeConfirmKey] = useState<string | null>(null)
  const cancelConfirm = cancelConfirmKey === management.scopeKey
  const resumeConfirm = resumeConfirmKey === management.scopeKey
  const setCancelConfirm = (show: boolean) => setCancelConfirmKey(show ? management.scopeKey : null)
  const setResumeConfirm = (show: boolean) => setResumeConfirmKey(show ? management.scopeKey : null)


  useEffect(() => {
    if (!isFreeHourActive) return
    const interval = setInterval(() => {
      setFreeHourRemainingMs(getFreeHourRemainingMs(firstLoginAt))
    }, 1000)
    return () => clearInterval(interval)
  }, [isFreeHourActive, firstLoginAt])

  const formatRemainingTime = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const cancelAtDays = useMemo(() => {
    if (!sub?.cancelAtPeriodEnd || !sub?.currentPeriodEnd) return null
    return formatRemainingDays(sub.currentPeriodEnd)
  }, [sub?.cancelAtPeriodEnd, sub?.currentPeriodEnd])

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
          <div>
            <Link href="/seo" className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-700 text-xs font-black">
              ← 生成記事一覧に戻る
            </Link>
            <h1 className="mt-3 text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">アカウント（ドヤライティングAI）</h1>
            <p className="mt-2 text-sm text-gray-500 font-bold">
              統一プランの変更・解約・再開をここで行えます。解約・再開は、すべての対象サービスに適用されます。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/seo/pricing" className="h-10 px-4 rounded-xl bg-white border border-gray-200 text-gray-700 font-black text-xs inline-flex items-center gap-2 hover:bg-gray-50">
              <Sparkles className="w-4 h-4" />
              料金プランを見る
            </Link>
            {isLoggedIn && (
              <button
                type="button" disabled={busy} onClick={() => void management.recheck()}
                className="h-10 w-10 rounded-xl bg-white border border-gray-200 text-gray-700 flex items-center justify-center hover:bg-gray-50"
                title="更新"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 初回ログイン後1時間：使い放題カウントダウン */}
        {isLoggedIn && isFreeHourActive && freeHourRemainingMs > 0 && (
          <div className="mb-6 rounded-3xl border border-blue-100 bg-blue-50 px-5 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                  <Timer className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-blue-900 truncate">初回ログイン特典：1時間 使い放題（有料プラン相当）</p>
                  <p className="mt-0.5 text-[11px] font-bold text-blue-800/80 truncate">
                    画像生成・AI自動修正などが解放されています
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">残り</p>
                  <p className="text-base font-black text-blue-900 tabular-nums">{formatRemainingTime(freeHourRemainingMs)}</p>
                </div>
                <div className="w-40 h-2 rounded-full bg-blue-100 overflow-hidden">
                  <div
                    className="h-2 bg-blue-600"
                    style={{ width: `${Math.max(0, Math.min(100, (freeHourRemainingMs / (60 * 60 * 1000)) * 100))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {!isLoggedIn ? (
          <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center">
            <Shield className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <p className="text-lg font-black text-gray-900">ログインが必要です</p>
            <p className="mt-2 text-sm text-gray-500 font-bold">プラン管理はログイン後に利用できます。</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link href="/auth/signin" className="h-11 px-6 rounded-xl bg-blue-600 text-white font-black text-sm inline-flex items-center gap-2 hover:bg-blue-700">
                ログインする <ExternalLink className="w-4 h-4" />
              </Link>
              <Link href="/seo/pricing" className="h-11 px-6 rounded-xl bg-white border border-gray-200 text-gray-700 font-black text-sm hover:bg-gray-50">
                料金を見る
              </Link>
            </div>
          </div>
        ) : (
          <>
            <SeoCancelScheduleNotice className="mb-6" />

            {isFreeHourActive && (
              <div className="mb-6 rounded-3xl border border-blue-100 bg-blue-50 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                    <Timer className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-blue-900">初回ログイン後1時間：有料プラン相当で使い放題（トライアル）</p>
                    <p className="mt-1 text-[11px] font-bold text-blue-800/80">
                      画像生成・自動修正も含めて解放中です。
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-black text-blue-900">残り {formatRemainingTime(freeHourRemainingMs)}</p>
                      <p className="text-[10px] font-bold text-blue-800/70">（1時間）</p>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-blue-200/60 overflow-hidden">
                      <div
                        className="h-full bg-blue-600"
                        style={{ width: `${Math.max(0, Math.min(1, freeHourRemainingMs / (60 * 60 * 1000))) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* 現在のプランカード */}
              <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">現在のプラン</p>
                    <p className="mt-1 text-2xl font-black text-gray-900">
                      {tier === 'PRO' || tier === 'ENTERPRISE' ? 'プロ' : '無料'}
                    </p>
                    <p className="mt-2 text-sm text-gray-500 font-bold">
                      {tier === 'PRO' || tier === 'ENTERPRISE'
                        ? `月${SEO_PRICING.proLimit}記事まで（図解/バナー/自動修正OK）`
                        : `月${SEO_PRICING.freeLimit}記事まで（画像生成はプロから）`}
                    </p>
                  </div>
                  <div className="px-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-gray-700 text-xs font-black">
                    ドヤライティングAI
                  </div>
                </div>

                {error && (
                  <div className="mt-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-xs font-bold p-4">
                    {error}
                    <button type="button" disabled={busy} onClick={() => void management.recheck()} className="block mt-2 underline">契約状態を再確認</button>
                  </div>
                )}
              </div>

              {/* 料金プラン（無料 / プロ） - 統一プラン */}
              <UnifiedPricingPlans serviceId="seo" currentPlan={tier} />

              {/* 解約/再開 - 有料プラン契約中の場合のみ表示 */}
              {(tier === 'LIGHT' || tier === 'PRO' || tier === 'ENTERPRISE') && sub?.hasSubscription && (
                <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8">
                  <p className="text-lg font-black text-gray-900 mb-2">解約・再開</p>
                  <p className="text-sm text-gray-500 font-bold mb-6">
                    解約しても、停止日までは機能が使えます。再開もできます。
                  </p>

                  {/* 解約予約していない場合：解約ボタンを表示 */}
                  {!sub?.cancelAtPeriodEnd && (
                    <button
                      onClick={() => setCancelConfirm(true)}
                      disabled={management.disabled}
                      className="w-full h-12 rounded-2xl bg-red-50 border border-red-100 text-red-700 font-black text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-100 transition-colors"
                    >
                      解約する（次回更新で停止）
                    </button>
                  )}

                  {/* 解約予約済みの場合：再開ボタンを表示 */}
                  {sub?.cancelAtPeriodEnd && (
                    <>
                      <div className="mb-4 rounded-2xl bg-amber-50 border border-amber-100 p-4 text-amber-900">
                        <div className="flex items-start gap-3">
                          <Timer className="w-5 h-5 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-black">解約予約済み - 停止まで残り {cancelAtDays || 0} 日</p>
                            <p className="text-[11px] font-bold text-amber-800/80 mt-1">
                              停止日までは有料プランの機能をご利用いただけます。キャンセルして継続することも可能です。
                            </p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setResumeConfirm(true)}
                        disabled={management.disabled}
                        className="w-full h-12 rounded-2xl bg-emerald-600 text-white font-black text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors"
                      >
                        解約をキャンセルして継続する
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Cancel confirm modal */}
      <AnimatePresence>
        {cancelConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4"
            onClick={() => !busy && setCancelConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative bg-white rounded-3xl p-7 max-w-lg w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setCancelConfirm(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-500">
                <X className="w-5 h-5" />
              </button>
              <div className="text-center">
                <Sparkles className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-2xl font-black text-slate-900 mb-2">解約すると、使える機能が制限されます</h3>
                <p className="text-slate-600 font-bold mb-4">
                  統一プランの解約はすべての対象サービスに適用されます。次回更新日以降、このサービスでは以下の制限が適用されます。
                </p>
                <ul className="text-left text-sm font-bold text-slate-700 space-y-2 mb-6 bg-slate-50 rounded-xl p-4">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">✕</span>
                    <span>図解・バナー画像の生成（サムネイル含む）</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">✕</span>
                    <span>SEO改善提案のAI自動修正</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">✕</span>
                    <span>画像のダウンロード・プロンプト調整・再生成</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">✕</span>
                    <span>記事作成は月{SEO_PRICING.freeLimit}回までに制限</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">✕</span>
                    <span>1記事あたり{SEO_PRICING.charLimit?.free?.toLocaleString()}字までに制限</span>
                  </li>
                </ul>
                <p className="text-xs font-bold text-slate-500 mb-4">
                  ※ 停止日までは現在のプランで引き続きご利用いただけます
                </p>
                <div className="grid gap-3">
                  <button
                    disabled={management.disabled}
                    onClick={async () => {
                      const confirmed = await management.run('cancel')
                      if (confirmed) setCancelConfirm(false)
                    }}
                    className="h-12 rounded-2xl bg-red-600 text-white font-black text-sm hover:bg-red-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    解約する（次回更新で停止）
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setCancelConfirm(false)}
                    className="h-12 rounded-2xl bg-white border border-gray-200 text-gray-700 font-black text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    やめる（継続する）
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resume confirm modal */}
      <AnimatePresence>
        {resumeConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4"
            onClick={() => !busy && setResumeConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative bg-white rounded-3xl p-7 max-w-lg w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setResumeConfirm(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-500">
                <X className="w-5 h-5" />
              </button>
              <div className="text-center">
                <Sparkles className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
                <h3 className="text-2xl font-black text-slate-900 mb-2">解約予約を取り消しますか？</h3>
                <p className="text-slate-600 font-bold mb-6">
                  統一プランの解約予約を取り消すと、すべての対象サービスで次回更新以降もプランが継続します。
                </p>
                <div className="grid gap-3">
                  <button
                    disabled={management.disabled}
                    onClick={async () => {
                      const confirmed = await management.run('resume')
                      if (confirmed) setResumeConfirm(false)
                    }}
                    className="h-12 rounded-2xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    取り消して継続する
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setResumeConfirm(false)}
                    className="h-12 rounded-2xl bg-white border border-gray-200 text-gray-700 font-black text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    閉じる
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  )
}

