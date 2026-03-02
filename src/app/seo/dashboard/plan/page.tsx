'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Crown, ExternalLink, Loader2, RefreshCcw, Shield, Sparkles, Timer, X, Zap, Image, Wand2, FileText, LayoutDashboard } from 'lucide-react'
import { SEO_PRICING, getFreeHourRemainingMs, isWithinFreeHour } from '@/lib/pricing'
import { CheckoutButton } from '@/components/CheckoutButton'
import SeoCancelScheduleNotice from '@/components/SeoCancelScheduleNotice'
import confetti from 'canvas-confetti'

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
  const firstLoginAt = (session?.user as any)?.firstLoginAt as string | null | undefined
  const isFreeHourActive = isLoggedIn && isWithinFreeHour(firstLoginAt)
  const [freeHourRemainingMs, setFreeHourRemainingMs] = useState(() => getFreeHourRemainingMs(firstLoginAt))

  const [sub, setSub] = useState<SubStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [resumeConfirm, setResumeConfirm] = useState(false)
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [welcomePlan, setWelcomePlan] = useState<string>('')

  // URLパラメータからプランアップグレード成功を検出
  useEffect(() => {
    const url = new URL(window.location.href)
    const success = url.searchParams.get('success') === 'true'
    const plan = String(url.searchParams.get('plan') || '')
    const sessionId = url.searchParams.get('session_id')
    
    if (!success || !plan) return
    
    // 同じセッションで複数回表示しないようにする
    const key = `doyaSeo.welcome.shown.${sessionId || plan}`
    try {
      if (window.sessionStorage.getItem(key)) return
      window.sessionStorage.setItem(key, '1')
    } catch {
      // ignore
    }
    
    // 紙吹雪アニメーション
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981'],
      })
    } catch {
      // confetti未対応の場合はスキップ
    }
    
    setWelcomePlan(plan)
    setWelcomeOpen(true)
    
    // URLからパラメータを削除（履歴に残さない）
    url.searchParams.delete('success')
    url.searchParams.delete('plan')
    url.searchParams.delete('session_id')
    window.history.replaceState({}, '', url.pathname + url.search)
  }, [])

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

        {/* 初回ログイン後1時間：使い放題カウントダウン */}
        {isLoggedIn && isFreeHourActive && freeHourRemainingMs > 0 && (
          <div className="mb-6 rounded-3xl border border-blue-100 bg-blue-50 px-5 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                  <Timer className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-blue-900 truncate">初回ログイン特典：1時間 使い放題（PRO相当）</p>
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
                    <p className="text-sm font-black text-blue-900">初回ログイン後1時間：PRO相当で使い放題（トライアル）</p>
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
                      {tier === 'FREE' ? 'フリー' : tier === 'PRO' ? 'PRO' : tier === 'ENTERPRISE' ? 'Enterprise' : 'ゲスト'}
                    </p>
                    <p className="mt-2 text-sm text-gray-500 font-bold">
                      {tier === 'FREE'
                        ? `1日${SEO_PRICING.freeLimit}記事まで（画像生成はPROから）`
                        : tier === 'PRO'
                        ? `1日${SEO_PRICING.proLimit}記事まで（図解/バナー/自動修正OK）`
                        : tier === 'ENTERPRISE'
                        ? `1日${SEO_PRICING.enterpriseLimit || 30}記事まで（大規模運用）`
                        : '1日1記事まで（5,000字）'}
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
              </div>

              {/* 🔥 アップグレード訴求 - フリーの下に配置して目立たせる */}
              {(tier === 'FREE' || tier === 'GUEST') && (
                <div className="rounded-3xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6 sm:p-8 shadow-lg shadow-blue-100/50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-200">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-lg font-black text-blue-900">PROにアップグレードすると</p>
                      <p className="text-xs font-bold text-blue-700/80">以下の機能がすべて使えます！</p>
                    </div>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-3 mt-5">
                    {[
                      { icon: Image, text: '図解/バナー自動生成', desc: '記事内容に合わせてAIが画像作成' },
                      { icon: Wand2, text: 'AI自動修正', desc: 'SEO改善提案をワンクリック適用' },
                      { icon: RefreshCcw, text: '画像の再生成', desc: 'プロンプト調整で何度でもリトライ' },
                      { icon: FileText, text: `1日${SEO_PRICING.proLimit}記事`, desc: '大量のコンテンツ制作に対応' },
                    ].map((item) => (
                      <div key={item.text} className="flex items-start gap-3 bg-white rounded-2xl p-4 border border-blue-100">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <item.icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-gray-900">{item.text}</p>
                          <p className="text-[11px] font-bold text-gray-500 mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 grid sm:grid-cols-2 gap-3">
                    <CheckoutButton planId="seo-pro" loginCallbackUrl="/seo/dashboard/plan" className="w-full py-4 rounded-2xl text-base font-black shadow-lg shadow-blue-200" variant="primary">
                      <Sparkles className="w-5 h-5 mr-2" /> PROを始める（月額¥9,980）
                    </CheckoutButton>
                    <CheckoutButton planId="seo-enterprise" loginCallbackUrl="/seo/dashboard/plan" className="w-full py-4 rounded-2xl text-sm">
                      <Crown className="w-4 h-4 mr-2" /> Enterpriseを始める
                    </CheckoutButton>
                  </div>
                </div>
              )}

              {tier === 'PRO' && (
                <div className="rounded-3xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-6 sm:p-8 shadow-lg shadow-purple-100/50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-200">
                      <Crown className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-lg font-black text-purple-900">Enterpriseにアップグレードすると</p>
                      <p className="text-xs font-bold text-purple-700/80">さらに大規模な運用が可能に！</p>
                    </div>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-3 mt-5">
                    {[
                      { text: `1日${SEO_PRICING.enterpriseLimit || 30}記事`, desc: '大量の記事を毎日生成可能' },
                      { text: '優先サポート', desc: '専任担当が迅速に対応' },
                      { text: 'チーム利用', desc: '複数アカウントで連携' },
                      { text: 'API連携', desc: 'カスタム開発・外部連携' },
                    ].map((item) => (
                      <div key={item.text} className="flex items-start gap-3 bg-white rounded-2xl p-4 border border-purple-100">
                        <CheckCircle2 className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-black text-gray-900">{item.text}</p>
                          <p className="text-[11px] font-bold text-gray-500 mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6">
                    <CheckoutButton planId="seo-enterprise" loginCallbackUrl="/seo/dashboard/plan" className="w-full py-4 rounded-2xl text-base font-black bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-200">
                      <Crown className="w-5 h-5 mr-2" /> Enterpriseを始める
                    </CheckoutButton>
                  </div>
                </div>
              )}

              {tier === 'ENTERPRISE' && (
                <div className="rounded-3xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 sm:p-8 shadow-lg shadow-emerald-100/50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
                      <Crown className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-lg font-black text-emerald-900">Enterprise（最上位プラン）</p>
                      <p className="text-xs font-bold text-emerald-700/80">すべての機能が使い放題です！</p>
                    </div>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-3 mt-5">
                    {[
                      { text: '図解/バナー自動生成', desc: '記事に合わせてAIが画像作成' },
                      { text: 'AI自動修正', desc: 'SEO改善提案をワンクリック適用' },
                      { text: `1日${SEO_PRICING.enterpriseLimit || 30}記事`, desc: '大量のコンテンツ制作に対応' },
                      { text: '優先サポート・API連携', desc: '専任担当＋カスタム開発対応' },
                    ].map((item) => (
                      <div key={item.text} className="flex items-start gap-3 bg-white rounded-2xl p-4 border border-emerald-100">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-black text-gray-900">{item.text}</p>
                          <p className="text-[11px] font-bold text-gray-500 mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 解約/再開 - 有料プラン契約中の場合のみ表示 */}
              {(tier === 'PRO' || tier === 'ENTERPRISE') && sub?.hasSubscription && (
                <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8">
                  <p className="text-lg font-black text-gray-900 mb-2">解約・再開</p>
                  <p className="text-sm text-gray-500 font-bold mb-6">
                    解約しても、停止日までは機能が使えます。再開もできます。
                  </p>

                  {/* 解約予約していない場合：解約ボタンを表示 */}
                  {!sub?.cancelAtPeriodEnd && (
                    <button
                      onClick={() => setCancelConfirm(true)}
                      disabled={busy}
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
                              停止日まではPRO/Enterpriseの機能をご利用いただけます。キャンセルして継続することも可能です。
                            </p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setResumeConfirm(true)}
                        disabled={busy}
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
                  次回更新日以降、以下の機能が利用できなくなります。
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
                    <span>1日の生成上限が1記事に制限</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">✕</span>
                    <span>文字数上限が5,000字に制限</span>
                  </li>
                </ul>
                <p className="text-xs font-bold text-slate-500 mb-4">
                  ※ 停止日までは現在のプランで引き続きご利用いただけます
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

      {/* Welcome / Upgrade Success Modal */}
      <AnimatePresence>
        {welcomeOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setWelcomeOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="relative bg-gradient-to-br from-white to-blue-50 rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-blue-100"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setWelcomeOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center">
                {/* アイコンとタイトル */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', damping: 15 }}
                  className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white mx-auto mb-6 flex items-center justify-center shadow-lg shadow-blue-200"
                >
                  <Zap className="w-10 h-10" />
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">
                    🎉 {welcomePlan === 'enterprise' ? 'Enterprise' : 'PRO'}プランが有効になりました！
                  </h3>
                  <p className="text-slate-600 font-bold">
                    すべての機能が解放されました。早速使ってみましょう！
                  </p>
                </motion.div>

                {/* 解放された機能一覧 */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-6 bg-white rounded-2xl p-5 border border-slate-100 text-left"
                >
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                    解放された機能
                  </p>
                  <div className="space-y-3">
                    {[
                      { icon: Image, text: '図解/バナー自動生成', desc: '記事に合わせてAIが画像を自動生成' },
                      { icon: Wand2, text: 'AI自動修正', desc: 'SEO改善提案をワンクリックで適用' },
                      { icon: FileText, text: `1日${welcomePlan === 'enterprise' ? SEO_PRICING.enterpriseLimit || 30 : SEO_PRICING.proLimit}記事まで生成`, desc: '大量のコンテンツ制作に対応' },
                      { icon: LayoutDashboard, text: '進捗UI（分割生成）', desc: 'リアルタイムで生成状況を確認' },
                    ].map((item, i) => (
                      <motion.div
                        key={item.text}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                        className="flex items-start gap-3"
                      >
                        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <item.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900">{item.text}</p>
                          <p className="text-xs text-slate-500 font-bold">{item.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* アクションボタン */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="mt-6 grid gap-3"
                >
                  <Link href="/seo/create">
                    <button className="w-full h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-base hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      新しい記事を作成する
                    </button>
                  </Link>
                  <button
                    onClick={() => setWelcomeOpen(false)}
                    className="w-full h-12 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-colors"
                  >
                    閉じる
                  </button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


