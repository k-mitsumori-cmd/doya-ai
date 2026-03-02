'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { INTERVIEW_PRICING } from '@/lib/pricing'

interface InterviewUpsellModalProps {
  isOpen: boolean
  onClose: () => void
  limitType: 'transcription' | 'upload' | 'generation'
  currentUsage?: number
  limit?: number
  isGuest?: boolean
}

const LIMIT_INFO: Record<
  InterviewUpsellModalProps['limitType'],
  { icon: string; title: string; description: string; guestTitle: string; guestDescription: string }
> = {
  transcription: {
    icon: 'mic',
    title: '文字起こしの上限に達しました',
    description:
      '今月の文字起こし分数の上限に達しました。PROプランにアップグレードすると、毎月150分まで利用できます。（1回の文字起こしは最大約3時間）',
    guestTitle: '文字起こしの上限に達しました',
    guestDescription:
      'ゲスト利用の上限に達しました。無料登録するだけで毎月30分まで文字起こしが利用できます。（1回の文字起こしは最大約3時間）',
  },
  upload: {
    icon: 'cloud_upload',
    title: 'アップロード容量の上限に達しました',
    description:
      'アップロード容量の上限に達しました。PROプランにアップグレードすると、最大2GBまでアップロードできます。',
    guestTitle: 'アップロード容量の上限を超えています',
    guestDescription:
      'ゲスト利用ではアップロード容量に制限があります。無料登録するだけで最大500MBまでアップロードできます。',
  },
  generation: {
    icon: 'auto_awesome',
    title: '生成回数の上限に達しました',
    description:
      '本日の記事生成回数の上限に達しました。PROプランにアップグレードすると、1日30回まで利用できます。',
    guestTitle: 'ゲスト利用の上限に達しました',
    guestDescription:
      'ゲスト利用の上限に達しました。無料登録するだけで1日5回まで利用でき、すべての基本機能が使えます。',
  },
}

const PRO_FEATURES = [
  { icon: 'mic', text: '毎月150分まで文字起こし（1回最大約3時間）', highlight: true },
  { icon: 'cloud_upload', text: 'アップロード最大2GB', highlight: false },
  { icon: 'fact_check', text: 'ファクトチェック機能', highlight: false },
  { icon: 'translate', text: '10言語への翻訳', highlight: false },
  { icon: 'share', text: 'SNS投稿文の自動生成', highlight: false },
  { icon: 'all_inclusive', text: '履歴保存（無制限）', highlight: false },
  { icon: 'support_agent', text: '優先サポート', highlight: false },
]

const FREE_FEATURES = [
  { icon: 'mic', text: '毎月30分の文字起こし（1回最大約3時間）', highlight: true },
  { icon: 'cloud_upload', text: 'アップロード最大500MB', highlight: true },
  { icon: 'auto_awesome', text: '1日5回まで記事生成', highlight: false },
  { icon: 'edit_note', text: 'リッチエディタで記事編集', highlight: false },
  { icon: 'spellcheck', text: 'AI校正・校閲', highlight: false },
  { icon: 'title', text: 'タイトル提案', highlight: false },
]

