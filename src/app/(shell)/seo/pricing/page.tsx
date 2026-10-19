'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { getFreeHourRemainingMs, isWithinFreeHour } from '@/lib/pricing'
import { higherPlan } from '@/lib/plan-utils'
import SeoCancelScheduleNotice from '@/components/SeoCancelScheduleNotice'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'
import { Timer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

export default function SeoPricingPage() {
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user?.email
  const tier = isLoggedIn
    ? higherPlan((session?.user as any)?.seoPlan, (session?.user as any)?.plan)
    : 'GUEST'
  const firstLoginAt = (session?.user as any)?.firstLoginAt as string | null | undefined
  const isFreeHourActive = isLoggedIn && isWithinFreeHour(firstLoginAt)
  const [freeHourRemainingMs, setFreeHourRemainingMs] = useState(() => getFreeHourRemainingMs(firstLoginAt))

  const tierLabel = tier === 'GUEST' ? 'ゲスト' : tier === 'FREE' ? '無料' : tier === 'LIGHT' ? 'ライト' : tier === 'PRO' ? 'PRO' : 'Enterprise'

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

  const trialHint = useMemo(() => {
    if (!isLoggedIn) return null
    if (!isFreeHourActive) return null
    const total = 60 * 60 * 1000
    const ratio = Math.max(0, Math.min(1, freeHourRemainingMs / total))
    return (
      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
            <Timer className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-blue-900">初回ログイン後1時間は、PRO相当で使い放題（トライアル）</p>
              <div className="px-2.5 py-1 rounded-full bg-white border border-blue-200 text-blue-800 text-xs font-black tabular-nums flex-shrink-0">
                残り {formatRemainingTime(freeHourRemainingMs)}
              </div>
            </div>
            <p className="mt-1 text-[11px] font-bold text-blue-800/80">
              画像生成や自動修正も解放されます。使えるようになった瞬間は画面に演出が出ます。
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-blue-200/60 overflow-hidden">
              <div className="h-full bg-blue-600" style={{ width: `${ratio * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
    )
  }, [isLoggedIn, isFreeHourActive, freeHourRemainingMs])

  return (
    <div className="min-h-screen bg-white">
      <div className="pt-6 flex items-center justify-center gap-3">
        <Link
          href="/seo"
          className="text-xs font-black text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors px-3 py-2 rounded-full"
        >
          生成記事一覧に戻る
        </Link>
        <Link href="/seo/dashboard/plan" className="text-xs font-black text-blue-600 hover:text-blue-700">
          プラン管理
        </Link>
      </div>

      <main className="max-w-[720px] mx-auto px-4 sm:px-6 pb-12">
        <h1 className="text-center text-3xl sm:text-4xl font-black text-slate-900 mt-6 mb-10">
          ドヤライティングAI 料金プラン
        </h1>

        <div className="mb-6 flex flex-col items-center gap-2">
          <p className="text-sm font-black text-slate-800">現在のプラン：{tierLabel}</p>
          <div className="w-full">
            <SeoCancelScheduleNotice className="max-w-[720px] mx-auto" />
          </div>
          {trialHint}
          {tier !== 'GUEST' && (
            <Link href="/seo/dashboard/plan" className="text-xs font-black text-blue-600 hover:text-blue-800">
              アカウント画面でプラン変更/解約を行う →
            </Link>
          )}
        </div>

        <UnifiedPricingPlans serviceId="seo" className="my-12" />

        <div className="mt-10 flex justify-center">
          {isLoggedIn ? (
            <Link href="/seo/dashboard/plan">
              <button className="px-8 py-4 rounded-full bg-blue-600 text-white font-black text-base hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">
                アカウント画面でプランを管理する
              </button>
            </Link>
          ) : (
            <Link href="/auth/signin">
              <button className="px-8 py-4 rounded-full bg-blue-600 text-white font-black text-base hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">
                ログインして無料プランを始める
              </button>
            </Link>
          )}
        </div>
      </main>
    </div>
  )
}
