'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

// ============================================
// プラットフォーム定義
// ============================================
const PLATFORMS = [
  {
    key: 'note',
    icon: 'edit_note',
    name: 'note',
    description: 'ブログ記事スタイルのコンテンツ',
    estimatedLength: '2,000〜5,000文字',
    color: 'from-green-400 to-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconColor: 'text-green-500',
  },
  {
    key: 'blog',
    icon: 'article',
    name: 'Blog',
    description: 'SEO最適化されたブログ記事',
    estimatedLength: '3,000〜8,000文字',
    color: 'from-blue-400 to-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-500',
  },
  {
    key: 'x',
    icon: 'alternate_email',
    name: 'X',
    description: 'ツイートスレッド形式',
    estimatedLength: '140〜280文字 x 3〜5ツイート',
    color: 'from-slate-600 to-slate-800',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    iconColor: 'text-slate-600',
  },
  {
    key: 'instagram',
    icon: 'camera_alt',
    name: 'Instagram',
    description: 'キャプション + ハッシュタグ',
    estimatedLength: '300〜1,000文字',
    color: 'from-pink-400 to-purple-600',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    iconColor: 'text-pink-500',
  },
  {
    key: 'line',
    icon: 'chat_bubble',
    name: 'LINE',
    description: 'LINE公式アカウント投稿',
    estimatedLength: '200〜500文字',
    color: 'from-green-500 to-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconColor: 'text-green-600',
  },
  {
    key: 'facebook',
    icon: 'business',
    name: 'Facebook',
    description: 'Facebookページ投稿',
    estimatedLength: '500〜2,000文字',
    color: 'from-blue-500 to-blue-800',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-600',
  },
  {
    key: 'linkedin',
    icon: 'work',
    name: 'LinkedIn',
    description: 'ビジネス向け投稿',
    estimatedLength: '500〜3,000文字',
    color: 'from-sky-500 to-sky-700',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    iconColor: 'text-sky-600',
  },
  {
    key: 'newsletter',
    icon: 'mail',
    name: 'メルマガ',
    description: 'メールマガジン形式',
    estimatedLength: '1,000〜3,000文字',
    color: 'from-amber-400 to-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    iconColor: 'text-amber-500',
  },
  {
    key: 'press_release',
    icon: 'push_pin',
    name: 'プレスリリース',
    description: 'プレスリリース形式',
    estimatedLength: '1,500〜4,000文字',
    color: 'from-red-400 to-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-500',
  },
]

// ============================================
// Props
// ============================================
interface StepPlatformSelectProps {
  onSubmit: (
    platforms: string[],
    brandVoiceId: string | null,
    customInstructions: string
  ) => void
}

// ============================================
// BrandVoice型
// ============================================
interface BrandVoice {
  id: string
  name: string
  isDefault: boolean
}

