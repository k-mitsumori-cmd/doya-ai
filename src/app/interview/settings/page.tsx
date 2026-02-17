'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { INTERVIEW_PRICING, SUPPORT_CONTACT_URL } from '@/lib/pricing'

interface UsageStats {
  totalProjects: number
  totalDrafts: number
  totalMaterials: number
  storageUsedMb: number
}

type TabType = 'account' | 'plan' | 'settings'

// アニメーションカウンター
function AnimatedCounter({ value, duration = 1.2 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (value === 0) { setCount(0); return }
    let start = 0
    const step = Math.max(1, Math.ceil(value / (duration * 60)))
    const timer = setInterval(() => {
      start += step
      if (start >= value) { setCount(value); clearInterval(timer) }
      else setCount(start)
    }, 1000 / 60)
    return () => clearInterval(timer)
  }, [value, duration])
  return <>{count}</>
}

// ホバーで浮き上がるカード
function FloatingCard({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -4, boxShadow: '0 20px 40px -12px rgba(26,58,138,0.15)', transition: { duration: 0.25 } }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// シマーエフェクト（CTAボタン用）
function ShimmerButton({ children, onClick, disabled, className = '' }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative overflow-hidden ${className}`}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
      />
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
    </motion.button>
  )
}

export default function InterviewSettingsPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const pathname = usePathname()
  const router = useRouter()

  const [stats, setStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('account')
  const [isUpgrading, setIsUpgrading] = useState(false)

  const isLoggedIn = !!session?.user

  useEffect(() => {
    fetch('/api/interview/projects')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          const pjs = data.projects || []
          setStats({
            totalProjects: pjs.length,
            totalDrafts: pjs.reduce((sum: number, p: any) => sum + (p.draftCount || p._count?.drafts || 0), 0),
            totalMaterials: pjs.reduce((sum: number, p: any) => sum + (p.materialCount || p._count?.materials || 0), 0),
            storageUsedMb: 0,
          })
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const plan = useMemo(() => {
    const interviewPlan = String((user as any)?.interviewPlan || '').toUpperCase()
    const globalPlan = String((user as any)?.plan || '').toUpperCase()
    const p = interviewPlan || globalPlan || (isLoggedIn ? 'FREE' : 'GUEST')
    if (p === 'ENTERPRISE') return 'ENTERPRISE'
    if (p === 'PRO') return 'PRO'
    if (p === 'FREE') return 'FREE'
    return isLoggedIn ? 'FREE' : 'GUEST'
  }, [user, isLoggedIn])

  const handleUpgrade = async (planId: string) => {
    if (!isLoggedIn) {
      router.push(`/auth/doyamarke/signin?callbackUrl=${encodeURIComponent(pathname || '/interview/settings')}`)
      return
    }
    setIsUpgrading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingPeriod: 'monthly' }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else console.error('Checkout failed:', data.error)
    } catch (e) {
      console.error('Checkout error:', e)
    } finally {
      setIsUpgrading(false)
    }
  }

  const planLimits = useMemo(() => ({
    FREE: {
      label: '無料プラン', badge: 'FREE', badgeColor: 'bg-slate-100 text-slate-600',
      transcription: `${INTERVIEW_PRICING.transcriptionMinutes.free}分/月`, upload: '500MB',
      generation: `${INTERVIEW_PRICING.freeLimit}回/日`,
      features: ['AI記事生成', 'スキル選択', '校正・タイトル提案', '30日間の履歴保存'],
      missingFeatures: ['ファクトチェック', '翻訳（10言語）', 'SNS投稿文生成', '優先サポート', '無制限の履歴保存'],
    },
    PRO: {
      label: 'PRO プラン', badge: 'PRO', badgeColor: 'bg-[#7f19e6] text-white',
      transcription: `${INTERVIEW_PRICING.transcriptionMinutes.pro}分/月`, upload: '2GB',
      generation: `${INTERVIEW_PRICING.proLimit}回/日`,
      features: ['AI記事生成', 'スキル選択', '校正・タイトル提案', 'ファクトチェック', '翻訳（10言語）', 'SNS投稿文生成', '優先サポート', '無制限の履歴保存'],
      missingFeatures: ['大規模チーム運用', '専任サポート'],
    },
    ENTERPRISE: {
      label: 'ENTERPRISE プラン', badge: 'ENTERPRISE', badgeColor: 'bg-slate-900 text-white',
      transcription: `${INTERVIEW_PRICING.transcriptionMinutes.enterprise}分/月`, upload: '5GB',
      generation: `${INTERVIEW_PRICING.enterpriseLimit}回/日`,
      features: ['全機能利用可能', '大規模チーム運用', '専任サポート', '無制限の履歴保存'],
      missingFeatures: [],
    },
    GUEST: {
      label: 'ゲスト', badge: 'GUEST', badgeColor: 'bg-amber-100 text-amber-700',
      transcription: `${INTERVIEW_PRICING.transcriptionMinutes.guest}分`, upload: '100MB',
      generation: `${INTERVIEW_PRICING.guestLimit}回/日`,
      features: ['AI記事生成（お試し）'],
      missingFeatures: ['スキル選択', '校正・タイトル提案', 'ファクトチェック', '翻訳', 'SNS投稿文', '優先サポート'],
    },
  }), [])

  const currentPlan = planLimits[plan] || planLimits.FREE

  return (
    <motion.div
      className="space-y-8 max-w-4xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* ヘッダー */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
      >
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">設定</h1>
        <p className="text-sm text-slate-500 mt-1">アカウント情報、プラン、使用状況を管理</p>
      </motion.div>

      {/* タブナビゲーション — アニメーション付き */}
      <motion.div
        className="flex gap-2 relative overflow-x-auto pb-1 -mx-2 px-2 scrollbar-hide"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        {[
          { key: 'account' as TabType, label: 'アカウント', icon: 'person' },
          { key: 'plan' as TabType, label: 'プラン・利用状況', icon: 'rocket_launch' },
          { key: 'settings' as TabType, label: '設定', icon: 'settings' },
        ].map((tab) => (
          <motion.button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl border transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.key
                ? 'bg-[#7f19e6] text-white border-[#7f19e6] shadow-lg shadow-[#7f19e6]/25'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:shadow-md'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
            <span className="text-xs sm:text-sm font-semibold">{tab.label}</span>
          </motion.button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {/* ========================= */}
        {/* アカウントタブ */}
        {/* ========================= */}
        {activeTab === 'account' && (
          <motion.div
            key="account"
            className="space-y-6"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          >
            {/* ユーザー情報カード */}
            <FloatingCard className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" delay={0}>
              <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <h3 className="font-bold tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#7f19e6]">account_circle</span>
                  アカウント情報
                </h3>
              </div>
              <div className="p-6">
                {user ? (
                  <div className="flex items-center gap-5">
                    <motion.div whileHover={{ scale: 1.1, rotate: 3 }} transition={{ type: 'spring', stiffness: 300 }}>
                      {user.image ? (
                        <img src={user.image} alt="" className="w-20 h-20 rounded-2xl border-2 border-slate-200 shadow-lg" />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7f19e6] to-blue-600 flex items-center justify-center shadow-lg">
                          <span className="material-symbols-outlined text-white text-[36px]">person</span>
                        </div>
                      )}
                    </motion.div>
                    <div className="flex-1">
                      <p className="font-black text-slate-900 text-lg sm:text-xl tracking-tight">{user.name || 'ユーザー'}</p>
                      <p className="text-sm text-slate-500 mt-0.5">{user.email}</p>
                      <motion.div
                        className="flex items-center gap-2 mt-3"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                      >
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shadow-sm ${currentPlan.badgeColor}`}>
                          <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                          {currentPlan.badge}
                        </span>
                      </motion.div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center shadow-inner">
                      <span className="material-symbols-outlined text-slate-400 text-[36px]">person</span>
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-lg">ゲストユーザー</p>
                      <p className="text-sm text-slate-500 mb-3">ログインするとデータが保持されます</p>
                      <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                        <Link
                          href={`/auth/doyamarke/signin?callbackUrl=${encodeURIComponent('/interview/settings')}`}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7f19e6] text-white rounded-xl text-sm font-bold hover:bg-[#6b12c9] transition-colors shadow-lg shadow-[#7f19e6]/25"
                        >
                          <span className="material-symbols-outlined text-lg">login</span>
                          ログインして始める
                        </Link>
                      </motion.div>
                    </div>
                  </div>
                )}
              </div>
            </FloatingCard>

            {/* 現在のプラン — 制限サマリー（3Dカード風） */}
            <FloatingCard className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" delay={0.1}>
              <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                <h3 className="font-bold tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#7f19e6]">workspace_premium</span>
                  現在のプラン
                </h3>
                <motion.span
                  className={`px-3 py-1 rounded-full text-xs font-black ${currentPlan.badgeColor}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, delay: 0.4 }}
                >
                  {currentPlan.label}
                </motion.span>
              </div>
              <div className="p-6">
                {/* 制限サマリー — 浮き上がるカード */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  {[
                    { icon: 'mic', value: currentPlan.transcription, label: '文字起こし', gradient: 'from-blue-500 to-indigo-600' },
                    { icon: 'cloud_upload', value: currentPlan.upload, label: 'アップロード上限', gradient: 'from-emerald-500 to-teal-600' },
                    { icon: 'auto_awesome', value: currentPlan.generation, label: 'AI記事生成', gradient: 'from-violet-500 to-purple-600' },
                  ].map((item, i) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 20, rotateX: 15 }}
                      animate={{ opacity: 1, y: 0, rotateX: 0 }}
                      transition={{ duration: 0.5, delay: 0.2 + i * 0.1, ease: [0.23, 1, 0.32, 1] }}
                      whileHover={{ y: -6, scale: 1.03, transition: { duration: 0.2 } }}
                      className="relative rounded-2xl p-5 text-center overflow-hidden cursor-default"
                    >
                      {/* 背景グラデーション */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-[0.08]`} />
                      <div className="absolute inset-0 border border-slate-200 rounded-2xl" />
                      <div className="relative z-10">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mx-auto mb-3 shadow-lg`}>
                          <span className="material-symbols-outlined text-white text-xl">{item.icon}</span>
                        </div>
                        <p className="text-lg font-black text-slate-900">{item.value}</p>
                        <p className="text-[11px] text-slate-500 font-semibold mt-1">{item.label}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* 利用可能な機能 — アニメーション付きチェックリスト */}
                <div className="space-y-2 mb-6">
                  {currentPlan.features.map((f, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.4 + i * 0.05 }}
                      className="flex items-center gap-2.5 text-sm py-1"
                    >
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, delay: 0.5 + i * 0.05 }}
                        className="material-symbols-outlined text-emerald-500 text-[20px]"
                      >check_circle</motion.span>
                      <span className="text-slate-700 font-medium">{f}</span>
                    </motion.div>
                  ))}
                  {currentPlan.missingFeatures.map((f, i) => (
                    <motion.div
                      key={`m-${i}`}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 0.6, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.5 + currentPlan.features.length * 0.05 + i * 0.05 }}
                      className="flex items-center gap-2.5 text-sm py-1"
                    >
                      <span className="material-symbols-outlined text-slate-300 text-[20px]">lock</span>
                      <span className="text-slate-400">{f}</span>
                      {(plan === 'FREE' || plan === 'GUEST') && (
                        <span className="ml-auto text-[10px] font-black text-[#7f19e6] bg-blue-50 px-2 py-0.5 rounded-full">PRO</span>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* アップグレードCTA — グラデーション + シマー */}
                {(plan === 'FREE' || plan === 'GUEST') && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    className="relative rounded-2xl overflow-hidden"
                  >
                    {/* 背景 */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#7f19e6] via-blue-700 to-indigo-800" />
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9zdmc+')] opacity-50" />

                    <div className="relative z-10 p-5 sm:p-7">
                      <div className="flex items-center gap-3 sm:gap-4 mb-4">
                        <motion.div
                          animate={{ rotate: [0, 10, -10, 0] }}
                          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                          className="w-12 h-12 sm:w-14 sm:h-14 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20 shadow-lg shrink-0"
                        >
                          <span className="material-symbols-outlined text-white text-2xl sm:text-3xl">rocket_launch</span>
                        </motion.div>
                        <div>
                          <p className="font-black text-lg sm:text-xl text-white tracking-tight">PROプランにアップグレード</p>
                          <p className="text-blue-200 text-xs sm:text-sm font-semibold">月額 ¥9,980 で全機能を解放</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                        {[
                          { icon: 'speed', text: `文字起こし 150分/月（${plan === 'GUEST' ? '30倍' : '5倍'}）` },
                          { icon: 'timer', text: '1回の文字起こし: 最大約3時間' },
                          { icon: 'cloud_upload', text: 'アップロード上限 2GB' },
                          { icon: 'fact_check', text: 'ファクトチェック・翻訳' },
                          { icon: 'support_agent', text: '優先サポート・履歴無制限' },
                        ].map((item, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.7 + i * 0.08 }}
                            className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2.5 backdrop-blur-sm border border-white/10"
                          >
                            <span className="material-symbols-outlined text-amber-300 text-[18px]">{item.icon}</span>
                            <span className="text-[12px] text-blue-100 font-bold leading-tight">{item.text}</span>
                          </motion.div>
                        ))}
                      </div>

                      <ShimmerButton
                        onClick={() => handleUpgrade('interview-pro')}
                        disabled={isUpgrading}
                        className="w-full py-3.5 bg-white text-[#7f19e6] rounded-xl font-black text-sm shadow-xl disabled:opacity-60"
                      >
                        {isUpgrading ? (
                          <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-lg">upgrade</span>
                        )}
                        {isUpgrading ? '処理中...' : 'PROプランを始める'}
                      </ShimmerButton>
                    </div>
                  </motion.div>
                )}

                {plan === 'PRO' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    className="relative rounded-2xl overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900" />
                    <div className="relative z-10 p-5 sm:p-7">
                      <div className="flex items-center gap-3 sm:gap-4 mb-4">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20 shrink-0">
                          <span className="material-symbols-outlined text-white text-2xl sm:text-3xl">corporate_fare</span>
                        </div>
                        <div>
                          <p className="font-black text-lg sm:text-xl text-white tracking-tight">ENTERPRISEプラン</p>
                          <p className="text-slate-300 text-xs sm:text-sm font-semibold">月額 ¥49,980 で大規模運用に対応</p>
                        </div>
                      </div>
                      <div className="space-y-2 mb-5">
                        {['文字起こし 1,000分/月（約7倍）', '1回の文字起こし: 最大約3時間', 'アップロード上限 5GB', 'チーム運用・大量制作対応'].map((t, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                            <span className="material-symbols-outlined text-[16px] text-amber-300">star</span>
                            {t}
                          </div>
                        ))}
                      </div>
                      <ShimmerButton
                        onClick={() => handleUpgrade('interview-enterprise')}
                        disabled={isUpgrading}
                        className="w-full py-3.5 bg-white text-slate-900 rounded-xl font-black text-sm shadow-xl disabled:opacity-60"
                      >
                        {isUpgrading ? (
                          <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-lg">upgrade</span>
                        )}
                        {isUpgrading ? '処理中...' : 'ENTERPRISEへアップグレード'}
                      </ShimmerButton>
                    </div>
                  </motion.div>
                )}

                {plan === 'ENTERPRISE' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                    className="bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-2xl p-5 border border-emerald-200 flex items-center gap-4 shadow-sm"
                  >
                    <motion.span
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="material-symbols-outlined text-emerald-600 text-3xl"
                    >verified</motion.span>
                    <div>
                      <p className="font-black text-emerald-800">最上位プランをご利用中です</p>
                      <p className="text-sm text-emerald-600">全機能をフルにご活用いただけます</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </FloatingCard>
          </motion.div>
        )}

        {/* ========================= */}
        {/* プラン・利用状況タブ */}
        {/* ========================= */}
        {activeTab === 'plan' && (
          <motion.div
            key="plan"
            className="space-y-6"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          >
            {/* 利用統計 — アニメーションカウンター */}
            <FloatingCard className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm" delay={0}>
              <h2 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#7f19e6]">analytics</span>
                利用統計
              </h2>
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-2xl p-6 animate-pulse bg-gradient-to-br from-slate-100 to-slate-50">
                      <div className="h-10 bg-slate-200 rounded w-1/2 mb-3" />
                      <div className="h-4 bg-slate-100 rounded w-2/3" />
                    </div>
                  ))}
                </div>
              ) : stats ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { icon: 'folder', value: stats.totalProjects, label: 'プロジェクト', gradient: 'from-blue-500 to-indigo-600', bg: 'from-blue-50 to-indigo-50' },
                    { icon: 'description', value: stats.totalDrafts, label: '生成記事', gradient: 'from-emerald-500 to-teal-600', bg: 'from-emerald-50 to-teal-50' },
                    { icon: 'upload_file', value: stats.totalMaterials, label: 'アップロード素材', gradient: 'from-violet-500 to-purple-600', bg: 'from-violet-50 to-purple-50' },
                  ].map((item, i) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 25, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.1 + i * 0.12, ease: [0.23, 1, 0.32, 1] }}
                      whileHover={{ y: -6, scale: 1.03 }}
                      className={`bg-gradient-to-br ${item.bg} rounded-2xl p-6 border border-slate-200 shadow-sm cursor-default`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-md`}>
                          <span className="material-symbols-outlined text-white text-xl">{item.icon}</span>
                        </div>
                      </div>
                      <p className="text-3xl font-black text-slate-900 tabular-nums">
                        <AnimatedCounter value={item.value} />
                      </p>
                      <p className="text-sm text-slate-600 font-semibold mt-1">{item.label}</p>
                    </motion.div>
                  ))}
                </div>
              ) : null}
            </FloatingCard>

            {/* プラン比較表 */}
            <FloatingCard className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" delay={0.15}>
              <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <h2 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#7f19e6]">compare</span>
                  プラン比較
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200">
                      <th className="text-left px-6 py-4 font-bold text-slate-600">機能</th>
                      <th className={`text-center px-4 py-4 font-bold ${plan === 'FREE' ? 'text-[#7f19e6] bg-blue-50/80' : 'text-slate-600'}`}>
                        無料
                        {plan === 'FREE' && <span className="block text-[10px] font-black text-[#7f19e6]">現在のプラン</span>}
                      </th>
                      <th className={`text-center px-4 py-4 font-bold relative ${plan === 'PRO' ? 'text-[#7f19e6] bg-blue-50/80' : 'text-slate-600'}`}>
                        PRO
                        {plan === 'PRO' && <span className="block text-[10px] font-black text-[#7f19e6]">現在のプラン</span>}
                        {plan !== 'PRO' && plan !== 'ENTERPRISE' && (
                          <motion.span
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="block text-[10px] font-black text-amber-600"
                          >おすすめ</motion.span>
                        )}
                      </th>
                      <th className={`text-center px-4 py-4 font-bold ${plan === 'ENTERPRISE' ? 'text-[#7f19e6] bg-blue-50/80' : 'text-slate-600'}`}>
                        ENTERPRISE
                        {plan === 'ENTERPRISE' && <span className="block text-[10px] font-black text-[#7f19e6]">現在のプラン</span>}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: '月額料金', free: '¥0', pro: '¥9,980', enterprise: '¥49,980', isBold: true },
                      { label: '文字起こし', free: '30分/月', pro: '150分/月', enterprise: '1,000分/月' },
                      { label: '1回の上限', free: '約3時間', pro: '約3時間', enterprise: '約3時間' },
                      { label: 'アップロード上限', free: '500MB', pro: '2GB', enterprise: '5GB' },
                      { label: 'AI記事生成', free: '5回/日', pro: '30回/日', enterprise: '100回/日' },
                    ].map((row, i) => (
                      <motion.tr
                        key={row.label}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.04 }}
                        className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-6 py-3.5 font-medium text-slate-700">{row.label}</td>
                        <td className={`px-4 py-3.5 text-center ${row.isBold ? 'font-black' : ''} ${plan === 'FREE' ? 'bg-blue-50/30' : ''}`}>{row.free}</td>
                        <td className={`px-4 py-3.5 text-center font-bold text-[#7f19e6] ${plan === 'PRO' ? 'bg-blue-50/30' : ''}`}>{row.pro}</td>
                        <td className={`px-4 py-3.5 text-center ${row.isBold ? 'font-black' : 'font-bold'} ${plan === 'ENTERPRISE' ? 'bg-blue-50/30' : ''}`}>{row.enterprise}</td>
                      </motion.tr>
                    ))}
                    {[
                      { label: '校正・タイトル提案', free: true, pro: true, enterprise: true },
                      { label: 'ファクトチェック', free: false, pro: true, enterprise: true },
                      { label: '翻訳（10言語）', free: false, pro: true, enterprise: true },
                      { label: 'SNS投稿文生成', free: false, pro: true, enterprise: true },
                      { label: '履歴保存', free: '30日', pro: '無制限', enterprise: '無制限' },
                      { label: '優先サポート', free: false, pro: true, enterprise: true },
                      { label: '専任サポート', free: false, pro: false, enterprise: true },
                    ].map((row, i) => (
                      <motion.tr
                        key={row.label}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.45 + i * 0.04 }}
                        className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-6 py-3.5 font-medium text-slate-700">{row.label}</td>
                        {(['free', 'pro', 'enterprise'] as const).map((p) => {
                          const val = row[p]
                          const isCurrent = (p === 'free' && plan === 'FREE') || (p === 'pro' && plan === 'PRO') || (p === 'enterprise' && plan === 'ENTERPRISE')
                          return (
                            <td key={p} className={`px-4 py-3.5 text-center ${isCurrent ? 'bg-blue-50/30' : ''}`}>
                              {typeof val === 'boolean' ? (
                                val ? (
                                  <span className="material-symbols-outlined text-emerald-500 text-[18px]">check_circle</span>
                                ) : (
                                  <span className="material-symbols-outlined text-slate-300 text-[18px]">remove</span>
                                )
                              ) : (
                                <span className="font-medium">{val}</span>
                              )}
                            </td>
                          )
                        })}
                      </motion.tr>
                    ))}
                    <tr>
                      <td className="px-6 py-5" />
                      <td className={`px-4 py-5 text-center ${plan === 'FREE' ? 'bg-blue-50/30' : ''}`}>
                        {plan === 'FREE' && <span className="text-xs font-bold text-slate-400">ご利用中</span>}
                      </td>
                      <td className={`px-4 py-5 text-center ${plan === 'PRO' ? 'bg-blue-50/30' : ''}`}>
                        {plan === 'PRO' ? (
                          <span className="text-xs font-bold text-slate-400">ご利用中</span>
                        ) : plan !== 'ENTERPRISE' ? (
                          <motion.button
                            whileHover={{ scale: 1.06 }}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleUpgrade('interview-pro')}
                            disabled={isUpgrading}
                            className="px-5 py-2.5 bg-[#7f19e6] text-white rounded-xl text-xs font-black hover:bg-[#6b12c9] transition-colors disabled:opacity-60 inline-flex items-center gap-1.5 shadow-lg shadow-[#7f19e6]/20"
                          >
                            {isUpgrading && <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>}
                            PROを始める
                          </motion.button>
                        ) : null}
                      </td>
                      <td className={`px-4 py-5 text-center ${plan === 'ENTERPRISE' ? 'bg-blue-50/30' : ''}`}>
                        {plan === 'ENTERPRISE' ? (
                          <span className="text-xs font-bold text-slate-400">ご利用中</span>
                        ) : (
                          <motion.button
                            whileHover={{ scale: 1.06 }}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleUpgrade('interview-enterprise')}
                            disabled={isUpgrading}
                            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-black transition-colors disabled:opacity-60 inline-flex items-center gap-1.5 shadow-lg"
                          >
                            {isUpgrading && <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>}
                            ENTERPRISEを始める
                          </motion.button>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </FloatingCard>
          </motion.div>
        )}

        {/* ========================= */}
        {/* 設定タブ */}
        {/* ========================= */}
        {activeTab === 'settings' && (
          <motion.div
            key="settings"
            className="space-y-6"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          >
            <FloatingCard className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm" delay={0}>
              <h2 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#7f19e6]">tune</span>
                デフォルト設定
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                新規プロジェクト作成時のデフォルト値です。各プロジェクトで個別に変更できます。
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-slate-500">mood</span>
                    デフォルトトーン
                  </label>
                  <select className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#7f19e6] focus:border-[#7f19e6] transition-all">
                    <option value="professional">プロフェッショナル</option>
                    <option value="casual">カジュアル</option>
                    <option value="academic">アカデミック</option>
                    <option value="friendly">フレンドリー</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-slate-500">language</span>
                    デフォルトメディア
                  </label>
                  <select className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#7f19e6] focus:border-[#7f19e6] transition-all">
                    <option value="web">Webメディア</option>
                    <option value="corporate">企業サイト</option>
                    <option value="sns">SNS</option>
                    <option value="print">紙媒体</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-blue-50 rounded-xl p-3 border border-blue-100">
                <span className="material-symbols-outlined text-[16px]">info</span>
                <span>デフォルト設定の保存機能は今後追加予定です</span>
              </div>
            </FloatingCard>

            <FloatingCard className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm" delay={0.1}>
              <h2 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#7f19e6]">folder_managed</span>
                データ管理
              </h2>
              <div className="space-y-2">
                {[
                  { icon: 'folder_open', label: 'プロジェクト一覧', desc: '全プロジェクトの確認・管理', href: '/interview/projects' },
                  { icon: 'receipt_long', label: 'スキル管理', desc: 'カスタムスキルの作成・編集', href: '/interview/skills' },
                ].map((item, i) => (
                  <motion.div
                    key={item.href}
                    whileHover={{ x: 4, backgroundColor: 'rgba(26,58,138,0.03)' }}
                    className="flex items-center justify-between py-3.5 px-3 rounded-xl border-b border-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                        <span className="material-symbols-outlined text-slate-500 text-xl">{item.icon}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                    <motion.div whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                      >
                        表示
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </Link>
                    </motion.div>
                  </motion.div>
                ))}
              </div>
            </FloatingCard>

            <FloatingCard className="bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-50 rounded-2xl border border-blue-200 p-6 space-y-3 shadow-sm" delay={0.2}>
              <h2 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#7f19e6]">support_agent</span>
                ヘルプ・サポート
              </h2>
              <div className="text-sm text-slate-700 space-y-2.5">
                {[
                  { icon: 'check_circle', text: '対応ファイル形式: MP3, WAV, M4A, MP4, MOV, WEBM, PDF, TXT, DOCX' },
                  { icon: 'cloud_upload', text: '最大ファイルサイズ: 5GB（Supabase Storage 経由）' },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.08 }}
                    className="flex items-start gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px] text-blue-700 mt-0.5">{item.icon}</span>
                    <p className="leading-relaxed">{item.text}</p>
                  </motion.div>
                ))}
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] text-blue-700 mt-0.5">mail</span>
                  <p>
                    ご不明な点は
                    <a href={SUPPORT_CONTACT_URL} target="_blank" rel="noreferrer" className="text-[#7f19e6] font-bold underline ml-1 hover:text-blue-900 transition-colors">
                      お問い合わせ
                    </a>
                    ください。
                  </p>
                </div>
              </div>
            </FloatingCard>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
