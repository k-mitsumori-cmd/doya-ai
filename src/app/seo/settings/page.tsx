'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BellRing, CreditCard, ArrowRight } from 'lucide-react'
import { readSeoClientSettings, patchSeoClientSettings, type SeoClientSettings } from '@seo/lib/clientSettings'
import { FeatureGuide } from '@/components/FeatureGuide'
import { useSession, signOut } from 'next-auth/react'
import { AccountSummaryCard } from '@/components/AccountSummaryCard'

export default function SeoSettingsPage() {
  const [settings, setSettings] = useState<SeoClientSettings>(() => readSeoClientSettings())
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user?.email

  const planLabel = (() => {
    const seoPlan = String((session?.user as any)?.seoPlan || '').toUpperCase()
    const globalPlan = String((session?.user as any)?.plan || '').toUpperCase()
    const p = seoPlan || globalPlan || (isLoggedIn ? 'FREE' : 'GUEST')
    if (p === 'ENTERPRISE') return 'Enterprise'
    if (p === 'PRO') return 'PRO'
    if (p === 'FREE') return '無料'
    return 'ゲスト'
  })()

  useEffect(() => {
    setSettings(readSeoClientSettings())
  }, [])

  return (
    <main className="max-w-3xl mx-auto py-6 sm:py-8 px-4 sm:px-6">
      <div className="mb-6 sm:mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/seo"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-700 text-xs sm:text-sm mb-2 font-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            戻る
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">設定</h1>
          <p className="text-sm text-gray-500 mt-1">ドヤライティングAIの体験をカスタマイズできます。</p>
        </div>
      </div>

      {/* アカウント情報（最上部） */}
      <div className="mb-6">
        <AccountSummaryCard
          serviceName="ドヤライティングAI"
          planLabel={planLabel}
          isLoggedIn={isLoggedIn}
          user={session?.user || null}
          loginHref="/auth/doyamarke/signin?callbackUrl=/seo/settings"
          onLogout={() => signOut({ callbackUrl: '/seo?loggedOut=1' })}
        />
      </div>

      <div className="mb-6">
        <FeatureGuide
          featureId="seo.settings"
          title="設定の使い方"
          description="通知や演出など、使い勝手に関わる設定を切り替えられます。"
          steps={[
            '「完成！」ポップアップは、記事生成完了の瞬間だけ表示する演出です',
            'ON/OFFはいつでも変更できます（ローカル設定として保存されます）',
          ]}
          imageMode="off"
        />
      </div>

      {/* 料金プラン変更セクション */}
      <div className="bg-white rounded-2xl sm:rounded-[32px] border border-gray-100 shadow-xl shadow-blue-500/5 p-6 sm:p-8 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-black text-gray-900">料金・プラン</h2>
            <p className="text-xs font-bold text-gray-500 mt-1">
              現在のプランの確認やアップグレード、解約の管理ができます。
            </p>
          </div>
        </div>

        <Link
          href="/seo/dashboard/plan"
          className="mt-6 flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50/40 hover:bg-gray-50 transition-colors"
        >
          <div className="flex-1">
            <p className="text-sm font-black text-gray-900">料金プランを確認・変更する</p>
            <p className="text-xs font-bold text-gray-500 mt-1">
              PRO/Enterpriseプランで文字数上限アップ・画像生成が可能になります
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400" />
        </Link>
      </div>

      {/* 通知・ポップアップセクション */}
      <div className="bg-white rounded-2xl sm:rounded-[32px] border border-gray-100 shadow-xl shadow-blue-500/5 p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0">
            <BellRing className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-black text-gray-900">通知・ポップアップ</h2>
            <p className="text-xs font-bold text-gray-500 mt-1">記事が完成した瞬間の「完成！」演出を制御します。</p>
          </div>
        </div>

        <label className="mt-6 flex items-start gap-3 p-4 rounded-2xl border border-gray-100 bg-gray-50/40 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.completionPopupEnabled}
            onChange={(e) => {
              const v = e.target.checked
              const next = patchSeoClientSettings({ completionPopupEnabled: v })
              setSettings(next)
            }}
            className="mt-0.5 h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          <div className="flex-1">
            <p className="text-sm font-black text-gray-900">記事が完成したら「完成！」ポップアップを表示する</p>
            <p className="text-xs font-bold text-gray-500 mt-1">
              ONの場合、生成中に記事ページ/ジョブページを開いているときに、完成の瞬間だけ表示します。
            </p>
          </div>
        </label>
      </div>
    </main>
  )
}