// ============================================
// StepPlatformSelect コンポーネント
// ============================================
export default function StepPlatformSelect({ onSubmit }: StepPlatformSelectProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set())
  const [brandVoiceId, setBrandVoiceId] = useState<string>('')
  const [customInstructions, setCustomInstructions] = useState('')
  const [brandVoices, setBrandVoices] = useState<BrandVoice[]>([])
  const MAX_INSTRUCTIONS = 1000

  // ブランドボイス一覧取得
  useEffect(() => {
    fetch('/api/tenkai/brand-voices')
      .then((r) => r.json())
      .then((data) => {
        const voices = data.brandVoices || []
        if (Array.isArray(voices)) {
          setBrandVoices(voices)
          const defaultVoice = voices.find((v: BrandVoice) => v.isDefault)
          if (defaultVoice) setBrandVoiceId(defaultVoice.id)
        }
      })
      .catch(() => {})
  }, [])

  // プラットフォーム選択トグル
  const togglePlatform = useCallback((key: string) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  // すべて選択/解除
  const toggleAll = useCallback(() => {
    setSelectedPlatforms((prev) => {
      if (prev.size === PLATFORMS.length) {
        return new Set()
      }
      return new Set(PLATFORMS.map((p) => p.key))
    })
  }, [])

  // 送信
  const handleSubmit = useCallback(() => {
    onSubmit(
      Array.from(selectedPlatforms),
      brandVoiceId || null,
      customInstructions
    )
  }, [selectedPlatforms, brandVoiceId, customInstructions, onSubmit])

  return (
    <div>
      {/* ヘッダー */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-black text-slate-900 mb-2">
          プラットフォームを選択
        </h2>
        <p className="text-slate-500">
          コンテンツを展開するプラットフォームを選んでください
        </p>
      </div>

      {/* すべて選択 + 選択数 */}
      <div className="flex items-center justify-between mb-6 max-w-4xl mx-auto">
        <button
          onClick={toggleAll}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">
            {selectedPlatforms.size === PLATFORMS.length ? 'deselect' : 'select_all'}
          </span>
          {selectedPlatforms.size === PLATFORMS.length ? 'すべて解除' : 'すべて選択'}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">選択中:</span>
          <span className="px-3 py-1 bg-blue-50 text-blue-700 text-sm font-bold rounded-full">
            {selectedPlatforms.size} / {PLATFORMS.length}
          </span>
        </div>
      </div>

      {/* プラットフォームグリッド */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto mb-8">
        {PLATFORMS.map((platform, index) => {
          const isSelected = selectedPlatforms.has(platform.key)
          return (
            <motion.button
              key={platform.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              onClick={() => togglePlatform(platform.key)}
              className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-200 ${
                isSelected
                  ? `${platform.borderColor} ${platform.bgColor} shadow-md`
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              {/* チェックマーク */}
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-white text-sm">check</span>
                </motion.div>
              )}

              {/* アイコン */}
              <div
                className={`w-12 h-12 rounded-xl ${
                  isSelected ? platform.bgColor : 'bg-slate-100'
                } flex items-center justify-center mb-3`}
              >
                <span
                  className={`material-symbols-outlined text-2xl ${
                    isSelected ? platform.iconColor : 'text-slate-400'
                  }`}
                >
                  {platform.icon}
                </span>
              </div>

              {/* テキスト */}
              <h3
                className={`text-sm font-bold mb-1 ${
                  isSelected ? 'text-slate-900' : 'text-slate-700'
                }`}
              >
                {platform.name}
              </h3>
              <p className="text-xs text-slate-500 mb-2">{platform.description}</p>
              <p className="text-[10px] text-slate-400">
                <span className="material-symbols-outlined text-[10px] align-middle mr-0.5">
                  text_fields
                </span>
                {platform.estimatedLength}
              </p>
            </motion.button>
          )
        })}
      </div>

      {/* オプション: ブランドボイス + カスタム指示 */}
      <div className="max-w-4xl mx-auto space-y-4 mb-8">
        {/* ブランドボイス選択 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-purple-500">record_voice_over</span>
            <h3 className="text-sm font-bold text-slate-900">ブランドボイス（任意）</h3>
          </div>
          <select
            value={brandVoiceId}
            onChange={(e) => setBrandVoiceId(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white"
          >
            <option value="">選択しない（デフォルト）</option>
            {brandVoices.map((bv) => (
              <option key={bv.id} value={bv.id}>
                {bv.name} {bv.isDefault ? '(デフォルト)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* カスタム指示 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-amber-500">edit_note</span>
            <h3 className="text-sm font-bold text-slate-900">カスタム指示（任意）</h3>
          </div>
          <textarea
            value={customInstructions}
            onChange={(e) => {
              if (e.target.value.length <= MAX_INSTRUCTIONS) {
                setCustomInstructions(e.target.value)
              }
            }}
            placeholder="生成時に追加したい指示があれば入力してください..."
            rows={3}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors resize-none"
          />
          <p className="text-xs text-slate-400 text-right mt-1">
            {customInstructions.length} / {MAX_INSTRUCTIONS}文字
          </p>
        </div>
      </div>

      {/* 送信ボタン */}
      <div className="max-w-4xl mx-auto">
        <button
          onClick={handleSubmit}
          disabled={selectedPlatforms.size === 0}
          className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-bold transition-all ${
            selectedPlatforms.size > 0
              ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <span className="material-symbols-outlined text-lg">auto_awesome</span>
          {selectedPlatforms.size > 0
            ? `${selectedPlatforms.size}件のプラットフォームで生成開始`
            : 'プラットフォームを選択してください'}
        </button>
      </div>
    </div>
  )
}
