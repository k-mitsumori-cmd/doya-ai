'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CreditCard, ArrowRight, Settings, Crown, Zap } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { AccountSummaryCard } from '@/components/AccountSummaryCard'
import { motion } from 'framer-motion'

export default function InterviewSettingsPage() {
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user?.email

  const planLabel = (() => {
    const interviewPlan = String((session?.user as any)?.interviewPlan || '').toUpperCase()
    const globalPlan = String((session?.user as any)?.plan || '').toUpperCase()
    const p = interviewPlan || globalPlan || (isLoggedIn ? 'FREE' : 'GUEST')
    if (p === 'ENTERPRISE') return 'Enterprise'
    if (p === 'PRO') return 'PRO'
    if (p === 'FREE') return '無料'
    return 'ゲスト'
  })()

  return (
    <main className="max-w-3xl mx-auto py-6 sm:py-8 px-4 sm:px-6">
      <div className="mb-6 sm:mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/interview"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-700 text-xs sm:text-sm mb-2 font-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            戻る
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">設定</h1>
          <p className="text-sm text-gray-500 mt-1">ドヤインタビューAIの設定を管理できます。</p>
        </div>
      </div>

      {/* アカウント情報（最上部） */}
      <div className="mb-6">
        <AccountSummaryCard
          serviceName="ドヤインタビューAI"
          planLabel={planLabel}
          isLoggedIn={isLoggedIn}
          user={session?.user || null}
          loginHref="/auth/doyamarke/signin?callbackUrl=/interview/settings"
          onLogout={() => signOut({ callbackUrl: '/interview?loggedOut=1' })}
        />
      </div>

      {/* 料金プラン変更セクション */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl sm:rounded-[32px] border border-gray-100 shadow-xl shadow-orange-500/5 p-6 sm:p-8 mb-6"
      >
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 flex-shrink-0">
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
          href="/interview/plan"
          className="mt-6 flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50/40 hover:bg-gray-50 transition-colors"
        >
          <div className="flex-1">
            <p className="text-sm font-black text-gray-900">料金プランを確認・変更する</p>
            <p className="text-xs font-bold text-gray-500 mt-1">
              PRO/Enterpriseプランで動画ファイルのアップロードが可能になります
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400" />
        </Link>
      </motion.div>

      {/* プラン別の制限情報 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl sm:rounded-[32px] border border-gray-100 shadow-xl shadow-orange-500/5 p-6 sm:p-8 mb-6"
      >
        <div className="flex items-start gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
            <Settings className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-black text-gray-900">プラン別の制限</h2>
            <p className="text-xs font-bold text-gray-500 mt-1">
              各プランで利用可能な機能と制限を確認できます。
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* ゲストプラン */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/40">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-black text-gray-900">ゲスト</span>
              {planLabel === 'ゲスト' && (
                <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-black">現在のプラン</span>
              )}
            </div>
            <ul className="text-xs text-gray-600 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-orange-600 mt-0.5">•</span>
                <span>最初の1時間は使い放題（エンタープライズ機能まで）</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-600 mt-0.5">•</span>
                <span>音声ファイルのみ（最大100MB）</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-600 mt-0.5">•</span>
                <span>動画ファイルは不可</span>
              </li>
            </ul>
          </div>

          {/* 無料プラン */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/40">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-black text-gray-900">無料</span>
              {planLabel === '無料' && (
                <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-black">現在のプラン</span>
              )}
            </div>
            <ul className="text-xs text-gray-600 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>音声ファイルのみ（最大1GB）</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>動画ファイルは不可</span>
              </li>
            </ul>
          </div>

          {/* PROプラン */}
          <div className="p-4 rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-black text-gray-900">PRO</span>
              {planLabel === 'PRO' && (
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-black">現在のプラン</span>
              )}
            </div>
            <ul className="text-xs text-gray-600 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">•</span>
                <span>動画ファイルもアップロード可能（最大5GB）</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">•</span>
                <span>音声ファイル（最大5GB）</span>
              </li>
            </ul>
          </div>

          {/* Enterpriseプラン */}
          <div className="p-4 rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-black text-gray-900">Enterprise</span>
              {planLabel === 'Enterprise' && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black">現在のプラン</span>
              )}
            </div>
            <ul className="text-xs text-gray-600 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 mt-0.5">•</span>
                <span>大容量動画ファイルもアップロード可能（最大10GB）</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 mt-0.5">•</span>
                <span>音声ファイル（最大10GB）</span>
              </li>
            </ul>
          </div>
        </div>
      </motion.div>
    </main>
  )
}