export default function InterviewUpsellModal({
  isOpen,
  onClose,
  limitType,
  currentUsage,
  limit,
  isGuest = false,
}: InterviewUpsellModalProps) {
  const router = useRouter()
  const [showFeatures, setShowFeatures] = useState(false)

  const info = LIMIT_INFO[limitType]
  const proPlan = INTERVIEW_PRICING.plans.find((p) => p.id === 'interview-pro')
  const features = isGuest ? FREE_FEATURES : PRO_FEATURES
  const displayTitle = isGuest ? info.guestTitle : info.title
  const displayDescription = isGuest ? info.guestDescription : info.description

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => setShowFeatures(true), 400)
      return () => clearTimeout(t)
    } else {
      setShowFeatures(false)
    }
  }, [isOpen])

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const usagePercent =
    currentUsage != null && limit != null && limit > 0
      ? Math.min(100, Math.round((currentUsage / limit) * 100))
      : null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 24 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 背景グラデーション */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#7f19e6]/10 via-blue-500/5 to-transparent pointer-events-none" />

          {/* 閉じるボタン */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors z-10"
            aria-label="閉じる"
          >
            <span className="material-symbols-outlined text-[16px] text-slate-500">close</span>
          </button>

          <div className="relative p-8">
            {/* 制限アイコン */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', delay: 0.15, damping: 15 }}
              className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-5 bg-gradient-to-br from-[#7f19e6] to-blue-600 shadow-lg shadow-[#7f19e6]/30"
            >
              <span className="material-symbols-outlined text-white text-[40px]">
                {info.icon}
              </span>
            </motion.div>

            {/* タイトル・説明 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="text-center mb-5"
            >
              <h2 className="text-xl font-black text-slate-900 mb-2">{displayTitle}</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{displayDescription}</p>
            </motion.div>

            {/* 使用状況バー */}
            {usagePercent !== null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="mb-6 bg-slate-50 rounded-xl p-4 border border-slate-100"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    現在の使用状況
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {currentUsage} / {limit}
                    {limitType === 'transcription'
                      ? ' 分'
                      : limitType === 'upload'
                        ? ' MB'
                        : ' 回'}
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${usagePercent}%` }}
                    transition={{ delay: 0.5, duration: 0.6, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-[#7f19e6] to-blue-500"
                  />
                </div>
              </motion.div>
            )}

            {/* PRO機能一覧 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: showFeatures ? 1 : 0 }}
              transition={{ delay: 0.4 }}
              className="bg-slate-50 rounded-2xl p-4 mb-6 text-left"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[16px] text-[#7f19e6]">
                  {isGuest ? 'person_add' : 'workspace_premium'}
                </span>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  {isGuest ? '無料プランの機能' : 'PROプランの機能'}
                </span>
              </div>

              <ul className="space-y-1.5">
                {features.map((feature, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.07 }}
                    className={`flex items-center gap-3 p-2 rounded-xl ${
                      feature.highlight ? 'bg-blue-100' : 'bg-white'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        feature.highlight
                          ? 'bg-[#7f19e6] text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {feature.icon}
                      </span>
                    </div>
                    <span
                      className={`text-sm ${
                        feature.highlight
                          ? 'font-bold text-slate-900'
                          : 'font-medium text-slate-700'
                      }`}
                    >
                      {feature.text}
                    </span>
                    <span className="material-symbols-outlined text-[16px] ml-auto text-[#7f19e6]">
                      check_circle
                    </span>
                  </motion.li>
                ))}
              </ul>

              {isGuest ? (
                <div className="mt-3 pt-3 border-t border-slate-200 text-center">
                  <span className="text-lg font-black text-[#7f19e6]">¥0</span>
                  <span className="text-xs text-slate-500">　Googleアカウントで即登録</span>
                </div>
              ) : proPlan ? (
                <div className="mt-3 pt-3 border-t border-slate-200 text-center">
                  <span className="text-lg font-black text-[#7f19e6]">
                    {proPlan.priceLabel}
                  </span>
                  <span className="text-xs text-slate-500">{proPlan.period}</span>
                </div>
              ) : null}
            </motion.div>

            {/* CTAボタン */}
            <div className="space-y-3">
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                onClick={() => {
                  onClose()
                  router.push(isGuest ? '/api/auth/signin' : '/interview/settings')
                }}
                className="w-full py-4 px-6 rounded-2xl font-bold text-white transition-all transform hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-[#7f19e6] to-blue-600 hover:from-[#152e70] hover:to-blue-700 shadow-lg shadow-[#7f19e6]/30"
              >
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">
                    {isGuest ? 'person_add' : 'rocket_launch'}
                  </span>
                  {isGuest ? '無料で登録する' : 'プロプランにアップグレード'}
                </span>
              </motion.button>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                onClick={onClose}
                className="w-full py-3 px-6 rounded-2xl text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
              >
                後で
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
