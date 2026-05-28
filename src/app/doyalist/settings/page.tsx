'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

/* ──────────────────────────────────────────────
   型定義
   ────────────────────────────────────────────── */

interface UsageStats {
  listsCreated: number
  listsLimit: number
  totalCompanies: number
  aiAnalysisCount: number
  approachCount: number
}

interface CompanyProfile {
  companyName: string
  serviceDescription: string
  strengths: string
}

/* ──────────────────────────────────────────────
   メインコンポーネント
   ────────────────────────────────────────────── */

export default function SettingsPage() {
  const [usage, setUsage] = useState<UsageStats>({
    listsCreated: 0,
    listsLimit: 3,
    totalCompanies: 0,
    aiAnalysisCount: 0,
    approachCount: 0,
  })
  const [plan, setPlan] = useState<'free' | 'light' | 'pro' | 'enterprise'>('free')
  const [profile, setProfile] = useState<CompanyProfile>({
    companyName: '',
    serviceDescription: '',
    strengths: '',
  })
  const [isLoadingUsage, setIsLoadingUsage] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)

  useEffect(() => {
    fetchUsage()
    loadProfile()
  }, [])

  const fetchUsage = async () => {
    try {
      setIsLoadingUsage(true)
      const res = await fetch('/api/doyalist/usage')
      if (res.ok) {
        const data = await res.json()
        // APIの返却形式に合わせてマッピング
        if (data.usage) {
          setUsage({
            listsCreated: data.usage.creditsUsed ?? 0,
            listsLimit: data.usage.creditsLimit ?? 3,
            totalCompanies: data.usage.totalProjects ?? 0,
            aiAnalysisCount: data.usage.monthlyUsage ?? 0,
            approachCount: 0,
          })
        }
        if (data.limits?.isEnterprise) {
          setPlan('enterprise')
        } else if (data.limits?.isPro) {
          setPlan('pro')
        } else if (data.limits?.isLight) {
          setPlan('light')
        } else {
          setPlan('free')
        }
      }
    } catch (err) {
      console.error('利用状況取得エラー:', err)
    } finally {
      setIsLoadingUsage(false)
    }
  }

  const loadProfile = () => {
    try {
      const saved = localStorage.getItem('doyalist_company_profile')
      if (saved) {
        setProfile(JSON.parse(saved))
      }
    } catch (err) {
      console.error('プロフィール読込エラー:', err)
    }
  }

  const handleSaveProfile = () => {
    setIsSaving(true)
    try {
      localStorage.setItem('doyalist_company_profile', JSON.stringify(profile))
      setSavedMessage('保存しました')
      setTimeout(() => setSavedMessage(''), 3000)
    } catch (err) {
      console.error('プロフィール保存エラー:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleArchive = () => {
    // TODO: implement actual archive API call
    setShowArchiveConfirm(false)
  }

  const planConfig = {
    free: { label: 'フリー', color: 'bg-slate-100 text-slate-700', border: 'border-slate-300' },
    light: { label: 'ライト', color: 'bg-sky-100 text-sky-700', border: 'border-sky-300' },
    pro: { label: 'プロ', color: 'bg-blue-100 text-blue-700', border: 'border-blue-300' },
    enterprise: { label: 'エンタープライズ', color: 'bg-indigo-100 text-indigo-700', border: 'border-indigo-300' },
  }

  const currentPlan = planConfig[plan]
  const usagePercent = usage.listsLimit > 0
    ? Math.min((usage.listsCreated / usage.listsLimit) * 100, 100)
    : 0
  const remaining = usage.listsLimit === -1
    ? null
    : Math.max(usage.listsLimit - usage.listsCreated, 0)

  /* ──── animation variants ──── */
  const cardVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.9 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { delay: i * 0.12, type: "spring", bounce: 0.35 },
    }),
  }

  return (
    <div className="min-h-screen bg-blue-50/30">
      {/* ===== Header ===== */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="bg-white px-6 lg:px-8 pt-8 pb-6 border-b border-slate-100"
      >
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
            className="flex items-center gap-3"
          >
            <motion.img
              src="/characters/point_解説.png"
              alt="設定"
              className="w-16 h-16 object-contain rounded-full"
              animate={{ rotate: [-3, 3, -3] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">利用状況 &amp; 設定</h1>
              <p className="text-sm font-medium text-slate-500 mt-1">
                ドヤリストAIの使用状況と設定を確認・管理できます
              </p>
            </div>
          </motion.div>
        </div>
      </motion.section>

      <div className="px-6 lg:px-8 max-w-5xl mx-auto pt-6 pb-24">

      {/* ━━━━━━━━━━ Usage Overview Cards (4-grid) ━━━━━━━━━━ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">

        {/* Card 1: 今月のリスト作成数 */}
        <motion.div
          custom={0}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm"
        >
          {isLoadingUsage ? (
            <SkeletonCard />
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl text-blue-500">list_alt</span>
                </div>
                <span className="text-xs font-bold text-slate-500 leading-tight">今月の<br/>リスト作成数</span>
              </div>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-3xl font-extrabold text-slate-900">{usage.listsCreated}</span>
                <span className="text-sm font-bold text-slate-400">
                  / {usage.listsLimit === -1 ? '無制限' : usage.listsLimit}
                </span>
              </div>
              {usage.listsLimit !== -1 && (
                <>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                    <motion.div
                      className={`h-full rounded-full ${
                        usagePercent >= 90
                          ? 'bg-red-500'
                          : usagePercent >= 70
                            ? 'bg-amber-500'
                            : 'bg-blue-500'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${usagePercent}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                    />
                  </div>
                  <p className="text-xs font-bold text-slate-400">
                    残り <span className={`${remaining === 0 ? 'text-red-500' : 'text-blue-600'}`}>{remaining}件</span>
                  </p>
                </>
              )}
            </>
          )}
        </motion.div>

        {/* Card 2: 総企業数 */}
        <motion.div
          custom={1}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm"
        >
          {isLoadingUsage ? (
            <SkeletonCard />
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl text-emerald-500">apartment</span>
                </div>
                <span className="text-xs font-bold text-slate-500 leading-tight">総企業数</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-900">{usage.totalCompanies}</span>
                <span className="text-sm font-bold text-slate-400">社</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">全プロジェクト合計</p>
            </>
          )}
        </motion.div>

        {/* Card 3: AI分析回数 */}
        <motion.div
          custom={2}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm"
        >
          {isLoadingUsage ? (
            <SkeletonCard />
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl text-amber-500">analytics</span>
                </div>
                <span className="text-xs font-bold text-slate-500 leading-tight">AI分析回数</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-900">{usage.aiAnalysisCount}</span>
                <span className="text-sm font-bold text-slate-400">回</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">スコアリング・分析</p>
            </>
          )}
        </motion.div>

        {/* Card 4: 現在のプラン */}
        <motion.div
          custom={3}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm"
        >
          {isLoadingUsage ? (
            <SkeletonCard />
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl text-blue-500">workspace_premium</span>
                </div>
                <span className="text-xs font-bold text-slate-500 leading-tight">現在のプラン</span>
              </div>
              <div className="mb-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-extrabold ${currentPlan.color}`}>
                  {currentPlan.label}
                </span>
              </div>
              {plan === 'free' || plan === 'light' ? (
                <Link
                  href="/doyalist/pricing"
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-500 hover:text-blue-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">upgrade</span>
                  アップグレード
                </Link>
              ) : (
                <p className="text-xs text-slate-400">有効なプラン</p>
              )}
            </>
          )}
        </motion.div>
      </div>

      {/* ━━━━━━━━━━ Company Profile Section ━━━━━━━━━━ */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.45 }}
        className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm mb-10"
      >
        {/* Section header */}
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl text-blue-500">business</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              自社プロフィール
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ここで設定した情報が新規リスト作成時に自動入力されます
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {/* 自社名 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">自社名</label>
            <input
              type="text"
              value={profile.companyName}
              onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
              placeholder="例: 株式会社スリスタ"
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-400 transition-all placeholder:text-slate-300"
            />
          </div>

          {/* サービス説明 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">サービス説明</label>
            <textarea
              value={profile.serviceDescription}
              onChange={(e) => setProfile({ ...profile, serviceDescription: e.target.value })}
              placeholder="例: 中小企業向けのWebマーケティング支援サービスを提供。SEO対策、広告運用、コンテンツ制作が主力事業です。"
              rows={3}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl text-sm resize-none focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-400 transition-all placeholder:text-slate-300"
            />
          </div>

          {/* 強み・差別化ポイント */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">強み・差別化ポイント</label>
            <textarea
              value={profile.strengths}
              onChange={(e) => setProfile({ ...profile, strengths: e.target.value })}
              placeholder="例: AI活用による効率的なコンテンツ制作、月額制で中小企業でも導入しやすい料金体系、専属コンサルタントによるサポート"
              rows={3}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl text-sm resize-none focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-400 transition-all placeholder:text-slate-300"
            />
          </div>

          {/* Save button + success message */}
          <div className="flex items-center justify-between pt-2">
            <AnimatePresence>
              {savedMessage && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center gap-2 text-sm font-bold text-green-600 relative"
                >
                  {/* 紙吹雪 */}
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        background: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'][i],
                        left: '20px',
                        top: '10px',
                      }}
                      initial={{ opacity: 1, scale: 1 }}
                      animate={{
                        x: [0, (Math.random() - 0.5) * 120],
                        y: [0, -40 - Math.random() * 60],
                        opacity: [1, 0],
                        scale: [1, 0.3],
                      }}
                      transition={{ duration: 0.8, delay: i * 0.05, ease: 'easeOut' }}
                    />
                  ))}
                  <motion.img
                    src="/characters/thumbsup_いいね.png"
                    alt=""
                    className="w-16 h-16 object-contain rounded-full"
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: [0, 1.3, 1], rotate: [-30, 10, 0] }}
                    transition={{ type: "spring", stiffness: 300, damping: 10 }}
                  />
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  {savedMessage}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="ml-auto flex items-center gap-3">
              <motion.img
                src="/characters/ramen_休憩.png"
                alt=""
                className="w-12 h-12 object-contain rounded-full"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white font-bold text-sm rounded-full shadow-lg shadow-blue-200/50 hover:bg-blue-600 hover:shadow-blue-300/60 active:scale-[0.97] transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-lg">save</span>
                )}
                保存する
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ━━━━━━━━━━ Quick Links ━━━━━━━━━━ */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.45 }}
        className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm mb-10"
      >
        <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-500">link</span>
          クイックリンク
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLink
            href="/doyalist/pricing"
            icon="payments"
            label="料金プラン"
            description="プランの比較・変更"
            iconColor="text-sky-500"
            iconBg="bg-sky-50"
          />
          <QuickLink
            href="/doyalist/templates"
            icon="description"
            label="テンプレート管理"
            description="保存したテンプレートの編集"
            iconColor="text-indigo-500"
            iconBg="bg-indigo-50"
          />
          <QuickLink
            href="#"
            icon="download"
            label="CSVエクスポート履歴"
            description="過去のエクスポートを確認"
            iconColor="text-slate-400"
            iconBg="bg-slate-50"
            comingSoon
          />
          <QuickLink
            href="#"
            icon="api"
            label="API連携設定"
            description="外部ツールとの接続"
            iconColor="text-slate-400"
            iconBg="bg-slate-50"
            comingSoon
          />
        </div>
      </motion.div>

      {/* ━━━━━━━━━━ Danger Zone ━━━━━━━━━━ */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.45 }}
        className="bg-slate-50 rounded-3xl border border-slate-100 p-6"
      >
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-slate-400">warning</span>
          データ管理
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          以下の操作は取り消せません。十分にご注意ください。
        </p>

        <div className="flex items-center justify-between bg-white rounded-xl border border-red-100 p-4">
          <div>
            <p className="text-sm font-bold text-slate-700">全リストをアーカイブ</p>
            <p className="text-xs text-slate-400 mt-0.5">全プロジェクトのリストを一括アーカイブします</p>
          </div>
          <button
            onClick={() => setShowArchiveConfirm(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-600 font-bold text-xs rounded-xl hover:bg-red-50 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">archive</span>
            アーカイブ
          </button>
        </div>

        {/* Archive confirmation dialog */}
        <AnimatePresence>
          {showArchiveConfirm && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-bold text-red-700 mb-1">本当にアーカイブしますか？</p>
                <p className="text-xs text-red-500 mb-4">
                  全てのリストがアーカイブされます。この操作は元に戻せません。
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleArchive}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">delete_forever</span>
                    実行する
                  </button>
                  <button
                    onClick={() => setShowArchiveConfirm(false)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────
   サブコンポーネント
   ────────────────────────────────────────────── */

/** Skeleton placeholder while usage data is loading */
function SkeletonCard() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100" />
        <div className="h-3 w-16 bg-slate-100 rounded" />
      </div>
      <div className="h-8 w-20 bg-slate-100 rounded" />
      <div className="h-2 w-full bg-slate-100 rounded" />
    </div>
  )
}

/** Quick link card */
function QuickLink({
  href,
  icon,
  label,
  description,
  iconColor,
  iconBg,
  comingSoon = false,
}: {
  href: string
  icon: string
  label: string
  description: string
  iconColor: string
  iconBg: string
  comingSoon?: boolean
}) {
  const inner = (
    <div
      className={`flex items-center gap-4 rounded-xl border p-4 transition-all ${
        comingSoon
          ? 'border-slate-100 bg-slate-50/50 cursor-default'
          : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md hover:shadow-blue-100/50 cursor-pointer'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
        <span className={`material-symbols-outlined text-xl ${iconColor}`}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${comingSoon ? 'text-slate-400' : 'text-slate-700'}`}>
            {label}
          </span>
          {comingSoon && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400">
              COMING SOON
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{description}</p>
      </div>
      {!comingSoon && (
        <span className="material-symbols-outlined text-lg text-slate-300">chevron_right</span>
      )}
    </div>
  )

  if (comingSoon) {
    return inner
  }

  return <Link href={href}>{inner}</Link>
}
