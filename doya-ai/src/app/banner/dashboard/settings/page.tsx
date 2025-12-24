'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { User, Mail, Shield, CreditCard, LogOut, AlertTriangle, Check, Loader2 } from 'lucide-react'
import { Toaster, toast } from 'react-hot-toast'
import Link from 'next/link'
import { BANNER_PRICING, HIGH_USAGE_CONTACT_URL } from '@/lib/pricing'
import { CheckoutButton } from '@/components/CheckoutButton'

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelScheduledAt, setCancelScheduledAt] = useState<Date | null>(null)

  const formatJstDateTime = (d: Date) => {
    try {
      return d.toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return d.toISOString()
    }
  }

  const isLoggedIn = !!session?.user?.email
  const bannerPlanRaw = String((session?.user as any)?.bannerPlan || (session?.user as any)?.plan || 'FREE').toUpperCase()
  const bannerPlanTier = (() => {
    const p = bannerPlanRaw
    if (p.includes('ENTERPRISE')) return 'ENTERPRISE' as const
    if (p.includes('PRO') || p.includes('BASIC') || p.includes('STARTER') || p.includes('BUSINESS')) return 'PRO' as const
    if (p.includes('FREE')) return 'FREE' as const
    return 'FREE' as const
  })()
  const isPaidUser = bannerPlanTier === 'PRO' || bannerPlanTier === 'ENTERPRISE'

  // 画面リロードでも「解約停止日時」を見失わないように軽く保持
  useEffect(() => {
    try {
      const raw = localStorage.getItem('banner:cancelScheduledAt')
      if (raw) {
        const d = new Date(raw)
        if (!Number.isNaN(d.getTime())) setCancelScheduledAt(d)
      }
    } catch {}
  }, [])

  const handleCancelSubscription = async () => {
    if (!confirm('本当にプランを解約しますか？\n解約すると、現在の請求期間終了時に無料プランに戻ります。')) return
    setIsCancelling(true)
    setCancelScheduledAt(null)
    try {
      const res = await fetch('/api/stripe/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: 'banner' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '解約に失敗しました')
      const end = data?.currentPeriodEnd ? new Date(Number(data.currentPeriodEnd) * 1000) : null
      if (end && !Number.isNaN(end.getTime())) {
        setCancelScheduledAt(end)
        try {
          localStorage.setItem('banner:cancelScheduledAt', end.toISOString())
        } catch {}
        toast.success(`解約を受け付けました（${formatJstDateTime(end)}に停止 / 日本時間）`)
      } else {
        toast.success('プランの解約をスケジュールしました。現在の請求期間終了後に無料プランに戻ります。')
      }
    } catch (err: any) {
      toast.error(err.message || '解約に失敗しました')
    } finally {
      setIsCancelling(false)
    }
  }

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Toaster position="top-center" />
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900">設定</h1>
          <p className="text-sm text-slate-500 font-bold mt-1">アカウント情報とプランの管理</p>
        </div>

        {/* アカウント情報 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-blue-600" />
            アカウント情報
          </h2>
          {isLoggedIn ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center overflow-hidden border border-blue-200">
                  {session?.user?.image ? (
                    <img src={session.user.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-blue-600" />
                  )}
                </div>
                <div>
                  <p className="text-lg font-black text-slate-900">{session?.user?.name || 'ユーザー'}</p>
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {session?.user?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/banner' })}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-black text-sm hover:bg-slate-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                ログアウト
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-500 font-bold mb-4">ログインしていません</p>
              <Link
                href="/auth/doyamarke/signin?callbackUrl=/banner/dashboard/settings"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 transition-colors"
              >
                ログイン
              </Link>
            </div>
          )}
        </section>

        {/* 現在のプラン */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-blue-600" />
            現在のプラン
          </h2>
          <div className="flex items-center gap-4 mb-6">
            <div className={`px-4 py-2 rounded-xl font-black text-sm ${
              bannerPlanTier === 'ENTERPRISE' ? 'bg-purple-100 text-purple-800' :
              bannerPlanTier === 'PRO' ? 'bg-blue-100 text-blue-800' :
              'bg-slate-100 text-slate-600'
            }`}>
              {bannerPlanTier === 'ENTERPRISE' ? 'Enterprise' : bannerPlanTier === 'PRO' ? 'PRO' : isLoggedIn ? '無料' : 'ゲスト'}
            </div>
            <p className="text-sm text-slate-600 font-bold">
              1日{bannerPlanTier === 'ENTERPRISE' ? BANNER_PRICING.enterpriseLimit || 500 : bannerPlanTier === 'PRO' ? BANNER_PRICING.proLimit : isLoggedIn ? BANNER_PRICING.freeLimit : BANNER_PRICING.guestLimit}枚まで生成可能
            </p>
          </div>

          {/* プラン一覧 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ゲスト/無料 */}
            <div className={`rounded-xl border p-4 ${bannerPlanTier === 'FREE' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
              <p className="text-xs font-black text-slate-500">ログイン</p>
              <p className="text-lg font-black text-slate-900">無料プラン</p>
              <p className="text-sm font-black text-slate-700 mt-1">¥0</p>
              <p className="text-[11px] text-slate-500 font-bold mt-2 leading-relaxed">
                ゲスト：1日{BANNER_PRICING.guestLimit}枚<br/>
                ログイン：1日{BANNER_PRICING.freeLimit}枚<br/>
                サイズ：1080×1080固定
              </p>
              {bannerPlanTier === 'FREE' && (
                <p className="mt-3 text-xs font-black text-blue-600 flex items-center gap-1">
                  <Check className="w-4 h-4" /> 現在のプラン
                </p>
              )}
            </div>

            {/* PRO */}
            <div className={`rounded-xl border p-4 ${bannerPlanTier === 'PRO' ? 'border-blue-500 bg-blue-900 text-white' : 'border-slate-900 bg-slate-900 text-white'}`}>
              <p className="text-xs font-black text-white/70">PRO</p>
              <p className="text-lg font-black">プロプラン</p>
              <p className="text-sm font-black mt-1">月額 ¥9,980</p>
              <p className="text-[11px] text-white/80 font-bold mt-2 leading-relaxed">
                1日{BANNER_PRICING.proLimit}枚まで<br/>
                サイズ指定可能<br/>
                最大10枚同時生成
              </p>
              {bannerPlanTier === 'PRO' ? (
                <p className="mt-3 text-xs font-black text-blue-300 flex items-center gap-1">
                  <Check className="w-4 h-4" /> 現在のプラン
                </p>
              ) : bannerPlanTier !== 'ENTERPRISE' && (
                <div className="mt-3">
                  <CheckoutButton planId="banner-pro" loginCallbackUrl="/banner/dashboard/settings" className="w-full py-2 rounded-lg text-xs" variant="secondary">
                    PROを始める
                  </CheckoutButton>
                </div>
              )}
            </div>

            {/* Enterprise */}
            <div className={`rounded-xl border p-4 ${bannerPlanTier === 'ENTERPRISE' ? 'border-purple-500 bg-purple-50' : 'border-slate-200 bg-white'}`}>
              <p className="text-xs font-black text-slate-500">Enterprise</p>
              <p className="text-lg font-black text-slate-900">エンタープライズ</p>
              <p className="text-sm font-black text-slate-700 mt-1">月額 ¥49,800</p>
              <p className="text-[11px] text-slate-500 font-bold mt-2 leading-relaxed">
                1日{BANNER_PRICING.enterpriseLimit || 500}枚まで<br/>
                大量生成・チーム向け<br/>
                優先サポート
              </p>
              {bannerPlanTier === 'ENTERPRISE' ? (
                <p className="mt-3 text-xs font-black text-purple-600 flex items-center gap-1">
                  <Check className="w-4 h-4" /> 現在のプラン
                </p>
              ) : (
                <div className="mt-3">
                  <CheckoutButton planId="banner-enterprise" loginCallbackUrl="/banner/dashboard/settings" className="w-full py-2 rounded-lg text-xs">
                    {bannerPlanTier === 'PRO' ? 'アップグレード' : 'Enterpriseを始める'}
                  </CheckoutButton>
                </div>
              )}
            </div>
          </div>

          {/* さらに上限UP */}
          <div className="mt-4 text-center">
            <a
              href={HIGH_USAGE_CONTACT_URL}
              target={HIGH_USAGE_CONTACT_URL.startsWith('http') ? '_blank' : undefined}
              rel={HIGH_USAGE_CONTACT_URL.startsWith('http') ? 'noreferrer' : undefined}
              className="text-xs font-black text-slate-500 hover:text-slate-700"
            >
              さらに上限UPの相談 →
            </a>
          </div>
        </section>

        {/* プラン解約 */}
        {isPaidUser && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h2 className="text-lg font-black text-red-800 flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5" />
              プランの解約
            </h2>
            <p className="text-sm text-red-700 font-bold mb-4">
              解約すると、現在の請求期間終了時に無料プランに戻ります。<br/>
              解約後も請求期間終了まではPRO/Enterpriseの機能をご利用いただけます。
            </p>
            <button
              onClick={handleCancelSubscription}
              disabled={isCancelling}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white font-black text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isCancelling && <Loader2 className="w-4 h-4 animate-spin" />}
              プランを解約する
            </button>

            {/* 停止日時の固定表示（わかりやすく） */}
            {cancelScheduledAt && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-black text-amber-900">
                  解約受付済み：<span className="underline">{formatJstDateTime(cancelScheduledAt)}</span> に停止（日本時間）
                </p>
                <p className="mt-1 text-[11px] font-bold text-amber-800">
                  ※ 停止日時まではプロプラン機能をご利用いただけます（Stripeの仕様上「次回更新日で停止」です）
                </p>
              </div>
            )}
          </section>
        )}

        {/* プライバシーポリシー等 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-blue-600" />
            利用規約・プライバシー
          </h2>
          <div className="space-y-2">
            <Link href="/privacy" className="block text-sm font-black text-blue-600 hover:text-blue-800">
              プライバシーポリシー
            </Link>
            <Link href="/terms" className="block text-sm font-black text-blue-600 hover:text-blue-800">
              利用規約
            </Link>
          </div>
        </section>

        {/* フッター情報 */}
        <footer className="text-center text-xs text-slate-400 font-bold py-8">
          <p>© 2025 株式会社スリスタ</p>
          <p className="mt-1">お問い合わせ: 後日記載予定</p>
        </footer>
      </div>
    </DashboardLayout>
  )
}

