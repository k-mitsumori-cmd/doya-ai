'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Crown, ExternalLink, Loader2, RefreshCcw, Shield, Sparkles, Timer, X } from 'lucide-react'
import { SEO_PRICING } from '@/lib/pricing'
import { CheckoutButton } from '@/components/CheckoutButton'
import SeoCancelScheduleNotice from '@/components/SeoCancelScheduleNotice'

type SubStatus = {
  ok?: boolean
  hasSubscription?: boolean
  cancelAtPeriodEnd?: boolean
  currentPeriodEnd?: number
  status?: string
  planId?: string | null
  error?: string
}

function tierFrom(raw: any) {
  const p = String(raw || '').toUpperCase()
  if (!p || p === 'GUEST') return 'GUEST' as const
  if (p.includes('ENTERPRISE')) return 'ENTERPRISE' as const
  if (p.includes('PRO')) return 'PRO' as const
  return 'FREE' as const
}

function formatRemainingDays(unixSeconds: number) {
  const end = unixSeconds * 1000
  const diff = Math.max(0, end - Date.now())
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000))
  return days
}

export default function SeoPlanPage() {
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user?.email
  const seoPlanRaw = String((session?.user as any)?.seoPlan || (isLoggedIn ? 'FREE' : 'GUEST')).toUpperCase()
  const tier = tierFrom(seoPlanRaw)

  const [sub, setSub] = useState<SubStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [resumeConfirm, setResumeConfirm] = useState(false)

  async function loadStatus() {
    if (!isLoggedIn) return
    setError(null)
    try {
      const res = await fetch('/api/stripe/subscription/status?serviceId=seo', { cache: 'no-store' })
      const json = (await res.json().catch(() => ({}))) as SubStatus
      setSub(res.ok ? json : { error: json?.error || 'failed' })
    } catch (e: any) {
      setSub({ error: e?.message || 'failed' })
    }
  }

  useEffect(() => {
    void loadStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])

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
              プランの変更・解約・再開をここで行えます（ドヤバナーAIとは別契約です）
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/seo/pricing" className="h-10 px-4 rounded-xl bg-white border border-gray-200 text-gray-700 font-black text-xs inline-flex items-center gap-2 hover:bg-gray-50">
              <Sparkles className="w-4 h-4" />
              料金プランを見る
            </Link>
            {isLoggedIn && (
              <button
                onClick={() => loadStatus()}
                className="h-10 w-10 rounded-xl bg-white border border-gray-200 text-gray-700 flex items-center justify-center hover:bg-gray-50"
                title="更新"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

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

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">現在のプラン</p>
                      <p className="mt-1 text-2xl font-black text-gray-900">
                        {tier === 'FREE' ? 'フリー' : tier === 'PRO' ? 'PRO' : tier === 'ENTERPRISE' ? 'Enterprise' : 'ゲスト'}
                      </p>
                      <p className="mt-2 text-sm text-gray-500 font-bold">
                        {tier === 'FREE'
                          ? `1日${SEO_PRICING.freeLimit}記事まで（画像生成はPROから）`
                          : tier === 'PRO'
                          ? `1日${SEO_PRICING.proLimit}記事まで（図解/バナー/自動修正OK）`
                          : `1日${SEO_PRICING.enterpriseLimit || 30}記事まで（大規模運用）`}
                      </p>
                    </div>
                    <div className="px-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-gray-700 text-xs font-black">
                      ドヤライティングAI
                    </div>
                  </div>

                  {error && (
                    <div className="mt-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-xs font-bold p-4">
                      {error}
                    </div>
                  )}

                  <div className="mt-6 grid sm:grid-cols-2 gap-3">
                    {tier !== 'PRO' && tier !== 'ENTERPRISE' && (
                      <CheckoutButton planId="seo-pro" loginCallbackUrl="/seo/dashboard/plan" className="w-full py-3 rounded-2xl text-sm" variant="primary">
                        PROへアップグレード
                      </CheckoutButton>
                    )}
                    {tier !== 'ENTERPRISE' && (
                      <CheckoutButton planId="seo-enterprise" loginCallbackUrl="/seo/dashboard/plan" className="w-full py-3 rounded-2xl text-sm">
                        Enterpriseへアップグレード
                      </CheckoutButton>
                    )}
                  </div>
                </div>

                {/* 解約/再開 */}
                <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8">
                  <p className="text-lg font-black text-gray-900 mb-2">解約・再開</p>
                  <p className="text-sm text-gray-500 font-bold mb-6">
                    解約しても、停止日までは機能が使えます。再開もできます。
                  </p>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => setCancelConfirm(true)}
                      disabled={busy || tier === 'FREE'}
                      className="h-12 rounded-2xl bg-red-50 border border-red-100 text-red-700 font-black text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      解約する（次回更新で停止）
                    </button>
                    <button
                      onClick={() => setResumeConfirm(true)}
                      disabled={busy || !sub?.cancelAtPeriodEnd}
                      className="h-12 rounded-2xl bg-emerald-600 text-white font-black text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      解約予約を取り消す（再開）
                    </button>
                  </div>

                  {cancelAtDays != null && (
                    <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-100 p-4 text-amber-900">
                      <div className="flex items-start gap-3">
                        <Timer className="w-5 h-5 mt-0.5" />
                        <div>
                          <p className="text-sm font-black">停止まで残り {cancelAtDays} 日</p>
                          <p className="text-[11px] font-bold text-amber-800/80 mt-1">
                            停止日まではPRO/Enterpriseの機能をご利用いただけます。
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-3xl border border-gray-100 bg-white p-6">
                  <p className="text-sm font-black text-gray-900 flex items-center gap-2">
                    <Crown className="w-4 h-4 text-blue-600" />
                    PROで解放される機能
                  </p>
                  <div className="mt-4 space-y-2 text-sm font-bold text-gray-700">
                    {[
                      '図解/バナー生成（記事に合わせて自動）',
                      'SEO改善提案のAI自動修正',
                      '画像の再生成・プロンプト調整',
                      '運用に耐える進捗UI（分割生成）',
                    ].map((t) => (
                      <div key={t} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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
                <p className="text-slate-600 font-bold mb-6">
                  図解生成・AI自動修正などが停止します。停止日までは利用できます。
                </p>
                <div className="grid gap-3">
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true)
                      setError(null)
                      try {
                        const res = await fetch('/api/stripe/subscription/cancel', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ serviceId: 'seo' }),
                        })
                        const json = await res.json().catch(() => ({}))
                        if (!res.ok) throw new Error(json?.error || '解約に失敗しました')
                        await loadStatus()
                        setCancelConfirm(false)
                      } catch (e: any) {
                        setError(e?.message || '解約に失敗しました')
                      } finally {
                        setBusy(false)
                      }
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
                  取り消すと、次回更新で停止せず継続します。
                </p>
                <div className="grid gap-3">
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true)
                      setError(null)
                      try {
                        const res = await fetch('/api/stripe/subscription/resume', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ serviceId: 'seo' }),
                        })
                        const json = await res.json().catch(() => ({}))
                        if (!res.ok) throw new Error(json?.error || '再開に失敗しました')
                        await loadStatus()
                        setResumeConfirm(false)
                      } catch (e: any) {
                        setError(e?.message || '再開に失敗しました')
                      } finally {
                        setBusy(false)
                      }
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


